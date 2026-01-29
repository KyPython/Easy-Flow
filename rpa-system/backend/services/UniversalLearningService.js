/**
 * UniversalLearningService
 *
 * Centralized learning system for EasyFlow.
 * - Learns from automation task successes/failures
 * - Learns from workflow executions
 * - Aggregates user feedback
 * - Exposes optimized patterns (e.g. selectors) for future runs
 *
 * Design goals:
 * - Non-fatal: learning must never break core execution paths
 * - Observability: uses structured logging for all learning operations
 * - Extensible: schema is driven by migrations in add_universal_learning.sql
 */

const { getSupabase, isSupabaseConfigured } = require('../utils/supabaseClient');
const { getLogger } = require('../utils/logger');

// In‑memory cache for quick selector lookups
const patternCache = new Map(); // key: `${automationType}:${siteUrl}:${taskType}` -> patterns[]

class UniversalLearningService {
  constructor() {
    this.logger = getLogger('learning.universal');
    this.supabase = null;
  }

  _ensureClient() {
    if (!isSupabaseConfigured()) {
      this.logger.warn('[UniversalLearningService] Supabase is not configured; learning is disabled.');
      return null;
    }
    if (!this.supabase) {
      this.supabase = getSupabase();
    }
    return this.supabase;
  }

  _buildPatternKey(automationType, siteUrl, taskType) {
    return `${automationType || 'generic'}:${siteUrl || 'unknown'}:${taskType || 'general'}`;
  }

  /**
   * Learn from successful automation execution.
   * Called from Kafka service after a run completes successfully.
   */
  async learnFromAutomationSuccess({
    automationType,
    siteUrl,
    taskType,
    selectorsUsed,
    config,
    executionTime,
    resultData,
    userId
  }) {
    const supabase = this._ensureClient();
    if (!supabase) return;

    const key = this._buildPatternKey(automationType, siteUrl, taskType);

    try {
      const payload = {
        automation_type: automationType || 'web_automation',
        site_url: siteUrl || null,
        task_type: taskType || 'general',
        selectors_used: Array.isArray(selectorsUsed) ? selectorsUsed : [],
        config_snapshot: config || {},
        execution_time_ms: executionTime || null,
        result_data: resultData || {},
        user_id: userId || null
      };

      const { error } = await supabase
        .from('automation_learning_patterns')
        .insert(payload);

      if (error) {
        this.logger.warn('[UniversalLearningService] Failed to record automation success (non‑fatal)', {
          error: error.message
        });
        return;
      }

      // Update in‑memory cache optimistically
      const existing = patternCache.get(key) || [];
      patternCache.set(key, [...existing, payload]);

      this.logger.info('[UniversalLearningService] Learned from automation success', {
        automationType,
        siteUrl,
        taskType
      });
    } catch (err) {
      this.logger.warn('[UniversalLearningService] Error learning from automation success (non‑fatal)', {
        error: err.message
      });
    }
  }

  /**
   * Learn from failed automation execution.
   */
  async learnFromAutomationFailure({
    automationType,
    siteUrl,
    taskType,
    errorMessage,
    attemptedConfig,
    executionTime,
    userId
  }) {
    const supabase = this._ensureClient();
    if (!supabase) return;

    try {
      const payload = {
        automation_type: automationType || 'web_automation',
        site_url: siteUrl || null,
        task_type: taskType || 'general',
        error_message: errorMessage || 'Task failed',
        attempted_config: attemptedConfig || {},
        execution_time_ms: executionTime || null,
        user_id: userId || null
      };

      const { error } = await supabase
        .from('automation_learning_failures')
        .insert(payload);

      if (error) {
        this.logger.warn('[UniversalLearningService] Failed to record automation failure (non‑fatal)', {
          error: error.message
        });
        return;
      }

      this.logger.info('[UniversalLearningService] Learned from automation failure', {
        automationType,
        siteUrl,
        taskType
      });
    } catch (err) {
      this.logger.warn('[UniversalLearningService] Error learning from automation failure (non‑fatal)', {
        error: err.message
      });
    }
  }

  /**
   * Learn from successful workflow execution.
   * Called from workflowExecutor when a workflow completes.
   */
  async learnFromWorkflowSuccess({
    workflowId,
    workflowName,
    steps,
    executionTime,
    inputData,
    resultData,
    userId
  }) {
    const supabase = this._ensureClient();
    if (!supabase) return;

    try {
      const payload = {
        workflow_id: workflowId,
        workflow_name: workflowName,
        steps: steps || [],
        execution_time_ms: executionTime || null,
        input_data: inputData || {},
        result_data: resultData || {},
        user_id: userId || null
      };

      const { error } = await supabase
        .from('workflow_learning_patterns')
        .insert(payload);

      if (error) {
        this.logger.warn('[UniversalLearningService] Failed to record workflow success (non‑fatal)', {
          error: error.message
        });
        return;
      }

      this.logger.info('[UniversalLearningService] Learned from workflow success', {
        workflowId,
        workflowName
      });
    } catch (err) {
      this.logger.warn('[UniversalLearningService] Error learning from workflow success (non‑fatal)', {
        error: err.message
      });
    }
  }

  /**
   * Fetch learned patterns for a given automation type/site/task combination.
   * Used by run‑task‑with‑ai endpoint before executing a new task.
   */
  async getLearnedPatterns(automationType, siteUrl, taskType) {
    const supabase = this._ensureClient();
    if (!supabase) return [];

    const key = this._buildPatternKey(automationType, siteUrl, taskType);

    // 1) Try cache
    if (patternCache.has(key)) {
      return patternCache.get(key);
    }

    try {
      const { data, error } = await supabase
        .from('automation_learning_patterns')
        .select('*')
        .eq('automation_type', automationType || 'web_automation')
        .eq('task_type', taskType || 'general')
        .ilike('site_url', siteUrl || '%')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) {
        this.logger.warn('[UniversalLearningService] Failed to fetch learned patterns (non‑fatal)', {
          error: error.message
        });
        return [];
      }

      const patterns = data || [];
      patternCache.set(key, patterns);
      return patterns;
    } catch (err) {
      this.logger.warn('[UniversalLearningService] Error fetching learned patterns (non‑fatal)', {
        error: err.message
      });
      return [];
    }
  }

  /**
   * Convenience helper to compute optimized selectors from learned patterns.
   * For now this simply returns the last known selectors; can be extended later.
   */
  async getOptimizedSelectors(automationType, siteUrl, taskType) {
    const patterns = await this.getLearnedPatterns(automationType, siteUrl, taskType);
    if (!patterns.length) return [];

    // Naive strategy: take selectors from the most recent successful pattern
    const latest = patterns.find(p => Array.isArray(p.selectors_used) && p.selectors_used.length > 0)
      || patterns[0];

    return latest.selectors_used || [];
  }

  /**
   * Learn from explicit user feedback (e.g. thumbs up/down, corrections).
   */
  async learnFromUserFeedback({
    userId,
    automationType,
    siteUrl,
    taskType,
    feedbackType,
    feedbackText,
    metadata
  }) {
    const supabase = this._ensureClient();
    if (!supabase) return;

    try {
      const payload = {
        user_id: userId || null,
        automation_type: automationType || 'web_automation',
        site_url: siteUrl || null,
        task_type: taskType || 'general',
        feedback_type: feedbackType || 'generic',
        feedback_text: feedbackText || null,
        metadata: metadata || {}
      };

      const { error } = await supabase
        .from('user_feedback_learning')
        .insert(payload);

      if (error) {
        this.logger.warn('[UniversalLearningService] Failed to record user feedback (non‑fatal)', {
          error: error.message
        });
        return;
      }

      this.logger.info('[UniversalLearningService] Recorded user feedback', {
        automationType,
        siteUrl,
        taskType,
        feedbackType
      });
    } catch (err) {
      this.logger.warn('[UniversalLearningService] Error learning from user feedback (non‑fatal)', {
        error: err.message
      });
    }
  }

  /**
   * Analyze existing patterns and produce high‑level suggestions.
   * For now, this is a thin wrapper over getLearnedPatterns plus
   * some simple heuristics; it can be extended to use AI later.
   */
  async analyzeAndSuggestImprovements({ automationType, siteUrl, taskType }) {
    const patterns = await this.getLearnedPatterns(automationType, siteUrl, taskType);
    if (!patterns.length) {
      return {
        hasData: false,
        suggestions: [],
        stats: {}
      };
    }

    const total = patterns.length;
    const withSelectors = patterns.filter(p => Array.isArray(p.selectors_used) && p.selectors_used.length > 0);

    const suggestions = [];
    if (withSelectors.length === 0) {
      suggestions.push('No stable selectors have been learned yet. Consider enabling AI‑assisted selector discovery.');
    } else if (withSelectors.length < total / 2) {
      suggestions.push('Selectors are only present on a subset of successful runs. Standardize selector configuration for more reliable automation.');
    } else {
      suggestions.push('Stable selectors have been learned for this site. Reuse them by default for faster, more reliable runs.');
    }

    return {
      hasData: true,
      suggestions,
      stats: {
        totalPatterns: total,
        patternsWithSelectors: withSelectors.length
      }
    };
  }
}

// Singleton factory used throughout the backend
let singleton = null;

function getUniversalLearningService() {
  if (!singleton) {
    singleton = new UniversalLearningService();
  }
  return singleton;
}

module.exports = {
  UniversalLearningService,
  getUniversalLearningService
};

