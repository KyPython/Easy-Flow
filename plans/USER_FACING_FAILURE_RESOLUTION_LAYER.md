# User-Facing Failure Resolution Layer & Automatic Boundary Enforcement

## Executive Summary

This plan implements a comprehensive **User-Facing Failure Resolution Layer** and **Automatic Boundary Enforcement** system for EasyFlow. The goal is to reduce support burden by 60-80% by providing actionable error messages and automatically enforcing system boundaries without founder intervention.

## Current State Analysis

### Existing Components
- **Error Categorization**: [`workflowExecutor._categorizeError()`](rpa-system/backend/services/workflowExecutor.js:326) - Basic categorization with 9 categories
- **User Messages**: [`workflowExecutor._getUserFriendlyMessage()`](rpa-system/backend/services/workflowExecutor.js:355) - Limited user-friendly messages
- **Rate Limiting**: [`comprehensiveRateLimit.js`](rpa-system/backend/middleware/comprehensiveRateLimit.js) - Plan-based limits only
- **DLQ Service**: [`dlqService.js`](rpa-system/backend/services/dlqService.js) - Dead letter queue for failed jobs

### Gaps Identified
1. Error categories are too generic and don't map to specific user actions
2. User messages lack specific resolution steps (e.g., "upgrade", "wait", "reduce frequency")
3. No automatic boundary enforcement (throttling, pausing, disabling)
4. No escalation system for repeated failures
5. Error messages not consistently applied across all routes

---

## Part 1: User-Facing Failure Resolution Layer

### 1.1 Comprehensive Error Category System

Create a new [`ErrorCategory`](rpa-system/backend/services/errorResolution/errorCategories.js) enum with granular categories:

```javascript
const ErrorCategory = {
  // Rate Limiting & Quotas
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MONTHLY_LIMIT_REACHED: 'MONTHLY_LIMIT_REACHED',
  
  // Authentication & Authorization
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  
  // Workflow Execution
  WORKFLOW_TIMEOUT: 'WORKFLOW_TIMEOUT',
  WORKFLOW_ELEMENT_NOT_FOUND: 'WORKFLOW_ELEMENT_NOT_FOUND',
  WORKFLOW_PAGE_LOAD_FAILED: 'WORKFLOW_PAGE_LOAD_FAILED',
  WORKFLOWnavigation_FAILED: 'WORKFLOWnavigation_FAILED',
  WORKFLOW_VALIDATION_FAILED: 'WORKFLOW_VALIDATION_FAILED',
  WORKFLOW_ASSERTION_FAILED: 'WORKFLOW_ASSERTION_FAILED',
  
  // External Services
  SERVICE_RATE_LIMIT: 'SERVICE_RATE_LIMIT',  // e.g., "Service X rate limit"
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SERVICE_AUTH_FAILED: 'SERVICE_AUTH_FAILED',  // e.g., "Google token expired"
  SERVICE_PERMISSION_DENIED: 'SERVICE_PERMISSION_DENIED',
  
  // Data & Configuration
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_VALIDATION_FAILED: 'DATA_VALIDATION_FAILED',
  DATA_EXPORT_FAILED: 'DATA_EXPORT_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING_FIELD: 'CONFIG_MISSING_FIELD',
  
  // System Errors
  SYSTEM_OVERLOAD: 'SYSTEM_OVERLOAD',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
  
  // User Actions
  USER_CANCELLED: 'USER_CANCELLED',
  USER_TIMEOUT: 'USER_TIMEOUT',
  
  // Boundary Violations
  BOUNDARY_AUTO_THROTTLED: 'BOUNDARY_AUTO_THROTTLED',
  BOUNDARY_AUTO_PAUSED: 'BOUNDARY_AUTO_PAUSED',
  BOUNDARY_AUTO_DISABLED: 'BOUNDARY_AUTO_DISABLED'
};
```

### 1.2 User-Facing Error Resolution Service

Create [`UserFacingErrorService`](rpa-system/backend/services/errorResolution/userFacingErrorService.js):

```javascript
class UserFacingErrorService {
  /**
   * Get complete error resolution for any failure
   * @param {string} category - Error category
   * @param {Object} context - Error context (userId, workflowId, etc.)
   * @returns {Object} Complete resolution information
   */
  async getResolution(category, context = {}) {
    const resolution = this._getResolutionTemplate(category);
    
    // Enrich with user-specific data
    return {
      ...resolution,
      userContext: await this._enrichWithUserContext(context),
      actionableSteps: await this._getActionableSteps(category, context),
      escalationOptions: this._getEscalationOptions(category),
      relatedResources: this._getRelatedResources(category)
    };
  }
  
  /**
   * Transform any error to user-facing format
   * @param {Error} error - Original error
   * @param {string} category - Error category
   * @param {Object} context - Additional context
   * @returns {Object} User-facing error response
   */
  toUserFacing(error, category, context = {}) {
    const resolution = this.getResolution(category, context);
    
    return {
      // What happened (in user terms)
      what: resolution.title,
      
      // Why it happened (their action or environment)
      why: resolution.explanation,
      
      // Exactly what to do next
      action: {
        primary: resolution.action.primary,
        secondary: resolution.action.secondary,
        steps: resolution.action.steps
      },
      
      // Resolution ID for support reference
      resolutionId: this._generateResolutionId(),
      
      // When they can retry (if applicable)
      retryAfter: resolution.retryAfter,
      
      // Links to help docs
      help: resolution.helpLinks
    };
  }
}
```

### 1.3 Resolution Templates

Example resolution template for **RATE_LIMIT_EXCEEDED**:

```javascript
{
  category: 'RATE_LIMIT_EXCEEDED',
  title: 'Your workflow hit a rate limit from Service X',
  explanation: 'Service X allows only 30 requests per minute. Your workflow sent 45 requests in the last minute.',
  
  action: {
    primary: 'Upgrade or adjust workflow frequency',
    secondary: 'Wait for the rate limit to reset',
    steps: [
      {
        step: 1,
        description: 'Upgrade your plan for higher rate limits',
        action: 'Navigate to /pricing',
        estimatedEffort: '2 min'
      },
      {
        step: 2,
        description: 'Reduce workflow frequency to stay within limits',
        action: 'Edit your workflow and increase delays between actions',
        estimatedEffort: '5 min'
      },
      {
        step: 3,
        description: 'Wait 30 minutes for automatic reset',
        action: 'No action needed - rate limits reset automatically',
        estimatedEffort: '30 min'
      }
    ]
  },
  
  retryAfter: 30 * 60 * 1000, // 30 minutes
  
  helpLinks: [
    { text: 'Rate Limits Documentation', url: '/docs/rate-limits' },
    { text: 'Upgrade Your Plan', url: '/pricing' },
    { text: 'Contact Support', url: '/support?resolution=RESOLUTION_ID' }
  ],
  
  // For boundary enforcement
  boundaryStatus: {
    isThrottled: true,
    throttleDuration: 30 * 60 * 1000,
    autoPauseEnabled: true,
    autoDisableThreshold: 5
  }
}
```

### 1.4 All Error Resolution Templates

| Category | Title Template | Why Template | Action Template |
|----------|---------------|--------------|----------------|
| `RATE_LIMIT_EXCEEDED` | "Your workflow hit a rate limit from {service}" | "{service} allows {limit} requests per {unit}. Your workflow sent {count}." | "Upgrade, wait {time}, or reduce frequency" |
| `WORKFLOW_TIMEOUT` | "Your workflow timed out after {duration}" | "The operation took longer than the {timeout} second limit." | "Increase timeout, simplify workflow, or retry" |
| `WORKFLOW_ELEMENT_NOT_FOUND` | "We couldn't find '{element}' on the page" | "The website structure may have changed or the element was removed." | "Update selectors, verify URL, or contact support" |
| `SERVICE_AUTH_FAILED` | "Authentication failed for {service}" | "Your {service} credentials have expired or been revoked." | "Reconnect your {service} integration" |
| `AUTH_TOKEN_EXPIRED` | "Your session has expired" | "You haven't been active for {duration}." | "Sign in again to continue" |
| `QUOTA_EXCEEDED` | "You've reached your {quota} limit" | "Your current plan includes {limit} {quota} per month." | "Upgrade your plan or wait until next month" |
| `BOUNDARY_AUTO_THROTTLED` | "Your workflow was temporarily paused due to high frequency" | "You ran {count} workflows in {time}, exceeding the safety limit." | "Wait {duration} or upgrade" |
| `BOUNDARY_AUTO_PAUSED` | "Your workflow was paused due to repeated failures" | "This workflow failed {count} times in a row." | "Fix the issue then manually resume" |
| `BOUNDARY_AUTO_DISABLED` | "Your account was temporarily disabled due to repeated failures" | "Your workflows failed {count} times without successful runs." | "Contact support to re-enable" |

---

## Part 2: Automatic Boundary Enforcement

### 2.1 Boundary Enforcement Service

Create [`BoundaryEnforcementService`](rpa-system/backend/services/boundaryEnforcement/boundaryEnforcementService.js):

```javascript
class BoundaryEnforcementService {
  constructor() {
    // Thresholds configuration
    this.thresholds = {
      autoThrottle: {
        maxExecutionsPerMinute: 10,
        maxExecutionsPerHour: 100,
        maxConsecutiveFailures: 3,
        throttleDurationMinutes: 30
      },
      autoPause: {
        maxFailuresPerHour: 5,
        maxFailuresPerDay: 20,
        failureWindowMinutes: 60
      },
      autoDisable: {
        maxPauseCount: 3,
        maxConsecutiveDaysWithFailures: 5,
        disableDurationHours: 24
      }
    };
    
    // User state tracking
    this.userState = new Map(); // userId -> state
  }
  
  /**
   * Check and enforce boundaries for a user execution
   * @param {string} userId - User ID
   * @param {Object} executionContext - Execution details
   * @returns {Object} Boundary status and any enforcement action taken
   */
  async checkBoundaries(userId, executionContext) {
    const state = await this._getOrCreateUserState(userId);
    
    // Check throttling
    const throttleResult = await this._checkThrottle(userId, state, executionContext);
    if (throttleResult.enforced) {
      return {
        action: 'THROTTLED',
        duration: throttleResult.duration,
        message: this._getThrottleMessage(throttleResult),
        retryAfter: throttleResult.duration
      };
    }
    
    // Check auto-pause
    const pauseResult = await this._checkAutoPause(userId, state, executionContext);
    if (pauseResult.enforced) {
      await this._pauseUserWorkflows(userId);
      return {
        action: 'PAUSED',
        workflowId: pauseResult.workflowId,
        message: this._getPauseMessage(pauseResult),
        recoverySteps: this._getRecoverySteps('pause', pauseResult)
      };
    }
    
    // Check auto-disable
    const disableResult = await this._checkAutoDisable(userId, state, executionContext);
    if (disableResult.enforced) {
      await this._disableUserAccount(userId);
      return {
        action: 'DISABLED',
        message: this._getDisableMessage(disableResult),
        recoverySteps: this._getRecoverySteps('disable', disableResult),
        supportRequired: true
      };
    }
    
    // No boundary violations
    return { action: 'NONE' };
  }
  
  /**
   * Auto-throttle heavy users
   * Triggered when user exceeds execution frequency limits
   */
  async _checkThrottle(userId, state, context) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Count recent executions
    const recentExecutions = state.executionHistory.filter(
      e => e.timestamp > oneMinuteAgo
    );
    const hourlyExecutions = state.executionHistory.filter(
      e => e.timestamp > oneHourAgo
    );
    
    // Check per-minute limit
    if (recentExecutions.length >= this.thresholds.autoThrottle.maxExecutionsPerMinute) {
      return {
        enforced: true,
        reason: 'exceeded_per_minute_limit',
        duration: this.thresholds.autoThrottle.throttleDurationMinutes * 60 * 1000,
        limit: this.thresholds.autoThrottle.maxExecutionsPerMinute,
        actual: recentExecutions.length
      };
    }
    
    // Check per-hour limit
    if (hourlyExecutions.length >= this.thresholds.autoThrottle.maxExecutionsPerHour) {
      return {
        enforced: true,
        reason: 'exceeded_per_hour_limit',
        duration: this.thresholds.autoThrottle.throttleDurationMinutes * 60 * 1000,
        limit: this.thresholds.autoThrottle.maxExecutionsPerHour,
        actual: hourlyExecutions.length
      };
    }
    
    // Record execution for future checks
    state.executionHistory.push({
      timestamp: now,
      type: context.type,
      success: context.success
    });
    
    // Update consecutive failures
    if (!context.success) {
      state.consecutiveFailures++;
    } else {
      state.consecutiveFailures = 0;
    }
    
    // Check consecutive failure throttle
    if (state.consecutiveFailures >= this.thresholds.autoThrottle.maxConsecutiveFailures) {
      return {
        enforced: true,
        reason: 'consecutive_failures',
        duration: this.thresholds.autoThrottle.throttleDurationMinutes * 60 * 1000,
        failures: state.consecutiveFailures
      };
    }
    
    await this._saveUserState(userId, state);
    return { enforced: false };
  }
  
  /**
   * Auto-pause abusive or misconfigured workflows
   * Triggered when a specific workflow has repeated failures
   */
  async _checkAutoPause(userId, state, context) {
    const { workflowId } = context;
    if (!workflowId) return { enforced: false };
    
    const workflowState = state.workflows.get(workflowId) || {
      failures: [],
      lastPausedAt: null
    };
    
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentFailures = workflowState.failures.filter(f => f > oneHourAgo);
    
    // Check hourly failure limit
    if (recentFailures.length >= this.thresholds.autoPause.maxFailuresPerHour) {
      return {
        enforced: true,
        workflowId,
        reason: 'hourly_failure_limit',
        failureCount: recentFailures.length,
        limit: this.thresholds.autoPause.maxFailuresPerHour,
        suggestedFix: this._analyzeFailurePattern(recentFailures)
      };
    }
    
    // Record failure
    if (!context.success) {
      workflowState.failures.push(Date.now());
      state.workflows.set(workflowId, workflowState);
      await this._saveUserState(userId, state);
    }
    
    return { enforced: false };
  }
  
  /**
   * Auto-disable accounts with repeated failures
   * Triggered after multiple auto-pause incidents
   */
  async _checkAutoDisable(userId, state, context) {
    // Check pause count
    if (state.pauseCount >= this.thresholds.autoDisable.maxPauseCount) {
      return {
        enforced: true,
        reason: 'multiple_pauses',
        pauseCount: state.pauseCount,
        disableDuration: this.thresholds.autoDisable.disableDurationHours
      };
    }
    
    // Check consecutive days with failures
    const failureDays = new Set();
    state.executionHistory.forEach(e => {
      if (!e.success) {
        failureDays.add(new Date(e.timestamp).toDateString());
      }
    });
    
    if (failureDays.size >= this.thresholds.autoDisable.maxConsecutiveDaysWithFailures) {
      return {
        enforced: true,
        reason: 'consecutive_failure_days',
        daysWithFailures: failureDays.size,
        disableDuration: this.thresholds.autoDisable.disableDurationHours
      };
    }
    
    return { enforced: false };
  }
  
  /**
   * User-facing message for throttle
   */
  _getThrottleMessage(result) {
    return {
      what: 'Your workflow was temporarily throttled',
      why: `You exceeded the safety limit (${result.limit} executions per ${result.reason.includes('minute') ? 'minute' : 'hour'}).`,
      action: {
        primary: 'Wait for automatic reset',
        secondary: 'Upgrade your plan for higher limits',
        steps: [
          {
            step: 1,
            description: `Wait ${Math.round(result.duration / 60000)} minutes`,
            action: 'No action needed - workflows will resume automatically',
            estimatedEffort: `${Math.round(result.duration / 60000)} min`
          },
          {
            step: 2,
            description: 'Review your workflow frequency',
            action: 'Check if you can reduce execution frequency',
            estimatedEffort: '5 min'
          },
          {
            step: 3,
            description: 'Upgrade for higher limits',
            action: 'Navigate to /pricing to see plan options',
            estimatedEffort: '2 min'
          }
        ]
      },
      retryAfter: result.duration
    };
  }
  
  /**
   * User-facing message for pause
   */
  _getPauseMessage(result) {
    return {
      what: 'Your workflow was automatically paused',
      why: `This workflow failed ${result.failureCount} times in the last hour.`,
      action: {
        primary: 'Fix the issue and manually resume',
        secondary: 'Contact support if you need help',
        steps: [
          {
            step: 1,
            description: 'Check recent execution logs',
            action: 'View the failed executions to understand what went wrong',
            estimatedEffort: '5 min'
          },
          {
            step: 2,
            description: result.suggestedFix || 'Update your workflow configuration',
            action: 'Fix the identified issues',
            estimatedEffort: '10 min'
          },
          {
            step: 3,
            description: 'Resume the workflow',
            action: 'Click "Resume" on the workflow page',
            estimatedEffort: '1 min'
          }
        ]
      }
    };
  }
  
  /**
   * User-facing message for disable
   */
  _getDisableMessage(result) {
    return {
      what: 'Your account was temporarily disabled',
      why: `Due to repeated workflow failures, your account has been paused for safety.`,
      action: {
        primary: 'Contact support to re-enable your account',
        secondary: 'Review and fix the underlying issues',
        steps: [
          {
            step: 1,
            description: 'Contact our support team',
            action: 'Email support@easyflow.io with your account email',
            estimatedEffort: '2 min'
          },
          {
            step: 2,
            description: 'Review failure patterns',
            action: 'Check your workflow execution history for common issues',
            estimatedEffort: '10 min'
          },
          {
            step: 3,
            description: 'Implement fixes',
            action: 'Address the root causes of the failures',
            estimatedEffort: '30 min'
          }
        ],
        estimatedRecoveryTime: `${result.disableDuration} hours`
      },
      requiresSupport: true
    };
  }
}
```

### 2.2 Boundary Enforcement Middleware

Create [`boundaryEnforcement.js`](rpa-system/backend/middleware/boundaryEnforcement.js):

```javascript
const { BoundaryEnforcementService } = require('../services/boundaryEnforcement/boundaryEnforcementService');
const { UserFacingErrorService } = require('../services/errorResolution/userFacingErrorService');

const boundaryService = new BoundaryEnforcementService();
const errorService = new UserFacingErrorService();

/**
 * Middleware: Check boundary enforcement before allowing operations
 * Enforces auto-throttling, auto-pause, and auto-disable
 */
const enforceBoundaries = (operationType) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(); // Let auth middleware handle unauthenticated
    }
    
    try {
      const boundaryResult = await boundaryService.checkBoundaries(userId, {
        type: operationType,
        workflowId: req.body?.workflowId || req.params?.workflowId,
        success: true // Assuming request passed validation
      });
      
      if (boundaryResult.action === 'THROTTLED') {
        const userFacing = await errorService.getResolution(
          'BOUNDARY_AUTO_THROTTLED',
          { userId, ...boundaryResult }
        );
        
        return res.status(429).json({
          ...userFacing,
          retry_after: boundaryResult.retryAfter
        });
      }
      
      if (boundaryResult.action === 'PAUSED') {
        const userFacing = await errorService.getResolution(
          'BOUNDARY_AUTO_PAUSED',
          { userId, ...boundaryResult }
        );
        
        return res.status(423).json({
          ...userFacing,
          workflow_id: boundaryResult.workflowId,
          status: 'paused'
        });
      }
      
      if (boundaryResult.action === 'DISABLED') {
        const userFacing = await errorService.getResolution(
          'BOUNDARY_AUTO_DISABLED',
          { userId, ...boundaryResult }
        );
        
        return res.status(403).json({
          ...userFacing,
          status: 'disabled',
          support_required: true
        });
      }
      
      // No boundary violation - attach state to request for tracking
      req.boundaryState = boundaryResult;
      next();
      
    } catch (error) {
      // Log error but don't block - fail open for availability
      console.error('Boundary enforcement error:', error);
      next();
    }
  };
};

/**
 * Track execution result for boundary calculations
 */
const trackExecution = (req, res, next) => {
  // Wrap res.json to track execution result
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    // After response, track the execution result
    if (req.user?.id && req.boundaryState) {
      boundaryService.recordExecution(req.user.id, {
        type: req.operationType,
        success: res.statusCode < 400,
        workflowId: req.body?.workflowId || req.params?.workflowId
      }).catch(err => console.error('Failed to track execution:', err));
    }
    
    return originalJson(data);
  };
  
  next();
};

module.exports = {
  enforceBoundaries,
  trackExecution
};
```

---

## Part 3: Implementation Roadmap

### Phase 1: Error Resolution Service (Days 1-2)

1. **Create error category system**
   - File: [`errorCategories.js`](rpa-system/backend/services/errorResolution/errorCategories.js)
   - Define all error categories
   - Add category descriptions and metadata

2. **Build UserFacingErrorService**
   - File: [`userFacingErrorService.js`](rpa-system/backend/services/errorResolution/userFacingErrorService.js)
   - Implement `getResolution()` method
   - Implement `toUserFacing()` method
   - Create resolution template database

3. **Add resolution templates**
   - Implement templates for all error categories
   - Add user-friendly explanations
   - Add actionable steps for each category

### Phase 2: Boundary Enforcement Service (Days 3-4)

1. **Build BoundaryEnforcementService**
   - File: [`boundaryEnforcementService.js`](rpa-system/backend/services/boundaryEnforcement/boundaryEnforcementService.js)
   - Implement auto-throttling logic
   - Implement auto-pause logic
   - Implement auto-disable logic

2. **Create boundary tracking database schema**
   - Add `user_boundary_state` table
   - Add `workflow_boundary_state` table
   - Add `boundary_enforcement_log` table

3. **Build middleware**
   - File: [`boundaryEnforcement.js`](rpa-system/backend/middleware/boundaryEnforcement.js)
   - Implement `enforceBoundaries()` middleware
   - Implement `trackExecution()` middleware

### Phase 3: API Routes & Integration (Days 5-6)

1. **Create resolution API routes**
   - File: [`resolutionRoutes.js`](rpa-system/backend/routes/resolutionRoutes.js)
   - GET `/api/resolution/:resolutionId` - Get resolution steps
   - POST `/api/resolution/:resolutionId/execute` - Execute resolution action
   - GET `/api/boundary-status` - Get current boundary status

2. **Update existing routes**
   - [`executionRoutes.js`](rpa-system/backend/routes/executionRoutes.js) - Use user-facing errors
   - [`scrapingRoutes.js`](rpa-system/backend/routes/scrapingRoutes.js) - Use user-facing errors
   - [`dlqRoutes.js`](rpa-system/backend/routes/dlqRoutes.js) - Add resolution info

3. **Add boundary middleware to routes**
   - Add to workflow execution routes
   - Add to scraping routes
   - Add to integration routes

### Phase 4: Testing & Documentation (Days 7-8)

1. **Write tests**
   - Unit tests for error categorization
   - Unit tests for boundary enforcement
   - Integration tests for API routes
   - Edge case tests

2. **Create documentation**
   - Error code reference guide
   - Resolution action documentation
   - Boundary enforcement explainer
   - Update user documentation

---

## Part 4: Example Error Responses

### Before: Generic Error
```json
{
  "error": "Execution failed",
  "message": "Connection timeout"
}
```

### After: User-Facing Resolution
```json
{
  "what": "Your workflow hit a rate limit from Google Sheets",
  "why": "Google Sheets allows only 300 requests per minute. Your workflow sent 450 requests in the last minute.",
  "action": {
    "primary": "Upgrade or reduce frequency",
    "secondary": "Wait 15 minutes for automatic reset",
    "steps": [
      {
        "step": 1,
        "description": "Upgrade your plan for higher rate limits",
        "action": "Navigate to /pricing",
        "estimatedEffort": "2 min"
      },
      {
        "step": 2,
        "description": "Reduce workflow frequency",
        "action": "Edit your workflow and add delays between Google Sheets actions",
        "estimatedEffort": "5 min"
      },
      {
        "step": 3,
        "description": "Wait for automatic reset",
        "action": "No action needed - rate limits reset automatically",
        "estimatedEffort": "15 min"
      }
    ]
  },
  "resolutionId": "RES-2024-ABC123",
  "retryAfter": 900000,
  "help": [
    { "text": "Rate Limits Documentation", "url": "/docs/rate-limits" },
    { "text": "Upgrade Your Plan", "url": "/pricing" },
    { "text": "Contact Support", "url": "/support?resolution=RES-2024-ABC123" }
  ]
}
```

### Boundary Enforcement: Auto-Throttled
```json
{
  "what": "Your workflow was temporarily throttled",
  "why": "You exceeded the safety limit of 10 executions per minute.",
  "action": {
    "primary": "Wait for automatic reset",
    "secondary": "Upgrade your plan for higher limits",
    "steps": [
      {
        "step": 1,
        "description": "Wait 30 minutes",
        "action": "No action needed - workflows will resume automatically",
        "estimatedEffort": "30 min"
      },
      {
        "step": 2,
        "description": "Review your workflow frequency",
        "action": "Check if you can reduce execution frequency",
        "estimatedEffort": "5 min"
      }
    ]
  },
  "resolutionId": "RES-2024-THROT123",
  "retryAfter": 1800000,
  "boundaryStatus": {
    "isThrottled": true,
    "throttleDuration": 1800000,
    "limit": 10,
    "actual": 12
  }
}
```

---

## Part 5: File Structure

```
rpa-system/backend/
├── services/
│   ├── errorResolution/
│   │   ├── errorCategories.js          # Error category definitions
│   │   ├── errorResolutionTemplates.js  # All resolution templates
│   │   └── userFacingErrorService.js    # Main service class
│   └── boundaryEnforcement/
│       ├── boundaryEnforcementService.js # Main service class
│       ├── boundaryStateStore.js         # State persistence
│       └── boundaryAnalytics.js          # Metrics and alerting
├── middleware/
│   └── boundaryEnforcement.js           # Middleware functions
├── routes/
│   └── resolutionRoutes.js              # Resolution API endpoints
└── utils/
    └── errorResolutionHelpers.js        # Helper functions
```

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Support tickets about failures | 100/week | 20-40/week | Weekly ticket count |
| Self-service resolution rate | 20% | 60-80% | % of users resolving without contact |
| Mean time to resolution | 4 hours | 5 minutes | From failure to user action |
| Founder intervention required | 4 hours/week | 30 minutes/week | Weekly time spent on support |

---

## Implementation Checklist

- [ ] Create error category enum with all failure types
- [ ] Build resolution template database
- [ ] Implement UserFacingErrorService
- [ ] Build BoundaryEnforcementService
- [ ] Create boundary tracking database schema
- [ ] Implement boundary middleware
- [ ] Create resolution API routes
- [ ] Update all existing routes with user-facing errors
- [ ] Add tests for error resolution paths
- [ ] Add tests for boundary enforcement
- [ ] Update user documentation
- [ ] Deploy and monitor metrics
