/**
 * Boundary Enforcement Service
 * 
 * Automatically enforces system boundaries for user behavior:
 * - Auto-throttling: Limits execution frequency for safety
 * - Auto-pause: Pauses workflows with repeated failures
 * - Auto-disable: Temporarily disables accounts with chronic issues
 * 
 * This is the #1 difference between "founder-invisible SaaS" and
 * "founder-drowning-in-support-tickets SaaS"
 */

const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../../utils/supabaseClient');
const { createLogger } = require('../../middleware/structuredLogging');
const { ErrorCategory } = require('../errorResolution/errorCategories');
const { UserFacingErrorService } = require('../errorResolution/userFacingErrorService');

const logger = createLogger('services.boundaryEnforcement');

class BoundaryEnforcementService {
  constructor() {
    this.supabase = getSupabase();
    this.errorService = new UserFacingErrorService();
    
    // In-memory state for fast access (persisted to DB periodically)
    this.userStateCache = new Map();
    
    // Threshold configuration
    this.config = {
      autoThrottle: {
        // Execution frequency limits
        maxExecutionsPerMinute: parseInt(process.env.BOUNDARY_MAX_PER_MINUTE || '10', 10),
        maxExecutionsPerHour: parseInt(process.env.BOUNDARY_MAX_PER_HOUR || '100', 10),
        maxExecutionsPerDay: parseInt(process.env.BOUNDARY_MAX_PER_DAY || '500', 10),
        
        // Consecutive failure limits
        maxConsecutiveFailures: parseInt(process.env.BOUNDARY_MAX_CONSECUTIVE_FAILURES || '3', 10),
        
        // Throttle duration
        throttleDurationMinutes: parseInt(process.env.BOUNDARY_THROTTLE_MINUTES || '30', 10),
        
        // Grace period before enforcement (allows burst)
        gracePeriodExecutions: parseInt(process.env.BOUNDARY_GRACE_PERIOD || '2', 10)
      },
      
      autoPause: {
        // Failure count limits
        maxFailuresPerHour: parseInt(process.env.BOUNDARY_MAX_FAILURES_PER_HOUR || '5', 10),
        maxFailuresPerDay: parseInt(process.env.BOUNDARY_MAX_FAILURES_PER_DAY || '20', 10),
        
        // Failure window
        failureWindowMinutes: parseInt(process.env.BOUNDARY_FAILURE_WINDOW || '60', 10),
        
        // Minimum time between pause and next enforcement
        pauseCooldownMinutes: parseInt(process.env.BOUNDARY_PAUSE_COOLDOWN || '60', 10)
      },
      
      autoDisable: {
        // Pause count limit before disable
        maxPauseCount: parseInt(process.env.BOUNDARY_MAX_PAUSE_COUNT || '3', 10),
        
        // Consecutive days with failures
        maxConsecutiveFailureDays: parseInt(process.env.BOUNDARY_MAX_FAILURE_DAYS || '5', 10),
        
        // Disable duration
        disableDurationHours: parseInt(process.env.BOUNDARY_DISABLE_HOURS || '24', 10),
        
        // Minimum time between disable and next disable
        disableCooldownHours: parseInt(process.env.BOUNDARY_DISABLE_COOLDOWN || '168', 10) // 7 days
      },
      
      // Global overrides
      bypassUsers: (process.env.BOUNDARY_BYPASS_USERS || '').split(',').filter(Boolean),
      bypassPlans: (process.env.BOUNDARY_BYPASS_PLANS || 'enterprise').split(',').filter(Boolean)
    };
  }

  /**
   * Check and enforce boundaries for a user execution
   * @param {string} userId - User ID
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Boundary status and any enforcement action taken
   */
  async checkBoundaries(userId, context = {}) {
    // Check if user should bypass boundaries
    if (this._shouldBypass(userId)) {
      return { action: 'NONE', bypassed: true };
    }

    // Get or create user state
    const state = await this._getOrCreateUserState(userId);
    
    // Check each boundary level
    const throttleResult = await this._checkThrottle(userId, state, context);
    if (throttleResult.enforced) {
      return this._handleThrottle(userId, state, throttleResult, context);
    }
    
    const pauseResult = await this._checkAutoPause(userId, state, context);
    if (pauseResult.enforced) {
      return this._handleAutoPause(userId, state, pauseResult, context);
    }
    
    const disableResult = await this._checkAutoDisable(userId, state, context);
    if (disableResult.enforced) {
      return this._handleAutoDisable(userId, state, disableResult, context);
    }
    
    // Update state with successful execution
    await this._recordExecution(userId, state, { success: true, ...context });
    
    return { action: 'NONE' };
  }

  /**
   * Record execution result for boundary calculations
   * @param {string} userId - User ID
   * @param {Object} context - Execution context
   * @returns {Promise<void>}
   */
  async recordExecution(userId, context = {}) {
    const state = await this._getOrCreateUserState(userId);
    await this._recordExecution(userId, state, context);
  }

  /**
   * Record failure for boundary calculations
   * @param {string} userId - User ID
   * @param {Object} context - Failure context
   * @returns {Promise<Object>} Updated boundary status
   */
  async recordFailure(userId, context = {}) {
    return this.checkBoundaries(userId, { success: false, ...context });
  }

  /**
   * Get current boundary status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Current boundary status
   */
  async getBoundaryStatus(userId) {
    const state = await this._getOrCreateUserState(userId);
    const now = Date.now();
    
    return {
      userId,
      isThrottled: this._isCurrentlyThrottled(state),
      throttleUntil: state.throttleUntil || null,
      isPaused: state.pauseInfo?.isPaused || false,
      pauseUntil: state.pauseInfo?.pauseUntil || null,
      pausedWorkflows: state.pauseInfo?.workflowIds || [],
      isDisabled: state.disableInfo?.isDisabled || false,
      disableUntil: state.disableInfo?.disableUntil || null,
      stats: {
        totalExecutionsToday: state.todayExecutions,
        consecutiveFailures: state.consecutiveFailures,
        totalFailuresToday: state.todayFailures,
        pauseCount: state.pauseCount,
        lastExecutionAt: state.lastExecutionAt
      }
    };
  }

  /**
   * Manually resume a paused user or workflow
   * @param {string} userId - User ID
   * @param {string} workflowId - Optional workflow ID
   * @returns {Promise<Object>} Updated status
   */
  async resume(userId, workflowId = null) {
    const state = await this._getOrCreateUserState(userId);
    
    if (workflowId) {
      // Resume specific workflow
      if (state.pauseInfo?.workflowIds?.includes(workflowId)) {
        state.pauseInfo.workflowIds = state.pauseInfo.workflowIds.filter(id => id !== workflowId);
        
        if (state.pauseInfo.workflowIds.length === 0) {
          state.pauseInfo.isPaused = false;
          state.pauseInfo.pauseUntil = null;
        }
        
        await this._saveUserState(userId, state);
      }
    } else {
      // Resume user entirely (requires elevated permissions)
      state.throttleUntil = null;
      state.pauseInfo = { isPaused: false, workflowIds: [], pauseUntil: null };
      // Note: We don't auto-resume disabled accounts - requires support
      
      await this._saveUserState(userId, state);
      
      logger.info('Boundary enforcement manually resumed', { userId });
    }
    
    return this.getBoundaryStatus(userId);
  }

  // =====================================================
  // Throttling
  // =====================================================

  /**
   * Check if user should be throttled
   */
  async _checkThrottle(userId, state, context) {
    const now = Date.now();
    
    // Clean old entries
    this._cleanState(state, now);
    
    // Check if currently throttled
    if (this._isCurrentlyThrottled(state)) {
      return {
        enforced: true,
        reason: 'currently_throttled',
        throttleUntil: state.throttleUntil,
        remainingMs: state.throttleUntil - now
      };
    }
    
    const { maxExecutionsPerMinute, maxExecutionsPerHour, maxConsecutiveFailures, gracePeriodExecutions } = this.config.autoThrottle;
    
    // Count recent executions
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentExecutions = state.executionHistory.filter(e => e.timestamp > oneMinuteAgo);
    const hourlyExecutions = state.executionHistory.filter(e => e.timestamp > oneHourAgo);
    
    // Check per-minute limit (with grace period)
    if (recentExecutions.length >= maxExecutionsPerMinute + gracePeriodExecutions) {
      return {
        enforced: true,
        reason: 'exceeded_per_minute_limit',
        limit: maxExecutionsPerMinute,
        actual: recentExecutions.length,
        duration: this.config.autoThrottle.throttleDurationMinutes * 60 * 1000
      };
    }
    
    // Check per-hour limit
    if (hourlyExecutions.length >= maxExecutionsPerHour) {
      return {
        enforced: true,
        reason: 'exceeded_per_hour_limit',
        limit: maxExecutionsPerHour,
        actual: hourlyExecutions.length,
        duration: this.config.autoThrottle.throttleDurationMinutes * 60 * 1000
      };
    }
    
    // Check consecutive failure throttle
    if (state.consecutiveFailures >= maxConsecutiveFailures && !context.success) {
      return {
        enforced: true,
        reason: 'consecutive_failures',
        failures: state.consecutiveFailures,
        limit: maxConsecutiveFailures,
        duration: this.config.autoThrottle.throttleDurationMinutes * 60 * 1000
      };
    }
    
    return { enforced: false };
  }

  /**
   * Handle throttle enforcement
   */
  async _handleThrottle(userId, state, result, context) {
    const throttleUntil = Date.now() + result.duration;
    
    // Update state
    state.throttleUntil = throttleUntil;
    await this._saveUserState(userId, state);
    
    // Generate user-facing response
    const userFacing = await this.errorService.toUserFacing(
      new Error('Auto-throttled due to high frequency'),
      ErrorCategory.BOUNDARY_AUTO_THROTTLED,
      {
        userId,
        workflowId: context.workflowId,
        count: result.actual || result.failures,
        time: result.reason.includes('minute') ? 'the last minute' : 'the last hour',
        duration: Math.round(result.duration / 60000) + ' minutes'
      }
    );
    
    logger.warn('User auto-throttled', {
      userId,
      reason: result.reason,
      limit: result.limit,
      actual: result.actual,
      throttleUntil
    });
    
    return {
      action: 'THROTTLED',
      throttleUntil,
      retryAfter: result.duration,
      ...userFacing
    };
  }

  /**
   * Check if user is currently throttled
   */
  _isCurrentlyThrottled(state) {
    return state.throttleUntil && state.throttleUntil > Date.now();
  }

  // =====================================================
  // Auto-Pause
  // =====================================================

  /**
   * Check if user workflow should be auto-paused
   */
  async _checkAutoPause(userId, state, context) {
    const { workflowId } = context;
    if (!workflowId) return { enforced: false };
    
    const now = Date.now();
    const { maxFailuresPerHour, failureWindowMinutes, pauseCooldownMinutes } = this.config.autoPause;
    
    // Check cooldown
    if (state.pauseInfo?.pauseUntil && state.pauseInfo.pauseUntil > now) {
      return { enforced: false, inCooldown: true };
    }
    
    // Get or create workflow state
    if (!state.workflowStates) {
      state.workflowStates = {};
    }
    
    const workflowState = state.workflowStates[workflowId] || {
      failures: [],
      lastPausedAt: null
    };
    
    // Clean old failures
    const windowStart = now - failureWindowMinutes * 60 * 1000;
    workflowState.failures = workflowState.failures.filter(f => f > windowStart);
    
    // Check hourly failure limit
    if (workflowState.failures.length >= maxFailuresPerHour) {
      return {
        enforced: true,
        workflowId,
        reason: 'hourly_failure_limit',
        failureCount: workflowState.failures.length,
        limit: maxFailuresPerHour,
        suggestedFix: this._analyzeFailurePattern(workflowState.failures)
      };
    }
    
    // Update workflow state
    state.workflowStates[workflowId] = workflowState;
    await this._saveUserState(userId, state);
    
    return { enforced: false };
  }

  /**
   * Handle auto-pause enforcement
   */
  async _handleAutoPause(userId, state, result, context) {
    const pauseUntil = Date.now() + this.config.autoPause.failureWindowMinutes * 60 * 1000;
    
    // Update state
    state.pauseInfo = {
      isPaused: true,
      pauseUntil,
      workflowIds: [...(state.pauseInfo?.workflowIds || []), result.workflowId]
    };
    state.pauseCount = (state.pauseCount || 0) + 1;
    
    // Update workflow state
    state.workflowStates = state.workflowStates || {};
    state.workflowStates[result.workflowId] = {
      ...state.workflowStates[result.workflowId],
      lastPausedAt: Date.now()
    };
    
    await this._saveUserState(userId, state);
    
    // Pause the workflow in database
    await this._pauseWorkflow(result.workflowId, userId);
    
    // Generate user-facing response
    const userFacing = await this.errorService.toUserFacing(
      new Error('Workflow auto-paused due to repeated failures'),
      ErrorCategory.BOUNDARY_AUTO_PAUSED,
      {
        userId,
        workflowId: result.workflowId,
        count: result.failureCount,
        suggestedFix: result.suggestedFix
      }
    );
    
    logger.warn('Workflow auto-paused', {
      userId,
      workflowId: result.workflowId,
      failureCount: result.failureCount,
      pauseUntil
    });
    
    return {
      action: 'PAUSED',
      workflowId: result.workflowId,
      pauseUntil,
      ...userFacing
    };
  }

  // =====================================================
  // Auto-Disable
  // =====================================================

  /**
   * Check if user account should be auto-disabled
   */
  async _checkAutoDisable(userId, state, context) {
    if (!this.config.autoDisable.maxPauseCount) {
      return { enforced: false }; // Auto-disable disabled
    }
    
    const now = Date.now();
    
    // Check cooldown
    if (state.disableInfo?.disableUntil && state.disableInfo.disableUntil > now) {
      return { enforced: false, inCooldown: true };
    }
    
    // Check pause count limit
    if ((state.pauseCount || 0) >= this.config.autoDisable.maxPauseCount) {
      return {
        enforced: true,
        reason: 'multiple_pauses',
        pauseCount: state.pauseCount,
        limit: this.config.autoDisable.maxPauseCount,
        duration: this.config.autoDisable.disableDurationHours * 60 * 60 * 1000
      };
    }
    
    // Check consecutive days with failures
    const failureDays = this._getFailureDays(state);
    if (failureDays.length >= this.config.autoDisable.maxConsecutiveFailureDays) {
      return {
        enforced: true,
        reason: 'consecutive_failure_days',
        daysWithFailures: failureDays.length,
        limit: this.config.autoDisable.maxConsecutiveFailureDays,
        duration: this.config.autoDisable.disableDurationHours * 60 * 60 * 1000
      };
    }
    
    return { enforced: false };
  }

  /**
   * Handle auto-disable enforcement
   */
  async _handleAutoDisable(userId, state, result, context) {
    const disableUntil = Date.now() + result.duration;
    
    // Update state
    state.disableInfo = {
      isDisabled: true,
      disableUntil,
      disabledAt: Date.now(),
      reason: result.reason
    };
    
    await this._saveUserState(userId, state);
    
    // Disable the user in database
    await this._disableUser(userId, disableUntil);
    
    // Generate user-facing response
    const userFacing = await this.errorService.toUserFacing(
      new Error('Account auto-disabled due to repeated failures'),
      ErrorCategory.BOUNDARY_AUTO_DISABLED,
      {
        userId,
        count: result.pauseCount || result.daysWithFailures,
        duration: Math.round(result.duration / (60 * 60 * 1000)) + ' hours'
      }
    );
    
    logger.warn('User account auto-disabled', {
      userId,
      reason: result.reason,
      disableUntil
    });
    
    return {
      action: 'DISABLED',
      disableUntil,
      ...userFacing
    };
  }

  // =====================================================
  // State Management
  // =====================================================

  /**
   * Get or create user boundary state
   */
  async _getOrCreateUserState(userId) {
    // Check cache first
    if (this.userStateCache.has(userId)) {
      return this.userStateCache.get(userId);
    }
    
    // Try database
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('user_boundary_state')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (data) {
          // Parse JSON fields
          const state = {
            ...data,
            executionHistory: data.execution_history ? JSON.parse(data.execution_history) : [],
            workflowStates: data.workflow_states ? JSON.parse(data.workflow_states) : {},
            throttleUntil: data.throttle_until,
            pauseInfo: data.pause_info ? JSON.parse(data.pause_info) : null,
            disableInfo: data.disable_info ? JSON.parse(data.disable_info) : null
          };
          
          this.userStateCache.set(userId, state);
          return state;
        }
      } catch (err) {
        logger.debug('Failed to load boundary state from DB', { userId, error: err.message });
      }
    }
    
    // Create new state
    const newState = this._createEmptyState(userId);
    this.userStateCache.set(userId, newState);
    return newState;
  }

  /**
   * Create empty state object
   */
  _createEmptyState(userId) {
    return {
      userId,
      createdAt: Date.now(),
      executionHistory: [],
      workflowStates: {},
      consecutiveFailures: 0,
      todayExecutions: 0,
      todayFailures: 0,
      pauseCount: 0,
      throttleUntil: null,
      pauseInfo: null,
      disableInfo: null,
      lastExecutionAt: null
    };
  }

  /**
   * Save user state to database and cache
   */
  async _saveUserState(userId, state) {
    // Update cache
    this.userStateCache.set(userId, state);
    
    // Persist to database
    if (this.supabase) {
      try {
        await this.supabase
          .from('user_boundary_state')
          .upsert({
            user_id: userId,
            execution_history: JSON.stringify(state.executionHistory),
            workflow_states: JSON.stringify(state.workflowStates),
            consecutive_failures: state.consecutiveFailures,
            today_executions: state.todayExecutions,
            today_failures: state.todayFailures,
            pause_count: state.pauseCount,
            throttle_until: state.throttleUntil,
            pause_info: state.pauseInfo ? JSON.stringify(state.pauseInfo) : null,
            disable_info: state.disableInfo ? JSON.stringify(state.disableInfo) : null,
            last_execution_at: state.lastExecutionAt,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        logger.warn('Failed to save boundary state to DB', { userId, error: err.message });
      }
    }
  }

  /**
   * Record an execution in state
   */
  async _recordExecution(userId, state, context) {
    const now = Date.now();
    const today = new Date().toDateString();
    
    // Check if new day
    const lastDate = state.lastExecutionAt ? new Date(state.lastExecutionAt).toDateString() : null;
    if (lastDate !== today) {
      state.todayExecutions = 0;
      state.todayFailures = 0;
    }
    
    // Add to history
    state.executionHistory.push({
      timestamp: now,
      success: context.success,
      workflowId: context.workflowId,
      type: context.type || 'general'
    });
    
    // Update counters
    state.todayExecutions++;
    if (!context.success) {
      state.todayFailures++;
      state.consecutiveFailures++;
    } else {
      state.consecutiveFailures = 0;
    }
    state.lastExecutionAt = now;
    
    // Clean old entries
    this._cleanState(state, now);
    
    await this._saveUserState(userId, state);
  }

  /**
   * Clean old state entries
   */
  _cleanState(state, now) {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Keep last 24 hours of history
    state.executionHistory = state.executionHistory.filter(e => e.timestamp > oneDayAgo);
    
    // Clean workflow states (keep only recent)
    Object.keys(state.workflowStates || {}).forEach(workflowId => {
      const ws = state.workflowStates[workflowId];
      ws.failures = ws.failures.filter(f => f > oneHourAgo);
      if (ws.failures.length === 0 && !ws.lastPausedAt) {
        delete state.workflowStates[workflowId];
      }
    });
  }

  // =====================================================
  // Helpers
  // =====================================================

  /**
   * Check if user should bypass boundaries
   */
  _shouldBypass(userId) {
    if (this.config.bypassUsers.includes(userId)) {
      return true;
    }
    
    // Could also check user plan here
    return false;
  }

  /**
   * Analyze failure pattern to suggest fixes
   */
  _analyzeFailurePattern(failures) {
    // Simple pattern analysis - could be enhanced with ML
    if (failures.length >= 10) {
      return 'Multiple failures detected. Check the workflow configuration and external service status.';
    }
    if (failures.length >= 5) {
      return 'Repeated failures may indicate a configuration issue. Review the error messages for patterns.';
    }
    return 'Review the recent error messages to understand what went wrong.';
  }

  /**
   * Get days with failures
   */
  _getFailureDays(state) {
    const days = new Set();
    state.executionHistory.forEach(e => {
      if (!e.success) {
        days.add(new Date(e.timestamp).toDateString());
      }
    });
    return Array.from(days);
  }

  /**
   * Pause workflow in database
   */
  async _pauseWorkflow(workflowId, userId) {
    if (!this.supabase) return;
    
    try {
      await this.supabase
        .from('workflows')
        .update({ 
          status: 'paused',
          paused_at: new Date().toISOString(),
          pause_reason: 'Auto-paused due to repeated failures'
        })
        .eq('id', workflowId)
        .eq('user_id', userId);
    } catch (err) {
      logger.warn('Failed to pause workflow in DB', { workflowId, error: err.message });
    }
  }

  /**
   * Disable user in database
   */
  async _disableUser(userId, until) {
    if (!this.supabase) return;
    
    try {
      await this.supabase
        .from('user_profiles')
        .update({ 
          is_disabled: true,
          disabled_at: new Date().toISOString(),
          disabled_until: new Date(until).toISOString(),
          disable_reason: 'Auto-disabled due to repeated failures'
        })
        .eq('id', userId);
    } catch (err) {
      logger.warn('Failed to disable user in DB', { userId, error: err.message });
    }
  }
}

module.exports = {
  BoundaryEnforcementService
};
