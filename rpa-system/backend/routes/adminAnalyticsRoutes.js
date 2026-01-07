/**
 * Internal Admin Analytics Routes
 * Provides insights into what ALL users are doing with EasyFlow
 * This addresses Pain Point #4: "Not knowing what users do with your product"
 *
 * Access: Admin-only (requires admin role or special permission)
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('routes.adminAnalytics');

// Simple admin check - in production, use proper role-based access control
const isAdmin = (req) => {
 // Check if user has admin role in profile or special admin email
 const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
 return req.user?.email && adminEmails.includes(req.user.email);
};

/**
 * GET /api/admin/analytics/overview
 * Get high-level overview of all user activity
 */
router.get('/overview', async (req, res) => {
 try {
 if (!req.user?.id) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 if (!isAdmin(req)) {
 return res.status(403).json({ error: 'Admin access required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Get total users
 const { count: totalUsers } = await supabase
 .from('profiles')
 .select('id', { count: 'exact', head: true });

 // Get active users (users with runs in last 30 days)
 const thirtyDaysAgo = new Date();
 thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

 const { data: activeUsersData } = await supabase
 .from('automation_runs')
 .select('user_id')
 .gte('created_at', thirtyDaysAgo.toISOString())
 .not('user_id', 'is', null);

 const activeUserIds = [...new Set((activeUsersData || []).map(r => r.user_id))];
 const activeUsers = activeUserIds.length;

 // Get total workflows created
 const { count: totalWorkflows } = await supabase
 .from('automation_tasks')
 .select('id', { count: 'exact', head: true });

 // Get total runs executed
 const { count: totalRuns } = await supabase
 .from('automation_runs')
 .select('id', { count: 'exact', head: true });

 // Get most popular templates
 const { data: popularTemplates } = await supabase
 .from('workflow_templates')
 .select('id, name, usage_count, rating')
 .eq('is_public', true)
 .order('usage_count', { ascending: false })
 .limit(10);

 // Get most used integrations
 const { data: integrations } = await supabase
 .from('integration_credentials')
 .select('integration_type')
 .not('integration_type', 'is', null);

 const integrationCounts = {};
 (integrations || []).forEach(cred => {
 const type = cred.integration_type;
 integrationCounts[type] = (integrationCounts[type] || 0) + 1;
 });

 // Get failure rate
 const { count: failedRuns } = await supabase
 .from('automation_runs')
 .select('id', { count: 'exact', head: true })
 .eq('status', 'failed');

 const failureRate = totalRuns > 0 ? ((failedRuns || 0) / totalRuns * 100).toFixed(1) : 0;

 res.json({
 overview: {
 totalUsers: totalUsers || 0,
 activeUsers,
 totalWorkflows: totalWorkflows || 0,
 totalRuns: totalRuns || 0,
 failureRate: parseFloat(failureRate),
 activeUserRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
 },
 popularTemplates: (popularTemplates || []).map(t => ({
 name: t.name,
 usageCount: t.usage_count || 0,
 rating: t.rating || 0
 })),
 integrationUsage: Object.entries(integrationCounts)
 .map(([type, count]) => ({ type, count }))
 .sort((a, b) => b.count - a.count)
 });
 } catch (err) {
 logger.error('Error in GET /api/admin/analytics/overview:', err);
 res.status(500).json({ error: 'Failed to fetch admin analytics' });
 }
});

/**
 * GET /api/admin/analytics/user-activity
 * Get detailed user activity breakdown
 */
router.get('/user-activity', async (req, res) => {
 try {
 if (!req.user?.id) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 if (!isAdmin(req)) {
 return res.status(403).json({ error: 'Admin access required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { days = 30 } = req.query;
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - parseInt(days, 10));

 // Get user activity breakdown
 const { data: userActivity } = await supabase
 .from('automation_runs')
 .select('user_id, status, created_at')
 .gte('created_at', startDate.toISOString());

 // Group by user
 const userStats = {};
 (userActivity || []).forEach(run => {
 if (!userStats[run.user_id]) {
 userStats[run.user_id] = {
 totalRuns: 0,
 completedRuns: 0,
 failedRuns: 0,
 lastActivity: run.created_at
 };
 }
 userStats[run.user_id].totalRuns++;
 if (run.status === 'completed') userStats[run.user_id].completedRuns++;
 if (run.status === 'failed') userStats[run.user_id].failedRuns++;
 if (new Date(run.created_at) > new Date(userStats[run.user_id].lastActivity)) {
 userStats[run.user_id].lastActivity = run.created_at;
 }
 });

 // Get user emails for context
 const userIds = Object.keys(userStats);
 const { data: profiles } = await supabase
 .from('profiles')
 .select('id, email, plan_id')
 .in('id', userIds);

 const profileMap = {};
 (profiles || []).forEach(p => {
 profileMap[p.id] = { email: p.email, plan: p.plan_id };
 });

 // Format response
 const activityData = Object.entries(userStats).map(([userId, stats]) => ({
 userId,
 email: profileMap[userId]?.email || 'Unknown',
 plan: profileMap[userId]?.plan || 'Unknown',
 ...stats,
 successRate: stats.totalRuns > 0 ? ((stats.completedRuns / stats.totalRuns) * 100).toFixed(1) : 0
 })).sort((a, b) => b.totalRuns - a.totalRuns);

 res.json({
 period: `${days} days`,
 totalActiveUsers: activityData.length,
 userActivity: activityData
 });
 } catch (err) {
 logger.error('Error in GET /api/admin/analytics/user-activity:', err);
 res.status(500).json({ error: 'Failed to fetch user activity' });
 }
});

/**
 * GET /api/admin/analytics/workflow-usage
 * See which workflows/templates are most popular
 */
router.get('/workflow-usage', async (req, res) => {
 try {
 if (!req.user?.id) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 if (!isAdmin(req)) {
 return res.status(403).json({ error: 'Admin access required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Get most used automation tasks
 const { data: tasks } = await supabase
 .from('automation_tasks')
 .select('id, name, url, task_type, user_id, created_at')
 .order('created_at', { ascending: false })
 .limit(100);

 // Group by task type
 const taskTypeCounts = {};
 (tasks || []).forEach(task => {
 const type = task.task_type || 'unknown';
 taskTypeCounts[type] = (taskTypeCounts[type] || 0) + 1;
 });

 // Get template usage
 const { data: templates } = await supabase
 .from('workflow_templates')
 .select('id, name, usage_count, category')
 .eq('is_public', true)
 .order('usage_count', { ascending: false })
 .limit(20);

 res.json({
 taskTypeBreakdown: Object.entries(taskTypeCounts)
 .map(([type, count]) => ({ type, count }))
 .sort((a, b) => b.count - a.count),
 popularTemplates: (templates || []).map(t => ({
 name: t.name,
 category: t.category,
 usageCount: t.usage_count || 0
 }))
 });
 } catch (err) {
 logger.error('Error in GET /api/admin/analytics/workflow-usage:', err);
 res.status(500).json({ error: 'Failed to fetch workflow usage' });
 }
});

module.exports = router;

