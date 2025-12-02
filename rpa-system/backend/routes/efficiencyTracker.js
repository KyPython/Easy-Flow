
const { logger } = require('../utils/logger');
/**
 * Efficiency Improvements Tracker - Rockefeller Operating System
 *
 * "Find one 5% improvement every week"
 * - Rockefeller saved $2/barrel on barrels by making his own
 * - Reduced solder drops from 40 to 39, saved thousands
 * - You track every efficiency gain here
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { auditLogger } = require('../utils/auditLogger');

const EFFICIENCY_AREAS = [
  'conversion',
  'support',
  'development',
  'marketing',
  'operations',
  'onboarding',
  'product'
];

/**
 * POST /api/efficiency/improvement
 * Log a new efficiency improvement idea or implementation
 */
router.post('/improvement', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      title,
      description,
      area,
      baseline_metric,
      target_metric,
      impact_estimate,
      status
    } = req.body;

    if (!title || !area) {
      return res.status(400).json({
        error: 'Missing required fields: title, area'
      });
    }

    if (!EFFICIENCY_AREAS.includes(area)) {
      return res.status(400).json({
        error: `Invalid area. Must be one of: ${EFFICIENCY_AREAS.join(', ')}`
      });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('efficiency_improvements')
      .insert({
        user_id: userId,
        title,
        description,
        area,
        baseline_metric,
        target_metric,
        impact_estimate,
        status: status || 'proposed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'log_efficiency_improvement', {
      title,
      area,
      impact_estimate
    }, req);

    res.json({
      success: true,
      improvement: data,
      message: 'Efficiency improvement logged'
    });

  } catch (error) {
    logger.error('Failed to log efficiency improvement:', error);
    res.status(500).json({ error: 'Failed to log improvement' });
  }
});

/**
 * GET /api/efficiency/improvements
 * Get all efficiency improvements
 */
router.get('/improvements', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { area, status, limit = 50 } = req.query;

    const supabase = getSupabase();
    let query = supabase
      .from('efficiency_improvements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (area) query = query.eq('area', area);
    if (status) query = query.eq('status', status);

    const { data: improvements, error } = await query;
    if (error) throw error;

    // Calculate stats
    const stats = {
      total: improvements?.length || 0,
      by_area: {},
      by_status: {},
      implemented_count: 0,
      validated_count: 0,
      total_estimated_impact: []
    };

    improvements?.forEach(imp => {
      // By area
      if (!stats.by_area[imp.area]) {
        stats.by_area[imp.area] = 0;
      }
      stats.by_area[imp.area]++;

      // By status
      if (!stats.by_status[imp.status]) {
        stats.by_status[imp.status] = 0;
      }
      stats.by_status[imp.status]++;

      // Counts
      if (imp.status === 'implemented' || imp.status === 'measuring' || imp.status === 'validated') {
        stats.implemented_count++;
      }
      if (imp.status === 'validated') {
        stats.validated_count++;
      }

      // Impact tracking
      if (imp.impact_estimate) {
        stats.total_estimated_impact.push(imp.impact_estimate);
      }
    });

    res.json({
      improvements: improvements || [],
      stats,
      areas: EFFICIENCY_AREAS
    });

  } catch (error) {
    logger.error('Failed to get efficiency improvements:', error);
    res.status(500).json({ error: 'Failed to get improvements' });
  }
});

/**
 * PATCH /api/efficiency/improvement/:id
 * Update efficiency improvement (move through stages)
 */
router.patch('/improvement/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const {
      status,
      actual_metric,
      implementation_date,
      roi_data,
      notes
    } = req.body;

    const supabase = getSupabase();
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (status) updates.status = status;
    if (actual_metric) updates.actual_metric = actual_metric;
    if (implementation_date) updates.implementation_date = implementation_date;
    if (roi_data) updates.roi_data = roi_data;
    if (notes) updates.notes = notes;

    // If moving to implemented, set implementation date
    if (status === 'implemented' && !implementation_date) {
      updates.implementation_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('efficiency_improvements')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'update_efficiency_improvement', {
      improvement_id: id,
      new_status: status
    }, req);

    res.json({
      success: true,
      improvement: data
    });

  } catch (error) {
    logger.error('Failed to update efficiency improvement:', error);
    res.status(500).json({ error: 'Failed to update improvement' });
  }
});

/**
 * GET /api/efficiency/monthly-report
 * Generate monthly efficiency report
 */
router.get('/monthly-report', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: improvements, error } = await supabase
      .from('efficiency_improvements')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const report = {
      month_ending: new Date().toISOString().split('T')[0],
      total_improvements_identified: improvements?.length || 0,
      improvements_implemented: 0,
      improvements_validated: 0,
      by_area: {},
      top_wins: [],
      pending_actions: [],
      estimated_cumulative_impact: {}
    };

    improvements?.forEach(imp => {
      // Count by status
      if (imp.status === 'implemented' || imp.status === 'measuring' || imp.status === 'validated') {
        report.improvements_implemented++;
      }
      if (imp.status === 'validated') {
        report.improvements_validated++;

        // Top wins
        report.top_wins.push({
          title: imp.title,
          area: imp.area,
          impact: imp.impact_estimate,
          actual_metric: imp.actual_metric
        });
      }

      // By area
      if (!report.by_area[imp.area]) {
        report.by_area[imp.area] = {
          proposed: 0,
          implemented: 0,
          validated: 0
        };
      }

      if (imp.status === 'proposed' || imp.status === 'in_progress') {
        report.by_area[imp.area].proposed++;
      } else if (imp.status === 'implemented' || imp.status === 'measuring') {
        report.by_area[imp.area].implemented++;
      } else if (imp.status === 'validated') {
        report.by_area[imp.area].validated++;
      }

      // Pending actions
      if (imp.status === 'proposed' || imp.status === 'in_progress') {
        report.pending_actions.push({
          id: imp.id,
          title: imp.title,
          area: imp.area,
          status: imp.status
        });
      }
    });

    // Calculate velocity (improvements per week)
    report.velocity = {
      improvements_per_week: Math.round((improvements?.length || 0) / 4.3),
      implementation_rate: report.total_improvements_identified > 0
        ? Math.round((report.improvements_implemented / report.total_improvements_identified) * 100)
        : 0,
      validation_rate: report.improvements_implemented > 0
        ? Math.round((report.improvements_validated / report.improvements_implemented) * 100)
        : 0
    };

    // Insights
    report.insights = generateEfficiencyInsights(report);

    res.json(report);

  } catch (error) {
    logger.error('Monthly report error:', error);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

/**
 * GET /api/efficiency/suggestions
 * Get AI-powered efficiency improvement suggestions based on current metrics
 */
router.get('/suggestions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();

    // Get current metrics to analyze
    const { data: recentSignups } = await supabase
      .from('users')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: recentExecutions } = await supabase
      .from('automation_executions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate activation rate
    const activatedUsers = new Set(recentExecutions?.map(e => e.user_id) || []);
    const activationRate = recentSignups?.length > 0
      ? (activatedUsers.size / recentSignups.length) * 100
      : 0;

    // Generate suggestions based on metrics
    const suggestions = [];

    // Conversion suggestions
    if (activationRate < 40) {
      suggestions.push({
        area: 'conversion',
        priority: 'high',
        title: 'Improve activation rate',
        description: `Current activation rate is ${Math.round(activationRate)}%. Industry standard is 40%+.`,
        suggested_actions: [
          'Add onboarding wizard for first workflow',
          'Reduce steps from signup to first workflow',
          'Send activation email sequence',
          'Add workflow templates one-click setup'
        ],
        baseline_metric: {
          metric: 'activation_rate',
          value: activationRate,
          unit: 'percent'
        },
        target_metric: {
          metric: 'activation_rate',
          value: 40,
          unit: 'percent'
        },
        impact_estimate: '15% increase in active users'
      });
    }

    // Execution efficiency
    const avgExecutionTime = recentExecutions?.reduce((sum, e) => sum + (e.execution_time || 0), 0) / (recentExecutions?.length || 1);
    if (avgExecutionTime > 5000) { // > 5 seconds
      suggestions.push({
        area: 'operations',
        priority: 'medium',
        title: 'Optimize workflow execution speed',
        description: `Average execution time is ${Math.round(avgExecutionTime / 1000)}s. Can be optimized.`,
        suggested_actions: [
          'Add caching for repeated operations',
          'Optimize database queries',
          'Implement parallel execution',
          'Add execution time monitoring'
        ],
        baseline_metric: {
          metric: 'avg_execution_time',
          value: avgExecutionTime,
          unit: 'milliseconds'
        },
        target_metric: {
          metric: 'avg_execution_time',
          value: 3000,
          unit: 'milliseconds'
        },
        impact_estimate: '40% faster executions, better user experience'
      });
    }

    // Support efficiency
    const { data: recentFeedback } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const unresolvedFeedback = recentFeedback?.filter(f => !f.resolved).length || 0;
    if (unresolvedFeedback > 10) {
      suggestions.push({
        area: 'support',
        priority: 'high',
        title: 'Reduce support ticket backlog',
        description: `${unresolvedFeedback} unresolved feedback items.`,
        suggested_actions: [
          'Create FAQ for common issues',
          'Add in-app help tooltips',
          'Implement automated responses',
          'Set up support triage system'
        ],
        baseline_metric: {
          metric: 'unresolved_tickets',
          value: unresolvedFeedback,
          unit: 'count'
        },
        target_metric: {
          metric: 'unresolved_tickets',
          value: 5,
          unit: 'count'
        },
        impact_estimate: '50% reduction in support time'
      });
    }

    // Marketing efficiency
    const dailySignupRate = recentSignups?.length / 30 || 0;
    if (dailySignupRate < 5) {
      suggestions.push({
        area: 'marketing',
        priority: 'high',
        title: 'Increase daily signup rate',
        description: `Current rate: ${Math.round(dailySignupRate)} signups/day. Target: 5+/day.`,
        suggested_actions: [
          'Increase Reddit engagement frequency',
          'Create workflow template showcase',
          'Launch referral program',
          'Start content marketing (blog/videos)',
          'Run Product Hunt launch'
        ],
        baseline_metric: {
          metric: 'daily_signups',
          value: dailySignupRate,
          unit: 'signups_per_day'
        },
        target_metric: {
          metric: 'daily_signups',
          value: 5,
          unit: 'signups_per_day'
        },
        impact_estimate: '100% increase in user growth'
      });
    }

    res.json({
      total_suggestions: suggestions.length,
      suggestions,
      generated_at: new Date().toISOString(),
      message: 'Review these suggestions and implement ONE per week (Rockefeller principle)'
    });

  } catch (error) {
    logger.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Helper function to generate insights
function generateEfficiencyInsights(report) {
  const insights = [];

  // Implementation velocity
  if (report.velocity.improvements_per_week >= 1) {
    insights.push({
      type: 'positive',
      message: `Strong improvement velocity: ${report.velocity.improvements_per_week} improvements/week`,
      action: 'Keep up the Rockefeller-style systematic approach'
    });
  } else if (report.velocity.improvements_per_week < 0.5) {
    insights.push({
      type: 'warning',
      message: 'Low improvement velocity this month',
      action: 'Schedule dedicated time for efficiency analysis (Habit #1: Ruthless Efficiency)'
    });
  }

  // Implementation rate
  if (report.velocity.implementation_rate < 50) {
    insights.push({
      type: 'action_needed',
      message: `Only ${report.velocity.implementation_rate}% of improvements implemented`,
      action: 'Focus on execution, not just ideation. Rockefeller implemented relentlessly.'
    });
  }

  // Validation rate
  if (report.velocity.validation_rate < 70) {
    insights.push({
      type: 'measurement',
      message: 'Many improvements not validated yet',
      action: 'Measure actual impact - data-driven decisions (Rockefeller Principle #3)'
    });
  }

  // Top performing area
  const topArea = Object.entries(report.by_area)
    .sort((a, b) => b[1].validated - a[1].validated)[0];

  if (topArea && topArea[1].validated > 0) {
    insights.push({
      type: 'success',
      message: `${topArea[0]} area showing strong results`,
      action: `Double down on ${topArea[0]} improvements`
    });
  }

  return insights;
}

module.exports = router;
