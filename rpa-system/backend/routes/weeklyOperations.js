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

// ============================================================================
// CONSTANTS - Extracted magic numbers for maintainability
// ============================================================================
const VALIDATION_LIMITS = {
  PRIORITY_TEXT_MAX: 500,
  DESCRIPTION_MAX: 2000,
  FOCUS_TEXT_MAX: 1000,
  EXPERIMENT_NAME_MAX: 200,
  HYPOTHESIS_MAX: 1000,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/
};

const WEEKLY_CONFIG = {
  DEFAULT_HISTORY_LIMIT: 12,
  MAX_HISTORY_LIMIT: 52,
  TREND_RECENT_WEEKS: 4,
  TREND_PREVIOUS_WEEKS: 4
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and sanitize string input
 */
function validateString(value, maxLength, fieldName) {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
function validateDate(dateStr) {
  if (!dateStr) {
    return { valid: true, value: getMonday(new Date()).toISOString().split('T')[0] };
  }
  if (!VALIDATION_LIMITS.DATE_REGEX.test(dateStr)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }
  return { valid: true, value: dateStr };
}

/**
 * Validate time_allocation object structure
 */
function validateTimeAllocation(allocation) {
  if (!allocation) return { valid: true, value: {} };
  if (typeof allocation !== 'object' || Array.isArray(allocation)) {
    return { valid: false, error: 'time_allocation must be an object' };
  }
  // Ensure all values are numbers
  const validated = {};
  for (const [key, value] of Object.entries(allocation)) {
    if (typeof key !== 'string' || key.length > 100) continue;
    if (typeof value === 'number' && value >= 0 && value <= 168) { // Max hours in a week
      validated[key.trim()] = value;
    }
  }
  return { valid: true, value: validated };
}

/**
 * POST /api/weekly/planning
 * Monday morning week planning (30 minutes)
 *
 * SECURITY FIX: Added input validation for all fields
 */
router.post('/planning', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
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

    // Input validation
    const dateValidation = validateDate(week_of);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error, code: 'INVALID_DATE' });
    }

    const reviewValidation = validateString(last_week_review, VALIDATION_LIMITS.DESCRIPTION_MAX, 'last_week_review');
    if (!reviewValidation.valid) {
      return res.status(400).json({ error: reviewValidation.error, code: 'INVALID_INPUT' });
    }

    const efficiencyValidation = validateString(efficiency_focus, VALIDATION_LIMITS.FOCUS_TEXT_MAX, 'efficiency_focus');
    if (!efficiencyValidation.valid) {
      return res.status(400).json({ error: efficiencyValidation.error, code: 'INVALID_INPUT' });
    }

    const dataFocusValidation = validateString(data_focus, VALIDATION_LIMITS.FOCUS_TEXT_MAX, 'data_focus');
    if (!dataFocusValidation.valid) {
      return res.status(400).json({ error: dataFocusValidation.error, code: 'INVALID_INPUT' });
    }

    const competitiveValidation = validateString(competitive_focus, VALIDATION_LIMITS.FOCUS_TEXT_MAX, 'competitive_focus');
    if (!competitiveValidation.valid) {
      return res.status(400).json({ error: competitiveValidation.error, code: 'INVALID_INPUT' });
    }

    const priorityValidation = validateString(week_priority, VALIDATION_LIMITS.PRIORITY_TEXT_MAX, 'week_priority');
    if (!priorityValidation.valid) {
      return res.status(400).json({ error: priorityValidation.error, code: 'INVALID_INPUT' });
    }

    const successValidation = validateString(success_looks_like, VALIDATION_LIMITS.DESCRIPTION_MAX, 'success_looks_like');
    if (!successValidation.valid) {
      return res.status(400).json({ error: successValidation.error, code: 'INVALID_INPUT' });
    }

    const quarterlyValidation = validateString(quarterly_connection, VALIDATION_LIMITS.DESCRIPTION_MAX, 'quarterly_connection');
    if (!quarterlyValidation.valid) {
      return res.status(400).json({ error: quarterlyValidation.error, code: 'INVALID_INPUT' });
    }

    const consequenceValidation = validateString(consequence_if_missed, VALIDATION_LIMITS.DESCRIPTION_MAX, 'consequence_if_missed');
    if (!consequenceValidation.valid) {
      return res.status(400).json({ error: consequenceValidation.error, code: 'INVALID_INPUT' });
    }

    const timeValidation = validateTimeAllocation(time_allocation);
    if (!timeValidation.valid) {
      return res.status(400).json({ error: timeValidation.error, code: 'INVALID_INPUT' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('weekly_plans')
      .insert({
        user_id: userId,
        week_of: dateValidation.value,
        last_week_review: reviewValidation.value,
        efficiency_focus: efficiencyValidation.value,
        data_focus: dataFocusValidation.value,
        competitive_focus: competitiveValidation.value,
        week_priority: priorityValidation.value,
        success_looks_like: successValidation.value,
        quarterly_connection: quarterlyValidation.value,
        consequence_if_missed: consequenceValidation.value,
        time_allocation: timeValidation.value,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'complete_weekly_planning', {
      week_of: data.week_of,
      priority: priorityValidation.value
    }, req);

    res.json({
      success: true,
      plan: data,
      message: 'Week planning completed'
    });

  } catch (error) {
    logger.error('Weekly planning error:', error);
    res.status(500).json({
      error: 'Failed to save weekly planning',
      code: 'WEEKLY_PLANNING_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * POST /api/weekly/review
 * Friday evening week review (30 minutes)
 *
 * SECURITY FIX: Added input validation
 */
router.post('/review', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
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

    // Input validation
    const dateValidation = validateDate(week_of);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error, code: 'INVALID_DATE' });
    }

    // Validate priority_status enum
    const validStatuses = ['hit', 'partial', 'miss', null];
    if (priority_status && !validStatuses.includes(priority_status)) {
      return res.status(400).json({
        error: 'priority_status must be one of: hit, partial, miss',
        code: 'INVALID_INPUT'
      });
    }

    const rootCauseValidation = validateString(priority_miss_root_cause, VALIDATION_LIMITS.DESCRIPTION_MAX, 'priority_miss_root_cause');
    if (!rootCauseValidation.valid) {
      return res.status(400).json({ error: rootCauseValidation.error, code: 'INVALID_INPUT' });
    }

    const winsValidation = validateString(wins, VALIDATION_LIMITS.DESCRIPTION_MAX, 'wins');
    if (!winsValidation.valid) {
      return res.status(400).json({ error: winsValidation.error, code: 'INVALID_INPUT' });
    }

    const challengesValidation = validateString(challenges_solutions, VALIDATION_LIMITS.DESCRIPTION_MAX, 'challenges_solutions');
    if (!challengesValidation.valid) {
      return res.status(400).json({ error: challengesValidation.error, code: 'INVALID_INPUT' });
    }

    const learningValidation = validateString(key_learning, VALIDATION_LIMITS.DESCRIPTION_MAX, 'key_learning');
    if (!learningValidation.valid) {
      return res.status(400).json({ error: learningValidation.error, code: 'INVALID_INPUT' });
    }

    const feedbackValidation = validateString(feedback_summary, VALIDATION_LIMITS.DESCRIPTION_MAX, 'feedback_summary');
    if (!feedbackValidation.valid) {
      return res.status(400).json({ error: feedbackValidation.error, code: 'INVALID_INPUT' });
    }

    const previewValidation = validateString(next_week_preview, VALIDATION_LIMITS.DESCRIPTION_MAX, 'next_week_preview');
    if (!previewValidation.valid) {
      return res.status(400).json({ error: previewValidation.error, code: 'INVALID_INPUT' });
    }

    const supabase = getSupabase();

    // Update the weekly plan with review data
    const { data, error } = await supabase
      .from('weekly_plans')
      .update({
        priority_status,
        priority_miss_root_cause: rootCauseValidation.value,
        metrics_results: metrics_results || {},
        wins: winsValidation.value,
        challenges_solutions: challengesValidation.value,
        key_learning: learningValidation.value,
        feedback_summary: feedbackValidation.value,
        next_week_preview: previewValidation.value,
        review_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('week_of', dateValidation.value)
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
    res.status(500).json({
      error: 'Failed to save weekly review',
      code: 'WEEKLY_REVIEW_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
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

