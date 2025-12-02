
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

/**
 * POST /api/daily/morning-sequence
 * Complete the 10-minute morning sequence
 */
router.post('/morning-sequence', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
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

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('daily_sequences')
      .insert({
        user_id: userId,
        date: date || new Date().toISOString().split('T')[0],
        sequence_type: 'morning',
        metrics_checked: metrics_checked || false,
        competitive_intel_noted: competitive_intel_noted || false,
        priority_identified: priority_identified || false,
        priority_text,
        priority_quarterly_connection,
        priority_consequence,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'complete_morning_sequence', {
      date,
      priority: priority_text
    }, req);

    res.json({
      success: true,
      sequence: data,
      message: 'Morning sequence completed'
    });

  } catch (error) {
    logger.error('Morning sequence error:', error);
    res.status(500).json({ error: 'Failed to save morning sequence' });
  }
});

/**
 * POST /api/daily/evening-log
 * Complete the 5-minute evening log
 */
router.post('/evening-log', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      date,
      priority_completed,
      priority_miss_reason,
      todays_win,
      todays_lesson,
      efficiency_improvement_spotted,
      tomorrows_priority
    } = req.body;

    const supabase = getSupabase();

    // Update or insert evening log
    const { data, error } = await supabase
      .from('daily_sequences')
      .upsert({
        user_id: userId,
        date: date || new Date().toISOString().split('T')[0],
        sequence_type: 'evening',
        priority_completed: priority_completed || false,
        priority_miss_reason,
        todays_win,
        todays_lesson,
        efficiency_improvement_spotted,
        tomorrows_priority,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date,sequence_type'
      })
      .select()
      .single();

    if (error) throw error;

    // If efficiency improvement was spotted, create it
    if (efficiency_improvement_spotted) {
      await supabase
        .from('efficiency_improvements')
        .insert({
          user_id: userId,
          title: efficiency_improvement_spotted,
          description: `Spotted during evening log on ${date}`,
          area: 'operations',
          status: 'proposed',
          created_at: new Date().toISOString()
        });
    }

    await auditLogger.logUserAction(userId, 'complete_evening_log', {
      date,
      priority_completed
    }, req);

    res.json({
      success: true,
      log: data,
      message: 'Evening log completed'
    });

  } catch (error) {
    logger.error('Evening log error:', error);
    res.status(500).json({ error: 'Failed to save evening log' });
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
 */
router.get('/streak', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sequences, error } = await supabase
      .from('daily_sequences')
      .select('date, sequence_type')
      .eq('user_id', userId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    // Calculate streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date();

    // Group by date
    const dateMap = {};
    sequences?.forEach(seq => {
      if (!dateMap[seq.date]) {
        dateMap[seq.date] = { morning: false, evening: false };
      }
      dateMap[seq.date][seq.sequence_type] = true;
    });

    // Calculate current streak (both morning and evening)
    while (checkDate >= thirtyDaysAgo) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayData = dateMap[dateStr];

      if (dayData && dayData.morning && dayData.evening) {
        currentStreak++;
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (dateStr === today) {
          // Today might not be complete yet, don't break streak
          currentStreak++;
        } else {
          // Streak broken
          break;
        }
        tempStreak = 0;
      }

      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate completion rate
    const daysTracked = Object.keys(dateMap).length;
    const completeDays = Object.values(dateMap).filter(d => d.morning && d.evening).length;
    const completionRate = daysTracked > 0 ? Math.round((completeDays / daysTracked) * 100) : 0;

    res.json({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      completion_rate: completionRate,
      days_tracked: daysTracked,
      complete_days: completeDays,
      rockefeller_level: currentStreak >= 30 ? 'Master' : currentStreak >= 14 ? 'Advanced' : currentStreak >= 7 ? 'Building' : 'Beginner'
    });

  } catch (error) {
    logger.error('Streak calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate streak' });
  }
});

/**
 * POST /api/daily/decision-log
 * Log a major decision using the Rockefeller framework
 */
router.post('/decision-log', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
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

    if (!decision_title) {
      return res.status(400).json({ error: 'Decision title required' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('decision_log')
      .insert({
        user_id: userId,
        decision_title,
        decision_description,
        data_used: data_used || {},
        values_considered: values_aligned || [],
        outcome_prediction: JSON.stringify({
          baseline: baseline_metric,
          target: target_metric,
          success_criteria
        }),
        aligns_with_priority,
        decision_made,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'log_decision', {
      decision: decision_title
    }, req);

    res.json({
      success: true,
      decision: data,
      message: 'Decision logged using Rockefeller framework'
    });

  } catch (error) {
    logger.error('Decision log error:', error);
    res.status(500).json({ error: 'Failed to log decision' });
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
 */
router.get('/emergency-check', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Check: Missed #1 priority 2 weeks in a row
    const { data: recentLogs } = await supabase
      .from('daily_sequences')
      .select('priority_completed, date')
      .eq('user_id', userId)
      .eq('sequence_type', 'evening')
      .gte('date', twoWeeksAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(14);

    const missedPriorities = recentLogs?.filter(l => !l.priority_completed).length || 0;
    const priorityAlert = missedPriorities >= 10; // 10+ misses out of 14 days

    // Check: Declining metrics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { count: signupsThisWeek } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: signupsLastWeek } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString());

    const signupDecline = signupsThisWeek < (signupsLastWeek * 0.8); // 20% decline

    const emergencyProtocols = [];

    if (priorityAlert) {
      emergencyProtocols.push({
        type: 'priority_misses',
        severity: 'high',
        message: `Missed #1 priority ${missedPriorities} times in 14 days`,
        action: 'Run "Off Track" emergency protocol',
        protocol_url: '/founder/emergency/off-track'
      });
    }

    if (signupDecline) {
      emergencyProtocols.push({
        type: 'metric_decline',
        severity: 'critical',
        metric: 'signups',
        message: `Signups declined from ${signupsLastWeek} to ${signupsThisWeek} (${Math.round(((signupsThisWeek - signupsLastWeek) / signupsLastWeek) * 100)}%)`,
        action: 'Run "Metrics Declining" red alert protocol',
        protocol_url: '/founder/emergency/metrics-declining'
      });
    }

    res.json({
      emergency_active: emergencyProtocols.length > 0,
      protocols: emergencyProtocols,
      health_check: {
        priority_completion_rate: recentLogs?.length > 0 ? Math.round(((recentLogs.length - missedPriorities) / recentLogs.length) * 100) : 0,
        signup_trend: signupDecline ? 'declining' : 'stable_or_growing'
      }
    });

  } catch (error) {
    logger.error('Emergency check error:', error);
    res.status(500).json({ error: 'Failed to run emergency check' });
  }
});

module.exports = router;
