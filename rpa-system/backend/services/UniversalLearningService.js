/**
 * Universal Learning Service
 *
 * Makes EasyFlow learn from every automation, workflow, and user interaction.
 * The system gets smarter with every run, adapting to changes and improving performance.
 *
 * Features:
 * - Learns from successful automations
 * - Adapts to site changes automatically
 * - Tracks workflow patterns
 * - Learns from user feedback
 * - Improves selector strategies
 * - Optimizes execution paths
 */

const { logger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');

class UniversalLearningService {
  constructor() {
    this.supabase = getSupabase();
    // In-memory caches for fast lookups
    this.patternCache = new Map();
    this.selectorCache = new Map();
    this.workflowCache = new Map();
  }

  /**
   * ✅ LEARN FROM AUTOMATION SUCCESS
   * Stores patterns that worked for any automation type
   */
  async learnFromAutomationSuccess({
    automationType,
    siteUrl,
    taskType,
    selectorsUsed = [],
    config = {},
    executionTime,
    resultData = {},
    userId = null
  }) {
    try {
      if (!this.supabase) {
        logger.warn('[UniversalLearning] Supabase not available, skipping learning');
        return;
      }

      const normalizedUrl = this._normalizeUrl(siteUrl);
      const patternKey = `${automationType}:${normalizedUrl}:${taskType}`;

      // Extract learnable patterns
      const pattern = {
        automation_type: automationType,
        site_url: normalizedUrl,
        task_type: taskType,
        selectors_used: selectorsUsed,
        config_snapshot: this._sanitizeConfig(config),
        execution_time_ms: executionTime,
        result_summary: this._extractResultSummary(resultData),
        success_count: 1,
        last_success_at: new Date().toISOString(),
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Get existing pattern to increment success count
      const { data: existing } = await this.supabase
        .from('automation_learning_patterns')
        .select('success_count, failure_count')
        .eq('automation_type', automationType)
        .eq('site_url', normalizedUrl)
        .eq('task_type', taskType)
        .maybeSingle();

      const { error } = await this.supabase
        .from('automation_learning_patterns')
        .upsert({
          ...pattern,
          success_count: (existing?.success_count || 0) + 1,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'automation_type,site_url,task_type'
        });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          logger.info('[UniversalLearning] Learning tables not created yet. Run migration: add_universal_learning.sql');
          return;
        }
        logger.warn('[UniversalLearning] Error learning from automation success:', error);
      } else {
        logger.info('[UniversalLearning] ✅ Learned automation pattern', {
          automationType,
          siteUrl: normalizedUrl,
          taskType,
          successCount: (existing?.success_count || 0) + 1
        });
        // Clear cache
        this.patternCache.delete(patternKey);
      }
    } catch (error) {
      logger.warn('[UniversalLearning] Error in learnFromAutomationSuccess:', error);
    }
  }

  /**
   * ✅ LEARN FROM AUTOMATION FAILURE
   * Records what didn't work to avoid repeating mistakes
   */
  async learnFromAutomationFailure({
    automationType,
    siteUrl,
    taskType,
    errorMessage,
    attemptedConfig = {},
    executionTime,
    userId = null
  }) {
    try {
      if (!this.supabase) {
        return;
      }

      const normalizedUrl = this._normalizeUrl(siteUrl);

      // Record failure
      await this.supabase
        .from('automation_learning_failures')
        .insert({
          automation_type: automationType,
          site_url: normalizedUrl,
          task_type: taskType,
          error_message: errorMessage,
          attempted_config: this._sanitizeConfig(attemptedConfig),
          execution_time_ms: executionTime,
          user_id: userId,
          occurred_at: new Date().toISOString()
        });

      // Update pattern failure count
      const { data: existing } = await this.supabase
        .from('automation_learning_patterns')
        .select('failure_count')
        .eq('automation_type', automationType)
        .eq('site_url', normalizedUrl)
        .eq('task_type', taskType)
        .maybeSingle();

      if (existing) {
        await this.supabase
          .from('automation_learning_patterns')
          .update({
            failure_count: (existing.failure_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('automation_type', automationType)
          .eq('site_url', normalizedUrl)
          .eq('task_type', taskType);
      }

      logger.info('[UniversalLearning] Failure pattern recorded', {
        automationType,
        siteUrl: normalizedUrl,
        taskType
      });
    } catch (error) {
      logger.warn('[UniversalLearning] Error learning from failure:', error);
    }
  }

  /**
   * ✅ GET LEARNED PATTERNS FOR AUTOMATION
   * Returns patterns that worked before, prioritized by success rate
   */
  async getLearnedPatterns(automationType, siteUrl, taskType) {
    try {
      const cacheKey = `${automationType}:${this._normalizeUrl(siteUrl)}:${taskType}`;

      // Check cache first
      if (this.patternCache.has(cacheKey)) {
        return this.patternCache.get(cacheKey);
      }

      if (!this.supabase) {
        return [];
      }

      const normalizedUrl = this._normalizeUrl(siteUrl);

      const { data, error } = await this.supabase
        .from('automation_learning_patterns')
        .select('*')
        .eq('automation_type', automationType)
        .eq('site_url', normalizedUrl)
        .eq('task_type', taskType)
        .order('success_count', { ascending: false })
        .order('last_success_at', { ascending: false })
        .limit(5);

      if (error) {
        if (error.code === 'PGRST116') {
          return [];
        }
        logger.warn('[UniversalLearning] Error fetching patterns:', error);
        return [];
      }

      // Cache for 5 minutes
      this.patternCache.set(cacheKey, data || []);
      setTimeout(() => this.patternCache.delete(cacheKey), 5 * 60 * 1000);

      return data || [];
    } catch (error) {
      logger.warn('[UniversalLearning] Error getting learned patterns:', error);
      return [];
    }
  }

  /**
   * ✅ LEARN FROM WORKFLOW EXECUTION
   * Tracks successful workflow patterns
   */
  async learnFromWorkflowSuccess({
    workflowId,
    workflowName,
    steps = [],
    executionTime,
    inputData = {},
    resultData = {},
    userId = null
  }) {
    try {
      if (!this.supabase) {
        return;
      }

      // Extract workflow pattern
      const pattern = {
        workflow_id: workflowId,
        workflow_name: workflowName,
        step_pattern: steps.map(step => ({
          type: step.step_type || step.action_type,
          config: this._sanitizeConfig(step.config || {}),
          order: step.order || step.sequence
        })),
        input_pattern: this._extractInputPattern(inputData),
        execution_time_ms: executionTime,
        success_count: 1,
        last_success_at: new Date().toISOString(),
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: existing } = await this.supabase
        .from('workflow_learning_patterns')
        .select('success_count')
        .eq('workflow_id', workflowId)
        .maybeSingle();

      const { error } = await this.supabase
        .from('workflow_learning_patterns')
        .upsert({
          ...pattern,
          success_count: (existing?.success_count || 0) + 1,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workflow_id'
        });

      if (error) {
        if (error.code === 'PGRST116') {
          logger.info('[UniversalLearning] Workflow learning tables not created yet');
          return;
        }
        logger.warn('[UniversalLearning] Error learning from workflow:', error);
      } else {
        logger.info('[UniversalLearning] ✅ Learned workflow pattern', {
          workflowId,
          workflowName,
          stepsCount: steps.length
        });
        this.workflowCache.delete(workflowId);
      }
    } catch (error) {
      logger.warn('[UniversalLearning] Error learning from workflow:', error);
    }
  }

  /**
   * ✅ GET OPTIMIZED SELECTORS FOR SITE
   * Returns best-performing selectors for a site based on learning
   */
  async getOptimizedSelectors(siteUrl, taskType, automationType = 'web_automation') {
    try {
      const cacheKey = `selectors:${this._normalizeUrl(siteUrl)}:${taskType}`;

      if (this.selectorCache.has(cacheKey)) {
        return this.selectorCache.get(cacheKey);
      }

      const patterns = await this.getLearnedPatterns(automationType, siteUrl, taskType);

      if (patterns.length === 0) {
        return [];
      }

      // Get selectors from most successful pattern
      const bestPattern = patterns[0];
      const selectors = bestPattern.selectors_used || [];

      // Cache for 10 minutes
      this.selectorCache.set(cacheKey, selectors);
      setTimeout(() => this.selectorCache.delete(cacheKey), 10 * 60 * 1000);

      return selectors;
    } catch (error) {
      logger.warn('[UniversalLearning] Error getting optimized selectors:', error);
      return [];
    }
  }

  /**
   * ✅ LEARN FROM USER FEEDBACK
   * Incorporates user corrections and preferences
   */
  async learnFromUserFeedback({
    automationType,
    siteUrl,
    taskType,
    feedback,
    correctedConfig = {},
    userId = null
  }) {
    try {
      if (!this.supabase) {
        return;
      }

      const normalizedUrl = this._normalizeUrl(siteUrl);

      await this.supabase
        .from('user_feedback_learning')
        .insert({
          automation_type: automationType,
          site_url: normalizedUrl,
          task_type: taskType,
          feedback_text: feedback,
          corrected_config: this._sanitizeConfig(correctedConfig),
          user_id: userId,
          created_at: new Date().toISOString()
        });

      // Update pattern with user correction
      if (Object.keys(correctedConfig).length > 0) {
        await this.supabase
          .from('automation_learning_patterns')
          .update({
            selectors_used: correctedConfig.selectors || [],
            config_snapshot: this._sanitizeConfig(correctedConfig),
            updated_at: new Date().toISOString(),
            user_corrected: true
          })
          .eq('automation_type', automationType)
          .eq('site_url', normalizedUrl)
          .eq('task_type', taskType);
      }

      logger.info('[UniversalLearning] ✅ User feedback incorporated', {
        automationType,
        siteUrl: normalizedUrl,
        taskType
      });
    } catch (error) {
      logger.warn('[UniversalLearning] Error learning from feedback:', error);
    }
  }

  /**
   * ✅ GET SUCCESS RATE FOR PATTERN
   * Returns how reliable a pattern is (0-1)
   */
  async getPatternSuccessRate(automationType, siteUrl, taskType) {
    try {
      const patterns = await this.getLearnedPatterns(automationType, siteUrl, taskType);

      if (patterns.length === 0) {
        return 0;
      }

      const pattern = patterns[0];
      const total = (pattern.success_count || 0) + (pattern.failure_count || 0);

      if (total === 0) {
        return 0;
      }

      return pattern.success_count / total;
    } catch (error) {
      logger.warn('[UniversalLearning] Error getting success rate:', error);
      return 0;
    }
  }

  /**
   * ✅ ANALYZE AND SUGGEST IMPROVEMENTS
   * Analyzes patterns and suggests optimizations
   */
  async analyzeAndSuggestImprovements(automationType, siteUrl, taskType) {
    try {
      const patterns = await this.getLearnedPatterns(automationType, siteUrl, taskType);
      const failures = await this._getRecentFailures(automationType, siteUrl, taskType);

      if (patterns.length === 0 && failures.length === 0) {
        return { suggestions: [] };
      }

      const suggestions = [];

      // Check if failure rate is high
      const successRate = await this.getPatternSuccessRate(automationType, siteUrl, taskType);
      if (successRate < 0.5 && patterns.length > 0) {
        suggestions.push({
          type: 'high_failure_rate',
          message: `Success rate is ${(successRate * 100).toFixed(0)}%. Consider updating selectors or configuration.`,
          priority: 'high'
        });
      }

      // Check for common failure patterns
      const commonErrors = this._analyzeFailurePatterns(failures);
      if (commonErrors.length > 0) {
        suggestions.push({
          type: 'common_errors',
          message: `Common issues detected: ${commonErrors.join(', ')}`,
          recommendations: this._getRecommendationsForErrors(commonErrors),
          priority: 'medium'
        });
      }

      // Check execution time trends
      if (patterns.length > 0) {
        const avgTime = patterns[0].execution_time_ms;
        if (avgTime > 30000) {
          suggestions.push({
            type: 'slow_execution',
            message: `Average execution time is ${(avgTime / 1000).toFixed(1)}s. Consider optimizing selectors or reducing wait times.`,
            priority: 'low'
          });
        }
      }

      return { suggestions };
    } catch (error) {
      logger.warn('[UniversalLearning] Error analyzing improvements:', error);
      return { suggestions: [] };
    }
  }

  // ========== PRIVATE HELPER METHODS ==========

  _normalizeUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  _sanitizeConfig(config) {
    // Remove sensitive data and large objects
    const sanitized = { ...config };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    // Limit size
    return JSON.parse(JSON.stringify(sanitized).substring(0, 10000));
  }

  _extractResultSummary(resultData) {
    if (!resultData) return {};
    return {
      success: resultData.success || false,
      itemsFound: resultData.itemsFound || resultData.count || 0,
      hasData: !!(resultData.data || resultData.result)
    };
  }

  _extractInputPattern(inputData) {
    if (!inputData) return {};
    // Extract structure without values
    const pattern = {};
    for (const key in inputData) {
      pattern[key] = typeof inputData[key];
    }
    return pattern;
  }

  async _getRecentFailures(automationType, siteUrl, taskType, limit = 10) {
    try {
      if (!this.supabase) return [];

      const { data } = await this.supabase
        .from('automation_learning_failures')
        .select('*')
        .eq('automation_type', automationType)
        .eq('site_url', this._normalizeUrl(siteUrl))
        .eq('task_type', taskType)
        .order('occurred_at', { ascending: false })
        .limit(limit);

      return data || [];
    } catch {
      return [];
    }
  }

  _analyzeFailurePatterns(failures) {
    const errorCounts = {};
    failures.forEach(failure => {
      const error = failure.error_message || '';
      const errorType = this._categorizeError(error);
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .filter(([_, count]) => count >= 2)
      .map(([errorType]) => errorType);
  }

  _categorizeError(errorMessage) {
    const msg = errorMessage.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
    if (msg.includes('selector') || msg.includes('element not found')) return 'selector_not_found';
    if (msg.includes('login') || msg.includes('authentication')) return 'authentication';
    if (msg.includes('network') || msg.includes('connection')) return 'network';
    return 'other';
  }

  _getRecommendationsForErrors(errorTypes) {
    const recommendations = [];
    if (errorTypes.includes('timeout')) {
      recommendations.push('Increase timeout values or optimize page load wait times');
    }
    if (errorTypes.includes('selector_not_found')) {
      recommendations.push('Update CSS selectors - elements may have changed on the site');
    }
    if (errorTypes.includes('authentication')) {
      recommendations.push('Verify login credentials are correct and up to date');
    }
    if (errorTypes.includes('network')) {
      recommendations.push('Check network connectivity and site availability');
    }
    return recommendations;
  }
}

// Export singleton instance
let _instance = null;
function getUniversalLearningService() {
  if (!_instance) {
    _instance = new UniversalLearningService();
  }
  return _instance;
}

module.exports = {
  UniversalLearningService,
  getUniversalLearningService
};


