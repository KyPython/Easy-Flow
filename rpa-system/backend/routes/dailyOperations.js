const { logger } = require('../utils/logger');
/**
 * Daily Operations - Rockefeller Operating System
 *
 * Morning and evening sequences that transform principles into daily actions
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
  DECISION_TITLE_MAX: 200,
  MISS_REASON_MAX: 1000,
  EFFICIENCY_IMPROVEMENT_MAX: 500,
  VALUES_MAX_ITEMS: 10,
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/
};

const STREAK_CONFIG = {
  LOOKBACK_DAYS: 30,
  MASTER_THRESHOLD: 30,
  ADVANCED_THRESHOLD: 14,
  BUILDING_THRESHOLD: 7
};

const EMERGENCY_CONFIG = {
  PRIORITY_LOOKBACK_DAYS: 14,
  MISSED_PRIORITY_THRESHOLD: 10,
  METRIC_DECLINE_THRESHOLD: 0.8 // 20% decline
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and sanitize string input
 * @param {string} value - The input value
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of the field for error messages
 * @returns {{ valid: boolean, error?: string, value?: string }}
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
 * @param {string} dateStr - The date string
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateDate(dateStr) {
  if (!dateStr) {
    return { valid: true, value: new Date().toISOString().split('T')[0] };
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
 * Validate array of strings (for values_aligned, etc.)
 * @param {any} arr - The input array
 * @param {number} maxItems - Maximum number of items
 * @param {string} fieldName - Name of the field
 * @returns {{ valid: boolean, error?: string, value?: string[] }}
 */
function validateStringArray(arr, maxItems, fieldName) {
  if (!arr) return { valid: true, value: [] };
  if (!Array.isArray(arr)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }
  if (arr.length > maxItems) {
    return { valid: false, error: `${fieldName} exceeds maximum of ${maxItems} items` };
  }
  const validated = arr.filter(item => typeof item === 'string').map(s => s.trim().slice(0, 100));
  return { valid: true, value: validated };
}

/**
 * Middleware to check if user has admin or founder role
 */
function requireAdminOrFounder(req, res, next) {
  const userRole = req.user?.role;
  if (!userRole || !['admin', 'founder', 'owner'].includes(userRole.toLowerCase())) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'This endpoint requires admin or founder privileges'
    });
  }
  next();
}

/**
 * POST /api/daily/morning-sequence
 * Complete the 10-minute morning sequence
 */
router.post('/morning-sequence', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const {
      date,
      metrics_checked,
      competitive_intel_noted,
      priority_identified,
      priority_text,
      priority_quarterly_connection,
      priority_consequence
    } = req.body;

    // Input validation
    const dateValidation = validateDate(date);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error, code: 'INVALID_DATE' });
    }

    const priorityTextValidation = validateString(priority_text, VALIDATION_LIMITS.PRIORITY_TEXT_MAX, 'priority_text');
    if (!priorityTextValidation.valid) {
      return res.status(400).json({ error: priorityTextValidation.error, code: 'INVALID_INPUT' });
    }

    const quarterlyValidation = validateString(priority_quarterly_connection, VALIDATION_LIMITS.DESCRIPTION_MAX, 'priority_quarterly_connection');
    if (!quarterlyValidation.valid) {
      return res.status(400).json({ error: quarterlyValidation.error, code: 'INVALID_INPUT' });
    }

    const consequenceValidation = validateString(priority_consequence, VALIDATION_LIMITS.DESCRIPTION_MAX, 'priority_consequence');
    if (!consequenceValidation.valid) {
      return res.status(400).json({ error: consequenceValidation.error, code: 'INVALID_INPUT' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('daily_sequences')
      .insert({
        user_id: userId,
        date: dateValidation.value,
        sequence_type: 'morning',
        metrics_checked: Boolean(metrics_checked),
        competitive_intel_noted: Boolean(competitive_intel_noted),
        priority_identified: Boolean(priority_identified),
        priority_text: priorityTextValidation.value,
        priority_quarterly_connection: quarterlyValidation.value,
        priority_consequence: consequenceValidation.value,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'complete_morning_sequence', {
      date: dateValidation.value,
      priority: priorityTextValidation.value
    }, req);

    res.json({
      success: true,
      sequence: data,
      message: 'Morning sequence completed'
    });

  } catch (error) {
    logger.error('Morning sequence error:', error);
    res.status(500).json({
      error: 'Failed to save morning sequence',
      code: 'MORNING_SEQUENCE_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * POST /api/daily/evening-log
 * Complete the 5-minute evening log
 *
 * SECURITY FIX: Added input validation and version control for upsert
 */
router.post('/evening-log', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const {
      date,
      priority_completed,
      priority_miss_reason,
      todays_win,
      todays_lesson,
      efficiency_improvement_spotted,
      tomorrows_priority,
      version // For optimistic locking
    } = req.body;

    // Input validation
    const dateValidation = validateDate(date);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error, code: 'INVALID_DATE' });
    }

    const missReasonValidation = validateString(priority_miss_reason, VALIDATION_LIMITS.MISS_REASON_MAX, 'priority_miss_reason');
    if (!missReasonValidation.valid) {
      return res.status(400).json({ error: missReasonValidation.error, code: 'INVALID_INPUT' });
    }

    const winValidation = validateString(todays_win, VALIDATION_LIMITS.DESCRIPTION_MAX, 'todays_win');
    if (!winValidation.valid) {
      return res.status(400).json({ error: winValidation.error, code: 'INVALID_INPUT' });
    }

    const lessonValidation = validateString(todays_lesson, VALIDATION_LIMITS.DESCRIPTION_MAX, 'todays_lesson');
    if (!lessonValidation.valid) {
      return res.status(400).json({ error: lessonValidation.error, code: 'INVALID_INPUT' });
    }

    const efficiencyValidation = validateString(efficiency_improvement_spotted, VALIDATION_LIMITS.EFFICIENCY_IMPROVEMENT_MAX, 'efficiency_improvement_spotted');
    if (!efficiencyValidation.valid) {
      return res.status(400).json({ error: efficiencyValidation.error, code: 'INVALID_INPUT' });
    }

    const tomorrowValidation = validateString(tomorrows_priority, VALIDATION_LIMITS.PRIORITY_TEXT_MAX, 'tomorrows_priority');
    if (!tomorrowValidation.valid) {
      return res.status(400).json({ error: tomorrowValidation.error, code: 'INVALID_INPUT' });
    }

    const supabase = getSupabase();
    const validatedDate = dateValidation.value;

    // Check if record exists for version control
    const { data: existing } = await supabase
      .from('daily_sequences')
      .select('id, version, sequence_type')
      .eq('user_id', userId)
      .eq('date', validatedDate)
      .eq('sequence_type', 'evening')
      .single();

    // If updating and version mismatch, reject (optimistic locking)
    if (existing && version !== undefined && existing.version !== version) {
      return res.status(409).json({
        error: 'Data has been modified by another request',
        code: 'VERSION_CONFLICT',
        current_version: existing.version
      });
    }

    const newVersion = (existing?.version || 0) + 1;

    // Use insert or update based on existence (not blind upsert)
    let data, error;
    if (existing) {
      // Update existing record
      ({ data, error } = await supabase
        .from('daily_sequences')
        .update({
          priority_completed: Boolean(priority_completed),
          priority_miss_reason: missReasonValidation.value,
          todays_win: winValidation.value,
          todays_lesson: lessonValidation.value,
          efficiency_improvement_spotted: efficiencyValidation.value,
          tomorrows_priority: tomorrowValidation.value,
          updated_at: new Date().toISOString(),
          version: newVersion
        })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      // Insert new record
      ({ data, error } = await supabase
        .from('daily_sequences')
        .insert({
          user_id: userId,
          date: validatedDate,
          sequence_type: 'evening',
          priority_completed: Boolean(priority_completed),
          priority_miss_reason: missReasonValidation.value,
          todays_win: winValidation.value,
          todays_lesson: lessonValidation.value,
          efficiency_improvement_spotted: efficiencyValidation.value,
          tomorrows_priority: tomorrowValidation.value,
          completed_at: new Date().toISOString(),
          version: 1
        })
        .select()
        .single());
    }

    if (error) throw error;

    // If efficiency improvement was spotted, create it
    if (efficiencyValidation.value) {
      await supabase
        .from('efficiency_improvements')
        .insert({
          user_id: userId,
          title: efficiencyValidation.value,
          description: `Spotted during evening log on ${validatedDate}`,
          area: 'operations',
          status: 'proposed',
          created_at: new Date().toISOString()
        });
    }

    await auditLogger.logUserAction(userId, 'complete_evening_log', {
      date: validatedDate,
      priority_completed: Boolean(priority_completed),
      is_update: !!existing
    }, req);

    res.json({
      success: true,
      log: data,
      message: existing ? 'Evening log updated' : 'Evening log completed',
      version: newVersion
    });

  } catch (error) {
    logger.error('Evening log error:', error);
    res.status(500).json({
      error: 'Failed to save evening log',
      code: 'EVENING_LOG_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * GET /api/daily/today
 * Get today's sequences status
 */
router.get('/today', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const supabase = getSupabase();

    const { data: sequences, error } = await supabase
      .from('daily_sequences')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today);

    if (error) throw error;

    const morning = sequences?.find(s => s.sequence_type === 'morning');
    const evening = sequences?.find(s => s.sequence_type === 'evening');

    res.json({
      date: today,
      morning_completed: !!morning,
      evening_completed: !!evening,
      morning_data: morning || null,
      evening_data: evening || null,
      ready_for_day: !!morning && !!evening
    });

  } catch (error) {
    logger.error('Today sequences error:', error);
    res.status(500).json({ error: 'Failed to get today sequences' });
  }
});

/**
 * GET /api/daily/streak
 * Get your daily sequence completion streak
 *
 * SECURITY FIX: Fixed streak calculation to only count today if BOTH morning AND evening complete
 */
router.get('/streak', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const supabase = getSupabase();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - STREAK_CONFIG.LOOKBACK_DAYS);

    const { data: sequences, error } = await supabase
      .from('daily_sequences')
      .select('date, sequence_type')
      .eq('user_id', userId)
      .gte('date', lookbackDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    // Group by date
    const dateMap = {};
    sequences?.forEach(seq => {
      if (!dateMap[seq.date]) {
        dateMap[seq.date] = { morning: false, evening: false };
      }
      dateMap[seq.date][seq.sequence_type] = true;
    });

    // Calculate streak - FIXED: Only count complete days (both morning AND evening)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date();
    let todayIncomplete = false;

    while (checkDate >= lookbackDate) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayData = dateMap[dateStr];
      const isComplete = dayData && dayData.morning && dayData.evening;

      if (isComplete) {
        // Day is fully complete - count it
        currentStreak++;
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (dateStr === today) {
        // Today is incomplete - DON'T count it, but don't break streak yet
        // User still has time to complete today
        todayIncomplete = true;
        // Don't increment currentStreak for incomplete today
      } else {
        // Past day is incomplete - streak is broken
        break;
      }

      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate completion rate
    const daysTracked = Object.keys(dateMap).length;
    const completeDays = Object.values(dateMap).filter(d => d.morning && d.evening).length;
    const completionRate = daysTracked > 0 ? Math.round((completeDays / daysTracked) * 100) : 0;

    // Determine Rockefeller level using constants
    let level = 'Beginner';
    if (currentStreak >= STREAK_CONFIG.MASTER_THRESHOLD) level = 'Master';
    else if (currentStreak >= STREAK_CONFIG.ADVANCED_THRESHOLD) level = 'Advanced';
    else if (currentStreak >= STREAK_CONFIG.BUILDING_THRESHOLD) level = 'Building';

    res.json({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      completion_rate: completionRate,
      days_tracked: daysTracked,
      complete_days: completeDays,
      rockefeller_level: level,
      today_status: {
        date: today,
        morning_complete: dateMap[today]?.morning || false,
        evening_complete: dateMap[today]?.evening || false,
        fully_complete: dateMap[today]?.morning && dateMap[today]?.evening
      }
    });

  } catch (error) {
    logger.error('Streak calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate streak',
      code: 'STREAK_CALCULATION_FAILED'
    });
  }
});

/**
 * POST /api/daily/decision-log
 * Log a major decision using the Rockefeller framework
 *
 * SECURITY FIX: Added input validation for all fields
 */
router.post('/decision-log', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const {
      decision_title,
      decision_description,
      data_used,
      baseline_metric,
      target_metric,
      success_criteria,
      aligns_with_priority,
      values_aligned,
      decision_made
    } = req.body;

    // Input validation
    const titleValidation = validateString(decision_title, VALIDATION_LIMITS.DECISION_TITLE_MAX, 'decision_title');
    if (!titleValidation.valid) {
      return res.status(400).json({ error: titleValidation.error, code: 'INVALID_INPUT' });
    }
    if (!titleValidation.value) {
      return res.status(400).json({ error: 'Decision title is required', code: 'MISSING_REQUIRED_FIELD' });
    }

    const descValidation = validateString(decision_description, VALIDATION_LIMITS.DESCRIPTION_MAX, 'decision_description');
    if (!descValidation.valid) {
      return res.status(400).json({ error: descValidation.error, code: 'INVALID_INPUT' });
    }

    const criteriaValidation = validateString(success_criteria, VALIDATION_LIMITS.DESCRIPTION_MAX, 'success_criteria');
    if (!criteriaValidation.valid) {
      return res.status(400).json({ error: criteriaValidation.error, code: 'INVALID_INPUT' });
    }

    const valuesValidation = validateStringArray(values_aligned, VALIDATION_LIMITS.VALUES_MAX_ITEMS, 'values_aligned');
    if (!valuesValidation.valid) {
      return res.status(400).json({ error: valuesValidation.error, code: 'INVALID_INPUT' });
    }

    // Validate data_used is an object if provided
    let validatedDataUsed = {};
    if (data_used !== undefined && data_used !== null) {
      if (typeof data_used !== 'object' || Array.isArray(data_used)) {
        return res.status(400).json({ error: 'data_used must be an object', code: 'INVALID_INPUT' });
      }
      validatedDataUsed = data_used;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('decision_log')
      .insert({
        user_id: userId,
        decision_title: titleValidation.value,
        decision_description: descValidation.value,
        data_used: validatedDataUsed,
        values_considered: valuesValidation.value,
        outcome_prediction: JSON.stringify({
          baseline: baseline_metric,
          target: target_metric,
          success_criteria: criteriaValidation.value
        }),
        aligns_with_priority: Boolean(aligns_with_priority),
        decision_made: Boolean(decision_made),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'log_decision', {
      decision: titleValidation.value
    }, req);

    res.json({
      success: true,
      decision: data,
      message: 'Decision logged using Rockefeller framework'
    });

  } catch (error) {
    logger.error('Decision log error:', error);
    res.status(500).json({
      error: 'Failed to log decision',
      code: 'DECISION_LOG_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * GET /api/daily/decisions
 * Get decision history with outcomes
 */
router.get('/decisions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 50 } = req.query;

    const supabase = getSupabase();
    const { data: decisions, error } = await supabase
      .from('decision_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Analyze decision effectiveness
    const stats = {
      total_decisions: decisions?.length || 0,
      data_driven: decisions?.filter(d => d.data_used && Object.keys(d.data_used).length > 0).length || 0,
      values_aligned: decisions?.filter(d => d.values_considered && d.values_considered.length > 0).length || 0,
      priority_aligned: decisions?.filter(d => d.aligns_with_priority).length || 0,
      with_outcomes: decisions?.filter(d => d.actual_outcome).length || 0
    };

    res.json({
      decisions: decisions || [],
      stats,
      data_driven_rate: stats.total_decisions > 0 ? Math.round((stats.data_driven / stats.total_decisions) * 100) : 0,
      values_alignment_rate: stats.total_decisions > 0 ? Math.round((stats.values_aligned / stats.total_decisions) * 100) : 0
    });

  } catch (error) {
    logger.error('Decisions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

/**
 * GET /api/daily/emergency-check
 * Check if emergency protocols should be triggered
 *
 * SECURITY FIX:
 * - Added admin/founder role requirement (prevents unauthorized access to system metrics)
 * - Replaced direct users table query with aggregated metrics table
 * - Uses pre-computed weekly metrics instead of scanning entire users table
 */
router.get('/emergency-check', requireAdminOrFounder, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const supabase = getSupabase();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - EMERGENCY_CONFIG.PRIORITY_LOOKBACK_DAYS);

    // Check: Missed #1 priority in the lookback period
    // This query is safe - filtered by user_id
    const { data: recentLogs } = await supabase
      .from('daily_sequences')
      .select('priority_completed, date')
      .eq('user_id', userId)
      .eq('sequence_type', 'evening')
      .gte('date', lookbackDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(EMERGENCY_CONFIG.PRIORITY_LOOKBACK_DAYS);

    const missedPriorities = recentLogs?.filter(l => !l.priority_completed).length || 0;
    const priorityAlert = missedPriorities >= EMERGENCY_CONFIG.MISSED_PRIORITY_THRESHOLD;

    // SECURITY FIX: Use aggregated metrics table instead of querying users table directly
    // This prevents potential data exposure and improves performance
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Query pre-aggregated weekly metrics (created by a scheduled job)
    // Falls back gracefully if table doesn't exist yet
    let signupsThisWeek = 0;
    let signupsLastWeek = 0;
    let metricsAvailable = false;

    try {
      const { data: weeklyMetrics, error: metricsError } = await supabase
        .from('system_metrics_weekly')
        .select('week_start, signup_count')
        .gte('week_start', fourteenDaysAgo.toISOString().split('T')[0])
        .order('week_start', { ascending: false })
        .limit(2);

      if (!metricsError && weeklyMetrics && weeklyMetrics.length > 0) {
        metricsAvailable = true;
        signupsThisWeek = weeklyMetrics[0]?.signup_count || 0;
        signupsLastWeek = weeklyMetrics[1]?.signup_count || 0;
      }
    } catch (metricsErr) {
      // Table may not exist yet - log and continue without signup metrics
      logger.warn('system_metrics_weekly table not available:', metricsErr.message);
    }

    const signupDecline = metricsAvailable &&
      signupsLastWeek > 0 &&
      signupsThisWeek < (signupsLastWeek * EMERGENCY_CONFIG.METRIC_DECLINE_THRESHOLD);

    const emergencyProtocols = [];

    if (priorityAlert) {
      emergencyProtocols.push({
        type: 'priority_misses',
        severity: 'high',
        message: `Missed #1 priority ${missedPriorities} times in ${EMERGENCY_CONFIG.PRIORITY_LOOKBACK_DAYS} days`,
        action: 'Run "Off Track" emergency protocol',
        protocol_url: '/founder/emergency/off-track',
        threshold: EMERGENCY_CONFIG.MISSED_PRIORITY_THRESHOLD
      });
    }

    if (signupDecline) {
      const declinePercent = Math.round(((signupsThisWeek - signupsLastWeek) / signupsLastWeek) * 100);
      emergencyProtocols.push({
        type: 'metric_decline',
        severity: 'critical',
        metric: 'signups',
        message: `Signups declined from ${signupsLastWeek} to ${signupsThisWeek} (${declinePercent}%)`,
        action: 'Run "Metrics Declining" red alert protocol',
        protocol_url: '/founder/emergency/metrics-declining',
        threshold_percent: Math.round((1 - EMERGENCY_CONFIG.METRIC_DECLINE_THRESHOLD) * 100)
      });
    }

    res.json({
      emergency_active: emergencyProtocols.length > 0,
      protocols: emergencyProtocols,
      health_check: {
        priority_completion_rate: recentLogs?.length > 0
          ? Math.round(((recentLogs.length - missedPriorities) / recentLogs.length) * 100)
          : 0,
        signup_trend: !metricsAvailable ? 'metrics_unavailable' : (signupDecline ? 'declining' : 'stable_or_growing'),
        metrics_source: metricsAvailable ? 'system_metrics_weekly' : 'unavailable'
      },
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Emergency check error:', error);
    res.status(500).json({
      error: 'Failed to run emergency check',
      code: 'EMERGENCY_CHECK_FAILED'
    });
  }
});

module.exports = router;

