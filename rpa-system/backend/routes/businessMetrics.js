const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');
const metricsCacheService = require('../services/metricsCacheService');

// Import auth middleware with dev bypass support
const { checkDevBypass } = require('../middleware/devBypassAuth');
const authMiddleware = async (req, res, next) => {
 try {
 // ✅ SECURITY: Check dev bypass first (only works in development)
 const devUser = checkDevBypass(req);
 if (devUser) {
 req.user = devUser;
 req.userId = devUser.id;
 req.devBypass = true;
 req.devUser = { id: devUser.id, isDevBypass: true };
 return next();
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const authHeader = (req.get('authorization') || '').trim();
 const parts = authHeader.split(' ');
 const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

 if (!token) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { data, error } = await supabase.auth.getUser(token);
 if (error || !data || !data.user) {
 return res.status(401).json({ error: 'Authentication failed' });
 }

 req.user = data.user;
 req.userId = data.user.id;
 next();
 } catch (error) {
 logger.error('Auth middleware error:', { error: error.message });
 res.status(401).json({ error: 'Authentication failed' });
 }
};

/**
 * Business Metrics API Routes
 * Provides comprehensive business KPIs for EasyFlow
 * PRIVATE - Owner only (kyjahntsmith@gmail.com, kyjahnsmith36@gmail.com)
 * Used by Grafana dashboards and business intelligence tools
 */

/**
 * Middleware: Check if user is owner
 * Must be used AFTER authMiddleware
 */
const requireOwner = async (req, res, next) => {
 try {
 // ✅ SECURITY: Allow dev bypass to skip owner check in development
 // This allows full testing without needing owner credentials
 if (req.devBypass && process.env.NODE_ENV !== 'production') {
 logger.info('[BusinessMetrics] Dev bypass active, skipping owner check', { userId: req.user?.id });
 return next();
 }

 // Auth middleware should have set req.user
 if (!req.user || !req.user.id) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 // Get user email - try multiple sources
 let userEmail = req.user.email;

 // If not in req.user, get from Supabase auth
 if (!userEmail) {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(req.user.id);
 if (authError || !authUser?.user?.email) {
 logger.warn('[BusinessMetrics] Could not verify owner status', { userId: req.user.id, error: authError?.message });
 return res.status(403).json({ error: 'Access denied' });
 }
 userEmail = authUser.user.email;
 }

 const OWNER_EMAILS = ['kyjahntsmith@gmail.com', 'kyjahnsmith36@gmail.com'];
 const normalizedUserEmail = (userEmail || '').toLowerCase().trim();
 const isOwner = OWNER_EMAILS.some(email =>
 normalizedUserEmail === email.toLowerCase().trim()
 );

 if (!isOwner) {
 logger.warn('[BusinessMetrics] Unauthorized access attempt', { email: userEmail, ownerEmails: OWNER_EMAILS });
 return res.status(403).json({ error: 'Access denied - owner only' });
 }

 next();
 } catch (error) {
 logger.error('[BusinessMetrics] Owner check error:', error);
 res.status(500).json({ error: 'Internal server error' });
 }
};

/**
 * GET /api/business-metrics/overview
 * Returns high-level business metrics overview
 * Uses cached metrics from easyflow-metrics/latest_metrics.json when available
 * PRIVATE - Owner only
 */
router.get('/overview', authMiddleware, requireOwner, async (req, res) => {
 try {
 // ✅ INTEGRATION: Try to get metrics from cache first (from easyflow-metrics)
 const cachedMetrics = await metricsCacheService.getMetrics();

 if (cachedMetrics) {
 // Use cached metrics (from daily batch collection)
 logger.debug('Using cached metrics from easyflow-metrics');
 return res.json({
 source: 'cached',
 timeframe: '7d', // Cached metrics are typically 7-day averages
 metrics: {
 totalUsers: cachedMetrics.active_users?.current || 0,
 activeUsers: cachedMetrics.active_users?.current || 0,
 newSignups: cachedMetrics.signups?.today || 0,
 activatedUsers: cachedMetrics.funnel_rates?.activated_users_count || 0,
 activationRate: cachedMetrics.activation_rate || 0,
 workflowsCreated: cachedMetrics.engagement?.workflows_created_today || 0,
 workflowsRun: cachedMetrics.workflows?.today || 0,
 mrr: cachedMetrics.mrr || 0,
 conversionRate: cachedMetrics.funnel_rates?.visit_to_signup || 0,
 avgWorkflowsPerUser: 0, // Not in cached metrics
 avgRunsPerUser: 0 // Not in cached metrics
 },
 timestamp: new Date().toISOString(),
 cacheStatus: metricsCacheService.getCacheStatus()
 });
 }

 // Fallback to real-time queries if cache not available
 logger.debug('Cache not available, using real-time queries');
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { timeframe = '30d' } = req.query;
 const days = parseInt(timeframe.replace('d', '')) || 30;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);
 const startDateISO = startDate.toISOString();

 // Calculate all metrics in parallel
 const [
 totalUsersResult,
 activeUsersResult,
 newSignupsResult,
 activatedUsersResult,
 workflowsCreatedResult,
 workflowsRunResult,
 mrrResult,
 conversionRateResult
 ] = await Promise.allSettled([
 // Total users
 supabase
 .from('profiles')
 .select('id', { count: 'exact', head: true }),

 // Active users (last 30 days)
 supabase
 .from('profiles')
 .select('id', { count: 'exact', head: true })
 .gte('last_seen_at', startDateISO),

 // New signups in timeframe
 supabase
 .from('profiles')
 .select('id', { count: 'exact', head: true })
 .gte('created_at', startDateISO),

 // Activated users (users with at least 1 workflow)
 supabase
 .from('automation_tasks')
 .select('user_id', { count: 'exact' })
 .eq('is_active', true),

 // Workflows created in timeframe
 supabase
 .from('automation_tasks')
 .select('id', { count: 'exact', head: true })
 .gte('created_at', startDateISO),

 // Workflows run in timeframe
 supabase
 .from('automation_runs')
 .select('id', { count: 'exact', head: true })
 .gte('created_at', startDateISO),

 // MRR calculation (from subscriptions)
 supabase
 .from('subscriptions')
 .select('plan_id, status')
 .eq('status', 'active'),

 // Conversion rate (signups with at least 1 workflow / total signups)
 supabase
 .from('profiles')
 .select('id')
 .gte('created_at', startDateISO)
 ]);

 // Extract counts safely
 const totalUsers = totalUsersResult.status === 'fulfilled' ? (totalUsersResult.value.count || 0) : 0;
 const activeUsers = activeUsersResult.status === 'fulfilled' ? (activeUsersResult.value.count || 0) : 0;
 const newSignups = newSignupsResult.status === 'fulfilled' ? (newSignupsResult.value.count || 0) : 0;

 // Activated users (unique user_ids with workflows)
 let activatedUsers = 0;
 if (activatedUsersResult.status === 'fulfilled' && activatedUsersResult.value.data) {
 const uniqueUserIds = new Set(activatedUsersResult.value.data.map(r => r.user_id));
 activatedUsers = uniqueUserIds.size;
 }

 const workflowsCreated = workflowsCreatedResult.status === 'fulfilled' ? (workflowsCreatedResult.value.count || 0) : 0;
 const workflowsRun = workflowsRunResult.status === 'fulfilled' ? (workflowsRunResult.value.count || 0) : 0;

 // Calculate MRR
 let mrr = 0;
 if (mrrResult.status === 'fulfilled' && mrrResult.value.data) {
 // Get plan pricing from plans table
 const planIds = [...new Set(mrrResult.value.data.map(s => s.plan_id))];
 const { data: plans } = await supabase
 .from('plans')
 .select('id, price_monthly')
 .in('id', planIds);

 const planPricing = {};
 if (plans) {
 plans.forEach(plan => {
 planPricing[plan.id] = plan.price_monthly || 0;
 });
 }

 mrrResult.value.data.forEach(sub => {
 mrr += planPricing[sub.plan_id] || 0;
 });
 }

 // Calculate activation rate
 const activationRate = newSignups > 0 ? (activatedUsers / newSignups * 100) : 0;

 // Calculate conversion rate (signups that created workflows)
 let conversionRate = 0;
 if (conversionRateResult.status === 'fulfilled' && conversionRateResult.value.data) {
 const signupIds = conversionRateResult.value.data.map(p => p.id);
 const { count: workflowsFromSignups } = await supabase
 .from('automation_tasks')
 .select('user_id', { count: 'exact' })
 .in('user_id', signupIds)
 .limit(1);

 const usersWithWorkflows = new Set();
 if (workflowsFromSignups > 0) {
 const { data: workflows } = await supabase
 .from('automation_tasks')
 .select('user_id')
 .in('user_id', signupIds);
 if (workflows) {
 workflows.forEach(w => usersWithWorkflows.add(w.user_id));
 }
 }

 conversionRate = signupIds.length > 0 ? (usersWithWorkflows.size / signupIds.length * 100) : 0;
 }

 res.json({
 source: 'realtime',
 timeframe: `${days}d`,
 metrics: {
 totalUsers,
 activeUsers,
 newSignups,
 activatedUsers,
 activationRate: parseFloat(activationRate.toFixed(2)),
 workflowsCreated,
 workflowsRun,
 mrr: parseFloat(mrr.toFixed(2)),
 conversionRate: parseFloat(conversionRate.toFixed(2)),
 avgWorkflowsPerUser: totalUsers > 0 ? parseFloat((workflowsCreated / totalUsers).toFixed(2)) : 0,
 avgRunsPerUser: totalUsers > 0 ? parseFloat((workflowsRun / totalUsers).toFixed(2)) : 0
 },
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/overview] Error:', error);
 res.status(500).json({ error: 'Failed to fetch business metrics', details: error.message });
 }
});

/**
 * GET /api/business-metrics/signups
 * Returns signup metrics over time
 * PRIVATE - Owner only
 */
router.get('/signups', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { timeframe = '30d', interval = 'day' } = req.query;
 const days = parseInt(timeframe.replace('d', '')) || 30;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);

 // Get signups grouped by interval
 const { data: signups, error } = await supabase
 .from('profiles')
 .select('created_at')
 .gte('created_at', startDate.toISOString())
 .order('created_at', { ascending: true });

 if (error) throw error;

 // Group by interval
 const grouped = {};
 signups.forEach(signup => {
 const date = new Date(signup.created_at);
 let key;
 if (interval === 'day') {
 key = date.toISOString().split('T')[0];
 } else if (interval === 'week') {
 const weekStart = new Date(date);
 weekStart.setDate(date.getDate() - date.getDay());
 key = weekStart.toISOString().split('T')[0];
 } else {
 key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
 }
 grouped[key] = (grouped[key] || 0) + 1;
 });

 // Convert to array format
 const series = Object.entries(grouped).map(([date, count]) => ({
 date,
 signups: count
 })).sort((a, b) => a.date.localeCompare(b.date));

 res.json({
 timeframe: `${days}d`,
 interval,
 series,
 total: signups.length,
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/signups] Error:', error);
 res.status(500).json({ error: 'Failed to fetch signup metrics', details: error.message });
 }
});

/**
 * GET /api/business-metrics/funnel
 * Returns conversion funnel metrics
 * PRIVATE - Owner only
 */
router.get('/funnel', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { timeframe = '30d' } = req.query;
 const days = parseInt(timeframe.replace('d', '')) || 30;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);

 // Get funnel data
 const [
 visitsResult,
 signupsResult,
 activatedResult,
 paidResult
 ] = await Promise.allSettled([
 // Visits (from marketing_events)
 supabase
 .from('marketing_events')
 .select('id', { count: 'exact', head: true })
 .eq('event_name', 'page_view')
 .gte('created_at', startDate.toISOString()),

 // Signups
 supabase
 .from('profiles')
 .select('id', { count: 'exact', head: true })
 .gte('created_at', startDate.toISOString()),

 // Activated (users with workflows)
 supabase
 .from('automation_tasks')
 .select('user_id')
 .eq('is_active', true)
 .gte('created_at', startDate.toISOString()),

 // Paid (users with active subscriptions)
 supabase
 .from('subscriptions')
 .select('user_id')
 .eq('status', 'active')
 ]);

 const visits = visitsResult.status === 'fulfilled' ? (visitsResult.value.count || 0) : 0;
 const signups = signupsResult.status === 'fulfilled' ? (signupsResult.value.count || 0) : 0;

 let activated = 0;
 if (activatedResult.status === 'fulfilled' && activatedResult.value.data) {
 activated = new Set(activatedResult.value.data.map(r => r.user_id)).size;
 }

 let paid = 0;
 if (paidResult.status === 'fulfilled' && paidResult.value.data) {
 paid = new Set(paidResult.value.data.map(s => s.user_id)).size;
 }

 const visitToSignup = visits > 0 ? parseFloat((signups / visits * 100).toFixed(2)) : 0;
 const signupToActivated = signups > 0 ? parseFloat((activated / signups * 100).toFixed(2)) : 0;
 const activatedToPaid = activated > 0 ? parseFloat((paid / activated * 100).toFixed(2)) : 0;

 res.json({
 timeframe: `${days}d`,
 funnel: {
 visits,
 signups,
 activated,
 paid,
 visitToSignup,
 signupToActivated,
 activatedToPaid,
 overallConversion: visits > 0 ? parseFloat((paid / visits * 100).toFixed(2)) : 0
 },
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/funnel] Error:', error);
 res.status(500).json({ error: 'Failed to fetch funnel metrics', details: error.message });
 }
});

/**
 * GET /api/business-metrics/revenue
 * Returns revenue metrics
 * PRIVATE - Owner only
 */
router.get('/revenue', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Get all active subscriptions
 const { data: subscriptions, error } = await supabase
 .from('subscriptions')
 .select('plan_id, status, created_at')
 .eq('status', 'active');

 if (error) throw error;

 // Get plan pricing
 const planIds = [...new Set(subscriptions.map(s => s.plan_id))];
 const { data: plans } = await supabase
 .from('plans')
 .select('id, price_monthly, name')
 .in('id', planIds);

 const planPricing = {};
 if (plans) {
 plans.forEach(plan => {
 planPricing[plan.id] = {
 price: plan.price_monthly || 0,
 name: plan.name
 };
 });
 }

 // Calculate MRR
 let mrr = 0;
 const planBreakdown = {};
 subscriptions.forEach(sub => {
 const plan = planPricing[sub.plan_id];
 if (plan) {
 const price = plan.price;
 mrr += price;
 planBreakdown[plan.name] = (planBreakdown[plan.name] || 0) + price;
 }
 });

 // Calculate ARR
 const arr = mrr * 12;

 // Count customers by plan
 const customersByPlan = {};
 subscriptions.forEach(sub => {
 const plan = planPricing[sub.plan_id];
 if (plan) {
 customersByPlan[plan.name] = (customersByPlan[plan.name] || 0) + 1;
 }
 });

 res.json({
 mrr: parseFloat(mrr.toFixed(2)),
 arr: parseFloat(arr.toFixed(2)),
 totalCustomers: subscriptions.length,
 planBreakdown,
 customersByPlan,
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/revenue] Error:', error);
 res.status(500).json({ error: 'Failed to fetch revenue metrics', details: error.message });
 }
});

/**
 * GET /api/business-metrics/analytics-health
 * Diagnostic endpoint to check analytics tracking health
 * Helps identify issues with signup tracking, feature usage, and login failures
 * PRIVATE - Owner only
 */
router.get('/analytics-health', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { days = 35 } = req.query;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - parseInt(days, 10));
 const startDateISO = startDate.toISOString();

 // Run all diagnostic queries in parallel
 const [
 // Signup diagnostics
 profilesResult,
 signupEventsResult,
 pendingConfirmationsResult,

 // Feature usage diagnostics
 marketingEventsResult,
 featureEventsResult,

 // Login diagnostics
 loginEventsResult,
 authLogsResult,

 // Time to first workflow
 firstWorkflowResult
 ] = await Promise.allSettled([
 // 1. Profiles created in timeframe
 supabase
 .from('profiles')
 .select('id, created_at, email_confirmed_at')
 .gte('created_at', startDateISO)
 .order('created_at', { ascending: false }),

 // 2. Signup events tracked in marketing_events
 supabase
 .from('marketing_events')
 .select('id, event_name, created_at, properties')
 .in('event_name', ['user_signup', 'user_signup_converted', 'signup'])
 .gte('created_at', startDateISO)
 .order('created_at', { ascending: false }),

 // 3. Check for unconfirmed emails (Supabase auth.users - may need admin access)
 supabase
 .from('profiles')
 .select('id, created_at')
 .is('email_confirmed_at', null)
 .gte('created_at', startDateISO),

 // 4. All marketing events for feature analysis
 supabase
 .from('marketing_events')
 .select('event_name, created_at')
 .gte('created_at', startDateISO),

 // 5. Feature-specific events (include both feature_* events and feature_used events)
 supabase
 .from('marketing_events')
 .select('event_name, properties, created_at')
 .or('event_name.like.feature_%,event_name.eq.feature_used')
 .gte('created_at', startDateISO),

 // 6. Login events
 supabase
 .from('marketing_events')
 .select('event_name, created_at, properties')
 .in('event_name', ['user_login', 'login', 'login_success', 'login_failed'])
 .gte('created_at', startDateISO)
 .order('created_at', { ascending: true }),

 // 7. Auth audit logs
 supabase
 .from('audit_logs')
 .select('action, details, timestamp, ip_address')
 .eq('action_type', 'authentication')
 .gte('timestamp', startDateISO)
 .order('timestamp', { ascending: true }),

 // 8. Time to first workflow (users with their first workflow creation time)
 supabase
 .from('automation_tasks')
 .select('user_id, created_at')
 .gte('created_at', startDateISO)
 .order('created_at', { ascending: true })
 ]);

 // Process signup diagnostics
 const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value.data || [] : [];
 const signupEvents = signupEventsResult.status === 'fulfilled' ? signupEventsResult.value.data || [] : [];
 const pendingConfirmations = pendingConfirmationsResult.status === 'fulfilled' ? pendingConfirmationsResult.value.data || [] : [];

 // Process feature usage
 const allEvents = marketingEventsResult.status === 'fulfilled' ? marketingEventsResult.value.data || [] : [];
 const featureEvents = featureEventsResult.status === 'fulfilled' ? featureEventsResult.value.data || [] : [];

 // Aggregate event counts
 const eventCounts = {};
 allEvents.forEach(e => {
 eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
 });

 // Find most used feature
 const featureCounts = {};
 featureEvents.forEach(e => {
 // Handle feature_used events with properties.feature
 let featureName = null;
 if (e.event_name === 'feature_used' && e.properties?.feature) {
 featureName = e.properties.feature;
 } else if (e.event_name.startsWith('feature_')) {
 featureName = e.event_name.replace('feature_', '').replace(/_/g, ' ');
 }

 // Only count if we have a valid feature name
 if (featureName) {
 featureCounts[featureName] = (featureCounts[featureName] || 0) + 1;
 }
 });

 const sortedFeatures = Object.entries(featureCounts)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10);

 // Process login diagnostics
 const loginEvents = loginEventsResult.status === 'fulfilled' ? loginEventsResult.value.data || [] : [];
 const authLogs = authLogsResult.status === 'fulfilled' ? authLogsResult.value.data || [] : [];

 // Group logins by day
 const loginsByDay = {};
 loginEvents.forEach(e => {
 const day = e.created_at.split('T')[0];
 if (!loginsByDay[day]) {
 loginsByDay[day] = { success: 0, failed: 0, total: 0 };
 }
 loginsByDay[day].total++;
 if (e.event_name.includes('success') || e.event_name === 'user_login') {
 loginsByDay[day].success++;
 } else {
 loginsByDay[day].failed++;
 }
 });

 // Also check audit logs for login failures
 const authLogsByDay = {};
 authLogs.forEach(log => {
 const day = log.timestamp.split('T')[0];
 if (!authLogsByDay[day]) {
 authLogsByDay[day] = { success: 0, failed: 0, total: 0 };
 }
 authLogsByDay[day].total++;
 if (log.details?.success === true) {
 authLogsByDay[day].success++;
 } else {
 authLogsByDay[day].failed++;
 }
 });

 // Process time to first workflow
 const workflows = firstWorkflowResult.status === 'fulfilled' ? firstWorkflowResult.value.data || [] : [];

 // Calculate average time to first workflow per user
 const userFirstWorkflow = {};
 workflows.forEach(w => {
 if (!userFirstWorkflow[w.user_id]) {
 userFirstWorkflow[w.user_id] = new Date(w.created_at);
 }
 });

 // Build diagnostic report
 const diagnostics = {
 timeframe: `${days}d`,
 generated_at: new Date().toISOString(),

 signup_health: {
 profiles_created: profiles.length,
 signup_events_tracked: signupEvents.length,
 pending_email_confirmations: pendingConfirmations.length,
 tracking_gap: profiles.length - signupEvents.length,
 issue_detected: profiles.length > 0 && signupEvents.length === 0
 ? 'CRITICAL: Signups happening but not being tracked in marketing_events'
 : pendingConfirmations.length > profiles.length * 0.5
 ? 'WARNING: Many users have unconfirmed emails - check email delivery'
 : profiles.length === 0
 ? 'INFO: No new signups in timeframe - may be marketing/traffic issue'
 : 'OK',
 recent_signups: profiles.slice(0, 5).map(p => ({
 id: p.id.substring(0, 8) + '...',
 created_at: p.created_at,
 email_confirmed: !!p.email_confirmed_at
 }))
 },

 feature_tracking: {
 total_events_tracked: allEvents.length,
 unique_event_types: Object.keys(eventCounts).length,
 feature_events_count: featureEvents.length,
 most_used_features: sortedFeatures.length > 0
 ? sortedFeatures.map(([name, count]) => ({ feature: name, count }))
 : [{ feature: 'None', count: 0, note: 'No feature_* events tracked' }],
 issue_detected: featureEvents.length === 0
 ? 'CRITICAL: No feature usage events being tracked - add trackEvent calls for features'
 : 'OK',
 top_events: Object.entries(eventCounts)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10)
 .map(([name, count]) => ({ event: name, count }))
 },

 login_health: {
 total_login_events: loginEvents.length,
 total_auth_logs: authLogs.length,
 by_day_events: loginsByDay,
 by_day_audit: authLogsByDay,
 days_with_failures: Object.entries(authLogsByDay)
 .filter(([_, data]) => data.failed > 0)
 .map(([day, data]) => ({
 date: day,
 failed: data.failed,
 success: data.success,
 success_rate: data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) + '%' : 'N/A'
 })),
 issue_detected: Object.values(authLogsByDay).some(d => d.failed > 0 && d.success === 0)
 ? 'CRITICAL: Days with 0% login success rate detected'
 : 'OK'
 },

 time_to_first_workflow: {
 users_with_workflows: Object.keys(userFirstWorkflow).length,
 note: 'To calculate accurate time-to-first-workflow, need to join with user signup times'
 },

 recommendations: []
 };

 // Add recommendations based on findings
 if (diagnostics.signup_health.issue_detected !== 'OK') {
 diagnostics.recommendations.push({
 priority: 'HIGH',
 issue: 'Signup tracking',
 action: diagnostics.signup_health.issue_detected
 });
 }

 if (diagnostics.feature_tracking.issue_detected !== 'OK') {
 diagnostics.recommendations.push({
 priority: 'HIGH',
 issue: 'Feature tracking',
 action: 'Add trackEvent({ event_name: "feature_used", properties: { feature: "feature_name" } }) calls when users interact with features'
 });
 }

 if (diagnostics.login_health.issue_detected !== 'OK') {
 diagnostics.recommendations.push({
 priority: 'CRITICAL',
 issue: 'Login failures',
 action: 'Check audit_logs for specific error details on failed login days'
 });
 }

 res.json(diagnostics);
 } catch (error) {
 logger.error('[GET /api/business-metrics/analytics-health] Error:', error);
 res.status(500).json({ error: 'Failed to run analytics health check', details: error.message });
 }
});

/**
 * GET /api/business-metrics/feature-usage
 * Returns aggregated feature usage data
 * PRIVATE - Owner only
 */
router.get('/feature-usage', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { days = 30 } = req.query;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - parseInt(days, 10));

 // Get all feature-related events
 const { data: events, error } = await supabase
 .from('marketing_events')
 .select('event_name, properties, user_id, created_at')
 .gte('created_at', startDate.toISOString())
 .order('created_at', { ascending: false });

 if (error) throw error;

 // Categorize events into features
 const featureMap = {
 // Workflow features
 'workflow_created': 'Workflow Builder',
 'workflow_run': 'Workflow Execution',
 'workflow_saved': 'Workflow Builder',
 'workflow_deleted': 'Workflow Builder',

 // Automation features
 'automation_started': 'Automation Runner',
 'automation_completed': 'Automation Runner',
 'task_created': 'Task Management',

 // Integration features
 'integration_connected': 'Integrations',
 'webhook_created': 'Webhooks',

 // Analytics features
 'analytics_viewed': 'Analytics Dashboard',
 'roi_dashboard_viewed': 'ROI Analytics',

 // Template features
 'template_used': 'Templates',
 'template_created': 'Template Builder',

 // Feature-prefixed events
 'feature_used': 'dynamic' // Will use properties.feature
 };

 const featureUsage = {};
 const dailyUsage = {};
 const userFeatureUsage = {};

 events.forEach(event => {
 let featureName = featureMap[event.event_name];

 // Handle dynamic feature names
 if (event.event_name === 'feature_used' && event.properties?.feature) {
 featureName = event.properties.feature;
 } else if (event.event_name.startsWith('feature_')) {
 featureName = event.event_name.replace('feature_', '').replace(/_/g, ' ');
 }

 if (!featureName) {
 // Try to infer feature from event name
 if (event.event_name.includes('workflow')) featureName = 'Workflow Builder';
 else if (event.event_name.includes('automation')) featureName = 'Automation Runner';
 else if (event.event_name.includes('template')) featureName = 'Templates';
 else if (event.event_name.includes('integration')) featureName = 'Integrations';
 else featureName = 'Other';
 }

 // Aggregate by feature
 featureUsage[featureName] = (featureUsage[featureName] || 0) + 1;

 // Aggregate by day
 const day = event.created_at.split('T')[0];
 if (!dailyUsage[day]) dailyUsage[day] = {};
 dailyUsage[day][featureName] = (dailyUsage[day][featureName] || 0) + 1;

 // Track unique users per feature
 if (event.user_id) {
 if (!userFeatureUsage[featureName]) userFeatureUsage[featureName] = new Set();
 userFeatureUsage[featureName].add(event.user_id);
 }
 });

 // Sort features by usage
 const sortedFeatures = Object.entries(featureUsage)
 .sort((a, b) => b[1] - a[1])
 .map(([feature, count]) => ({
 feature,
 total_uses: count,
 unique_users: userFeatureUsage[feature]?.size || 0
 }));

 // Get most used feature per day
 const dailyMostUsed = Object.entries(dailyUsage).map(([day, features]) => {
 const sorted = Object.entries(features).sort((a, b) => b[1] - a[1]);
 return {
 date: day,
 most_used_feature: sorted[0]?.[0] || 'None',
 usage_count: sorted[0]?.[1] || 0
 };
 }).sort((a, b) => b.date.localeCompare(a.date));

 res.json({
 timeframe: `${days}d`,
 total_events: events.length,
 features: sortedFeatures,
 most_used_overall: sortedFeatures[0]?.feature || 'None',
 daily_most_used: dailyMostUsed,
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/feature-usage] Error:', error);
 res.status(500).json({ error: 'Failed to fetch feature usage', details: error.message });
 }
});

/**
 * GET /api/business-metrics/time-to-first-workflow
 * Calculate average time from signup to first workflow creation
 * PRIVATE - Owner only
 */
router.get('/time-to-first-workflow', authMiddleware, requireOwner, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { days = 90 } = req.query;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - parseInt(days, 10));

 // Get all users with their signup time and first workflow creation time
 const [profilesResult, workflowsResult] = await Promise.allSettled([
 supabase
 .from('profiles')
 .select('id, created_at')
 .gte('created_at', startDate.toISOString())
 .order('created_at', { ascending: true }),
 supabase
 .from('automation_tasks')
 .select('user_id, created_at')
 .gte('created_at', startDate.toISOString())
 .order('created_at', { ascending: true })
 ]);

 const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value.data || [] : [];
 const workflows = workflowsResult.status === 'fulfilled' ? workflowsResult.value.data || [] : [];

 // Build map of user_id -> first workflow creation time
 const userFirstWorkflow = {};
 workflows.forEach(w => {
 if (!userFirstWorkflow[w.user_id]) {
 userFirstWorkflow[w.user_id] = new Date(w.created_at);
 }
 });

 // Calculate time to first workflow for each user
 const timeToFirstWorkflowData = [];
 let totalSeconds = 0;
 let usersWithWorkflow = 0;
 let usersWithoutWorkflow = 0;

 profiles.forEach(profile => {
 const signupTime = new Date(profile.created_at);
 const firstWorkflowTime = userFirstWorkflow[profile.id];

 if (firstWorkflowTime) {
 const diffSeconds = (firstWorkflowTime - signupTime) / 1000;
 // Only count if workflow was created after signup (sanity check)
 if (diffSeconds >= 0) {
 timeToFirstWorkflowData.push({
 user_id: profile.id.substring(0, 8) + '...',
 signup_time: profile.created_at,
 first_workflow_time: firstWorkflowTime.toISOString(),
 time_to_first_workflow_seconds: diffSeconds,
 time_to_first_workflow_minutes: (diffSeconds / 60).toFixed(1)
 });
 totalSeconds += diffSeconds;
 usersWithWorkflow++;
 }
 } else {
 usersWithoutWorkflow++;
 }
 });

 const avgSeconds = usersWithWorkflow > 0 ? totalSeconds / usersWithWorkflow : 0;
 const avgMinutes = avgSeconds / 60;

 // Calculate percentiles
 const sortedTimes = timeToFirstWorkflowData
 .map(d => d.time_to_first_workflow_seconds)
 .sort((a, b) => a - b);

 const p50 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.5)] : 0;
 const p75 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.75)] : 0;
 const p90 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.9)] : 0;

 res.json({
 timeframe: `${days}d`,
 total_users: profiles.length,
 users_with_workflow: usersWithWorkflow,
 users_without_workflow: usersWithoutWorkflow,
 conversion_rate: profiles.length > 0
 ? ((usersWithWorkflow / profiles.length) * 100).toFixed(1) + '%'
 : 'N/A',
 average_time_to_first_workflow: {
 seconds: avgSeconds.toFixed(1),
 minutes: avgMinutes.toFixed(1),
 formatted: avgMinutes < 60
 ? `${avgMinutes.toFixed(1)} minutes`
 : `${(avgMinutes / 60).toFixed(1)} hours`
 },
 percentiles: {
 p50_seconds: p50.toFixed(1),
 p50_minutes: (p50 / 60).toFixed(1),
 p75_seconds: p75.toFixed(1),
 p75_minutes: (p75 / 60).toFixed(1),
 p90_seconds: p90.toFixed(1),
 p90_minutes: (p90 / 60).toFixed(1)
 },
 recommendations: avgMinutes > 5 ? [
 {
 priority: 'HIGH',
 issue: 'High time to first workflow',
 action: 'Consider adding onboarding wizard, pre-built templates, or guided tour to reduce friction'
 }
 ] : [],
 sample_data: timeToFirstWorkflowData.slice(0, 10),
 timestamp: new Date().toISOString()
 });
 } catch (error) {
 logger.error('[GET /api/business-metrics/time-to-first-workflow] Error:', error);
 res.status(500).json({ error: 'Failed to calculate time to first workflow', details: error.message });
 }
});

/**
 * GET /api/business-metrics/marketing-events
 * Returns comprehensive marketing events analytics including signup funnel, A/B test performance, and failure rates
 * PRIVATE - Owner only
 */
router.get('/marketing-events', authMiddleware, requireOwner, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { days = 30, event_type } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    // Get all marketing events in timeframe
    let query = supabase
      .from('marketing_events')
      .select('id, event_name, properties, user_id, created_at, utm')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (event_type) {
      query = query.eq('event_name', event_type);
    }

    const { data: events, error } = await query;

    if (error) throw error;

    // Signup funnel events
    const signupEvents = {
      form_viewed: events.filter(e => e.event_name === 'signup_form_viewed'),
      attempt: events.filter(e => e.event_name === 'signup_attempt'),
      validation_error: events.filter(e => e.event_name === 'signup_validation_error'),
      failure: events.filter(e => e.event_name === 'signup_failure'),
      success: events.filter(e => e.event_name === 'signup_success')
    };

    // Calculate funnel metrics
    const funnelMetrics = {
      views: signupEvents.form_viewed.length,
      attempts: signupEvents.attempt.length,
      validation_errors: signupEvents.validation_error.length,
      failures: signupEvents.failure.length,
      successes: signupEvents.success.length,
      conversion_rate: signupEvents.form_viewed.length > 0 
        ? ((signupEvents.success.length / signupEvents.form_viewed.length) * 100).toFixed(2)
        : '0.00',
      failure_rate: signupEvents.attempt.length > 0
        ? ((signupEvents.failure.length / signupEvents.attempt.length) * 100).toFixed(2)
        : '0.00'
    };

    // A/B test performance
    const abTestEvents = events.filter(e => 
      e.event_name === 'ab_test_viewed' || 
      (e.properties && e.properties.variant)
    );

    const abTestMetrics = {};
    abTestEvents.forEach(event => {
      const testName = event.properties?.test_name || 'signup_form';
      const variant = event.properties?.variant || 'A';
      
      if (!abTestMetrics[testName]) {
        abTestMetrics[testName] = { A: { views: 0, conversions: 0 }, B: { views: 0, conversions: 0 } };
      }
      
      if (event.event_name === 'ab_test_viewed') {
        abTestMetrics[testName][variant].views = (abTestMetrics[testName][variant].views || 0) + 1;
      }
      
      // Count conversions (signup_success) by variant
      if (event.event_name === 'signup_success' && event.properties?.variant) {
        const successVariant = event.properties.variant;
        if (abTestMetrics[testName][successVariant]) {
          abTestMetrics[testName][successVariant].conversions = (abTestMetrics[testName][successVariant].conversions || 0) + 1;
        }
      }
    });

    // Calculate conversion rates for A/B tests
    Object.keys(abTestMetrics).forEach(testName => {
      ['A', 'B'].forEach(variant => {
        const metrics = abTestMetrics[testName][variant];
        metrics.conversion_rate = metrics.views > 0 
          ? ((metrics.conversions / metrics.views) * 100).toFixed(2)
          : '0.00';
      });
    });

    // Failure breakdown by error type
    const failureBreakdown = {};
    signupEvents.failure.forEach(event => {
      const errorType = event.properties?.error_type || 'unknown_error';
      failureBreakdown[errorType] = (failureBreakdown[errorType] || 0) + 1;
    });

    // Daily breakdown for time series
    const dailyBreakdown = {};
    events.forEach(event => {
      const date = event.created_at.split('T')[0];
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          date,
          form_viewed: 0,
          attempts: 0,
          failures: 0,
          successes: 0
        };
      }
      
      if (event.event_name === 'signup_form_viewed') dailyBreakdown[date].form_viewed++;
      if (event.event_name === 'signup_attempt') dailyBreakdown[date].attempts++;
      if (event.event_name === 'signup_failure') dailyBreakdown[date].failures++;
      if (event.event_name === 'signup_success') dailyBreakdown[date].successes++;
    });

    const dailyData = Object.values(dailyBreakdown).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // UTM source breakdown
    const utmBreakdown = {};
    events.forEach(event => {
      const utmSource = event.utm?.utm_source || event.properties?.utm_source || 'direct';
      if (!utmBreakdown[utmSource]) {
        utmBreakdown[utmSource] = { views: 0, conversions: 0 };
      }
      if (event.event_name === 'signup_form_viewed') utmBreakdown[utmSource].views++;
      if (event.event_name === 'signup_success') utmBreakdown[utmSource].conversions++;
    });

    // Calculate conversion rates for UTM sources
    Object.keys(utmBreakdown).forEach(source => {
      const metrics = utmBreakdown[source];
      metrics.conversion_rate = metrics.views > 0
        ? ((metrics.conversions / metrics.views) * 100).toFixed(2)
        : '0.00';
    });

    // Failure rate alerts (threshold: 20%)
    const failureRate = parseFloat(funnelMetrics.failure_rate);
    const alerts = [];
    
    if (failureRate > 20) {
      alerts.push({
        type: 'high_failure_rate',
        severity: 'critical',
        message: `Signup failure rate is ${failureRate.toFixed(1)}% (threshold: 20%)`,
        failure_rate: failureRate.toFixed(2),
        threshold: 20,
        failures: signupEvents.failure.length,
        attempts: signupEvents.attempt.length
      });
    }

    // Check for specific error type spikes
    Object.entries(failureBreakdown).forEach(([errorType, count]) => {
      const errorRate = (count / signupEvents.failure.length) * 100;
      if (errorRate > 40 && count > 5) {
        alerts.push({
          type: 'error_type_spike',
          severity: 'warning',
          message: `${errorType} accounts for ${errorRate.toFixed(1)}% of failures`,
          error_type: errorType,
          count,
          percentage: errorRate.toFixed(2)
        });
      }
    });

    return res.json({
      timeframe_days: parseInt(days, 10),
      summary: {
        total_events: events.length,
        ...funnelMetrics
      },
      funnel: funnelMetrics,
      ab_tests: abTestMetrics,
      failure_breakdown: failureBreakdown,
      daily_breakdown: dailyData,
      utm_breakdown: utmBreakdown,
      alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[GET /api/business-metrics/marketing-events] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch marketing events analytics', 
      details: error.message 
    });
  }
});

module.exports = router;

