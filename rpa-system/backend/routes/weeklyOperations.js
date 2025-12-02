
const { logger } = require('../utils/logger');
/**
 * Weekly Operations - Rockefeller Operating System
 *
 * Monday planning and Friday reviews that maintain strategic momentum
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { auditLogger } = require('../utils/auditLogger');

/**
 * POST /api/weekly/planning
 * Monday morning week planning (30 minutes)
 */
router.post('/planning', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      week_of,
      last_week_review,
      efficiency_focus,
      data_focus,
      competitive_focus,
      week_priority,
      success_looks_like,
      quarterly_connection,
      consequence_if_missed,
      time_allocation
    } = req.body;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('weekly_plans')
      .insert({
        user_id: userId,
        week_of: week_of || getMonday(new Date()).toISOString().split('T')[0],
        last_week_review,
        efficiency_focus,
        data_focus,
        competitive_focus,
        week_priority,
        success_looks_like,
        quarterly_connection,
        consequence_if_missed,
        time_allocation: time_allocation || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'complete_weekly_planning', {
      week_of: data.week_of,
      priority: week_priority
    }, req);

    res.json({
      success: true,
      plan: data,
      message: 'Week planning completed'
    });

  } catch (error) {
    logger.error('Weekly planning error:', error);
    res.status(500).json({ error: 'Failed to save weekly planning' });
  }
});

/**
 * POST /api/weekly/review
 * Friday evening week review (30 minutes)
 */
router.post('/review', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      week_of,
      priority_status,
      priority_miss_root_cause,
      metrics_results,
      wins,
      challenges_solutions,
      key_learning,
      feedback_summary,
      next_week_preview
    } = req.body;

    const supabase = getSupabase();

    // Update the weekly plan with review data
    const { data, error } = await supabase
      .from('weekly_plans')
      .update({
        priority_status,
        priority_miss_root_cause,
        metrics_results,
        wins,
        challenges_solutions,
        key_learning,
        feedback_summary,
        next_week_preview,
        review_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('week_of', week_of || getMonday(new Date()).toISOString().split('T')[0])
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'complete_weekly_review', {
      week_of: data.week_of,
      priority_status
    }, req);

    res.json({
      success: true,
      review: data,
      message: 'Week review completed'
    });

  } catch (error) {
    logger.error('Weekly review error:', error);
    res.status(500).json({ error: 'Failed to save weekly review' });
  }
});

/**
 * GET /api/weekly/current
 * Get current week's plan and progress
 */
router.get('/current', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const monday = getMonday(new Date()).toISOString().split('T')[0];
    const supabase = getSupabase();

    const { data: weekPlan, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_of', monday)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found

    // Get daily progress for this week
    const { data: dailyProgress } = await supabase
      .from('daily_sequences')
      .select('date, sequence_type, priority_completed')
      .eq('user_id', userId)
      .gte('date', monday)
      .order('date', { ascending: true });

    // Calculate week progress
    const daysCompleted = new Set(dailyProgress?.filter(d => d.sequence_type === 'evening').map(d => d.date)).size;
    const prioritiesCompleted = dailyProgress?.filter(d => d.sequence_type === 'evening' && d.priority_completed).length || 0;

    res.json({
      week_of: monday,
      has_plan: !!weekPlan,
      plan: weekPlan || null,
      progress: {
        days_completed: daysCompleted,
        days_remaining: 5 - daysCompleted,
        priorities_completed: prioritiesCompleted,
        completion_rate: daysCompleted > 0 ? Math.round((prioritiesCompleted / daysCompleted) * 100) : 0
      }
    });

  } catch (error) {
    logger.error('Current week error:', error);
    res.status(500).json({ error: 'Failed to get current week' });
  }
});

/**
 * GET /api/weekly/history
 * Get historical weekly plans and reviews
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 12 } = req.query; // Last 12 weeks

    const supabase = getSupabase();
    const { data: weeks, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .order('week_of', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Calculate trends
    const stats = {
      total_weeks: weeks?.length || 0,
      weeks_with_reviews: weeks?.filter(w => w.review_completed_at).length || 0,
      priorities_hit: weeks?.filter(w => w.priority_status === 'hit').length || 0,
      priorities_partial: weeks?.filter(w => w.priority_status === 'partial').length || 0,
      priorities_missed: weeks?.filter(w => w.priority_status === 'miss').length || 0
    };

    const successRate = stats.total_weeks > 0
      ? Math.round(((stats.priorities_hit + (stats.priorities_partial * 0.5)) / stats.total_weeks) * 100)
      : 0;

    res.json({
      weeks: weeks || [],
      stats,
      success_rate: successRate,
      review_completion_rate: stats.total_weeks > 0 ? Math.round((stats.weeks_with_reviews / stats.total_weeks) * 100) : 0,
      trend: calculateTrend(weeks)
    });

  } catch (error) {
    logger.error('Weekly history error:', error);
    res.status(500).json({ error: 'Failed to get weekly history' });
  }
});

/**
 * POST /api/weekly/innovation-experiment
 * Log weekly innovation hour experiment
 */
router.post('/innovation-experiment', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      experiment_name,
      hypothesis,
      approach_tested,
      time_invested,
      financial_investment,
      result_outcome,
      result_data,
      result_learning,
      decision,
      decision_reasoning,
      next_experiment
    } = req.body;

    if (!experiment_name) {
      return res.status(400).json({ error: 'Experiment name required' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('innovation_experiments')
      .insert({
        user_id: userId,
        experiment_name,
        hypothesis,
        approach_tested,
        time_invested: time_invested || 0,
        financial_investment: financial_investment || 0,
        result_outcome,
        result_data: result_data || {},
        result_learning,
        decision, // implement, iterate, shelve, abandon
        decision_reasoning,
        next_experiment,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'log_innovation_experiment', {
      experiment: experiment_name,
      decision
    }, req);

    res.json({
      success: true,
      experiment: data,
      message: 'Innovation experiment logged'
    });

  } catch (error) {
    logger.error('Innovation experiment error:', error);
    res.status(500).json({ error: 'Failed to log experiment' });
  }
});

/**
 * GET /api/weekly/innovation-experiments
 * Get innovation experiment history
 */
router.get('/innovation-experiments', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 50 } = req.query;

    const supabase = getSupabase();
    const { data: experiments, error } = await supabase
      .from('innovation_experiments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Calculate innovation metrics
    const stats = {
      total_experiments: experiments?.length || 0,
      implemented: experiments?.filter(e => e.decision === 'implement').length || 0,
      iterated: experiments?.filter(e => e.decision === 'iterate').length || 0,
      shelved: experiments?.filter(e => e.decision === 'shelve').length || 0,
      abandoned: experiments?.filter(e => e.decision === 'abandon').length || 0,
      total_time: experiments?.reduce((sum, e) => sum + (e.time_invested || 0), 0) || 0,
      total_investment: experiments?.reduce((sum, e) => sum + (e.financial_investment || 0), 0) || 0
    };

    const implementationRate = stats.total_experiments > 0
      ? Math.round((stats.implemented / stats.total_experiments) * 100)
      : 0;

    res.json({
      experiments: experiments || [],
      stats,
      implementation_rate: implementationRate,
      avg_time_per_experiment: stats.total_experiments > 0 ? Math.round(stats.total_time / stats.total_experiments) : 0
    });

  } catch (error) {
    logger.error('Innovation experiments error:', error);
    res.status(500).json({ error: 'Failed to get experiments' });
  }
});

// Helper functions
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function calculateTrend(weeks) {
  if (!weeks || weeks.length < 2) return 'insufficient_data';

  const recent4 = weeks.slice(0, 4);
  const previous4 = weeks.slice(4, 8);

  if (previous4.length === 0) return 'insufficient_data';

  const recentHits = recent4.filter(w => w.priority_status === 'hit').length;
  const previousHits = previous4.filter(w => w.priority_status === 'hit').length;

  const recentRate = recentHits / recent4.length;
  const previousRate = previousHits / previous4.length;

  if (recentRate > previousRate * 1.1) return 'improving';
  if (recentRate < previousRate * 0.9) return 'declining';
  return 'stable';
}

module.exports = router;
