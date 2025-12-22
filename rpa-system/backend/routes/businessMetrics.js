const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');
const metricsCacheService = require('../services/metricsCacheService');

/**
 * Business Metrics API Routes
 * Provides comprehensive business KPIs for EasyFlow
 * Used by Grafana dashboards and business intelligence tools
 */

/**
 * GET /api/business-metrics/overview
 * Returns high-level business metrics overview
 * Uses cached metrics from easyflow-metrics/latest_metrics.json when available
 */
router.get('/overview', async (req, res) => {
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
 */
router.get('/signups', async (req, res) => {
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
 */
router.get('/funnel', async (req, res) => {
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
 */
router.get('/revenue', async (req, res) => {
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

module.exports = router;

