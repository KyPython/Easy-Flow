
const { logger } = require('../utils/logger');
/**
 * Founder Metrics Dashboard - Rockefeller Operating System
 *
 * This is your daily command center. Check these metrics every morning.
 * Based on Rockefeller's principle: "Know your numbers better than anyone."
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { auditLogger } = require('../utils/auditLogger');

/**
 * GET /api/founder/dashboard
 * The main daily metrics dashboard - your morning ritual
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin' || req.user?.email === process.env.FOUNDER_EMAIL;

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { timeframe = 'today' } = req.query;
    const now = new Date();

    // Calculate date ranges
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // CORE METRIC 1: New Signups
    const { data: signupsToday, error: signupsTodayError } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', today.toISOString());

    const { data: signupsLast7Days, error: signups7Error } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: signupsLast30Days, error: signups30Error } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // CORE METRIC 2: Active Users (created workflow in last 30 days)
    const { count: activeUsers } = await supabase
      .from('automation_executions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // CORE METRIC 3: Activation Rate (% who create first workflow)
    const { data: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { data: activatedUsers } = await supabase
      .from('automation_executions')
      .select('user_id', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo.toISOString());

    const activationRate = totalUsers?.length > 0
      ? Math.round((activatedUsers?.length / totalUsers.length) * 100)
      : 0;

    // CORE METRIC 4: Revenue (MRR) - Admin only
    let mrr = 0;
    let payingCustomers = 0;
    if (isAdmin) {
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('amount, status')
        .eq('status', 'active');

      mrr = subscriptions?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0;
      payingCustomers = subscriptions?.length || 0;
    }

    // CORE METRIC 5: Daily Workflow Executions
    const { count: executionsToday } = await supabase
      .from('automation_executions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // CORE METRIC 6: Conversion Funnel Health
    const { data: signupsYesterday } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    const { data: activatedYesterday } = await supabase
      .from('automation_executions')
      .select('user_id')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    const yesterdayActivationRate = signupsYesterday?.length > 0
      ? Math.round((activatedYesterday?.length / signupsYesterday.length) * 100)
      : 0;

    // SUPPORTING METRICS
    const { data: supportTickets } = await supabase
      .from('feedback')
      .select('id, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    const openTickets = supportTickets?.filter(t => !t.resolved).length || 0;

    // Calculate 7-day average signup rate
    const sevenDayAvgSignups = signupsLast7Days?.length
      ? Math.round(signupsLast7Days.length / 7)
      : 0;

    // Calculate 30-day average signup rate
    const thirtyDayAvgSignups = signupsLast30Days?.length
      ? Math.round(signupsLast30Days.length / 30)
      : 0;

    // DAU/MAU Ratio (engagement score)
    const dauMauRatio = activeUsers > 0 && totalUsers?.length > 0
      ? Math.round((activeUsers / totalUsers.length) * 100)
      : 0;

    const dashboard = {
      // The 5 Numbers You Check Every Morning
      daily_metrics: {
        new_signups_today: signupsToday?.length || 0,
        seven_day_avg: sevenDayAvgSignups,
        thirty_day_avg: thirtyDayAvgSignups,
        activation_rate: activationRate,
        mrr: isAdmin ? mrr : null,
        paying_customers: isAdmin ? payingCustomers : null,
        active_users: activeUsers || 0,
        workflow_executions_today: executionsToday || 0
      },

      // Trends (Are we going up or down?)
      trends: {
        signup_trend: sevenDayAvgSignups > thirtyDayAvgSignups ? 'up' : 'down',
        activation_trend: yesterdayActivationRate > activationRate ? 'down' : 'up',
        engagement_score: dauMauRatio
      },

      // Health Indicators (Red flags to watch)
      health: {
        activation_status: activationRate >= 40 ? 'healthy' : activationRate >= 25 ? 'warning' : 'critical',
        growth_status: sevenDayAvgSignups >= 5 ? 'healthy' : sevenDayAvgSignups >= 3 ? 'warning' : 'critical',
        engagement_status: dauMauRatio >= 20 ? 'healthy' : dauMauRatio >= 10 ? 'warning' : 'critical'
      },

      // Support Metrics
      support: {
        open_tickets: openTickets,
        total_tickets_7d: supportTickets?.length || 0
      },

      // Quarterly Progress (if admin)
      quarterly_progress: isAdmin ? {
        q4_goal: 'Get First 5 Paying Customers at $50-100/mo',
        current_paying: payingCustomers,
        progress_percent: Math.round((payingCustomers / 5) * 100),
        on_track: payingCustomers >= 1 // At least 1 by now
      } : null,

      generated_at: new Date().toISOString(),
      last_checked: new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    };

    // Log dashboard access
    if (userId) {
      await auditLogger.logDataAccess(userId, 'founder_dashboard', 'read', {
        timeframe,
        is_admin: isAdmin
      });
    }

    res.json(dashboard);

  } catch (error) {
    logger.error('Founder dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load founder dashboard',
      details: error.message
    });
  }
});

/**
 * GET /api/founder/daily-checklist
 * The Rockefeller Daily Checklist - track your daily habits
 */
router.get('/daily-checklist', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const supabase = getSupabase();

    // Get today's checklist status
    const { data: checklistData, error } = await supabase
      .from('founder_checklists')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    const defaultChecklist = {
      date,
      items: {
        morning_metrics_reviewed: false,
        efficiency_improvement_identified: false,
        competitive_intelligence_checked: false,
        customer_feedback_reviewed: false,
        values_applied_to_decision: false,
        strategy_articulated: false,
        evening_log_completed: false,
        tomorrow_priority_set: false
      },
      priority_task: null,
      moved_closer_to_goal: null,
      daily_learning: null
    };

    res.json(checklistData || defaultChecklist);

  } catch (error) {
    logger.error('Daily checklist error:', error);
    res.status(500).json({ error: 'Failed to load daily checklist' });
  }
});

/**
 * POST /api/founder/daily-checklist
 * Update daily checklist progress
 */
router.post('/daily-checklist', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { date, items, priority_task, moved_closer_to_goal, daily_learning } = req.body;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('founder_checklists')
      .upsert({
        user_id: userId,
        date: date || new Date().toISOString().split('T')[0],
        items,
        priority_task,
        moved_closer_to_goal,
        daily_learning,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'update_daily_checklist', {
      date,
      items_completed: Object.values(items).filter(Boolean).length
    }, req);

    res.json({ success: true, checklist: data });

  } catch (error) {
    logger.error('Failed to update daily checklist:', error);
    res.status(500).json({ error: 'Failed to update checklist' });
  }
});

/**
 * GET /api/founder/weekly-summary
 * Weekly summary of progress - for Monday morning reviews
 */
router.get('/weekly-summary', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get week's checklist completion
    const { data: checklists } = await supabase
      .from('founder_checklists')
      .select('*')
      .eq('user_id', userId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Calculate completion rate
    let totalItems = 0;
    let completedItems = 0;

    checklists?.forEach(checklist => {
      const items = Object.values(checklist.items || {});
      totalItems += items.length;
      completedItems += items.filter(Boolean).length;
    });

    const completionRate = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    // Get week's key metrics
    const { data: signupsThisWeek } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: executionsThisWeek } = await supabase
      .from('automation_executions')
      .select('id', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    const summary = {
      week_ending: new Date().toISOString().split('T')[0],
      days_tracked: checklists?.length || 0,
      checklist_completion_rate: completionRate,
      key_metrics: {
        new_signups: signupsThisWeek?.length || 0,
        workflow_executions: executionsThisWeek?.length || 0
      },
      daily_learnings: checklists?.map(c => ({
        date: c.date,
        learning: c.daily_learning,
        moved_closer_to_goal: c.moved_closer_to_goal
      })) || [],
      streak: completionRate >= 80 ? 'strong' : completionRate >= 60 ? 'moderate' : 'needs_improvement'
    };

    res.json(summary);

  } catch (error) {
    logger.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Failed to generate weekly summary' });
  }
});

/**
 * GET /api/founder/quarterly-priorities
 * Track quarterly #1 priority and progress
 */
router.get('/quarterly-priorities', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const { quarter, year } = req.query;

    const currentQuarter = quarter || Math.floor((new Date().getMonth() + 3) / 3);
    const currentYear = year || new Date().getFullYear();

    const { data: priority, error } = await supabase
      .from('quarterly_priorities')
      .select('*')
      .eq('user_id', userId)
      .eq('quarter', currentQuarter)
      .eq('year', currentYear)
      .single();

    res.json(priority || {
      quarter: currentQuarter,
      year: currentYear,
      priority: null,
      supporting_initiatives: [],
      metrics: {},
      status: 'not_set'
    });

  } catch (error) {
    logger.error('Quarterly priorities error:', error);
    res.status(500).json({ error: 'Failed to load quarterly priorities' });
  }
});

/**
 * POST /api/founder/quarterly-priorities
 * Set or update quarterly priority
 */
router.post('/quarterly-priorities', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { quarter, year, priority, supporting_initiatives, metrics } = req.body;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('quarterly_priorities')
      .upsert({
        user_id: userId,
        quarter: quarter || Math.floor((new Date().getMonth() + 3) / 3),
        year: year || new Date().getFullYear(),
        priority,
        supporting_initiatives: supporting_initiatives || [],
        metrics: metrics || {},
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,quarter,year'
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'set_quarterly_priority', {
      quarter,
      year,
      priority
    }, req);

    res.json({ success: true, priority: data });

  } catch (error) {
    logger.error('Failed to set quarterly priority:', error);
    res.status(500).json({ error: 'Failed to set quarterly priority' });
  }
});

module.exports = router;
