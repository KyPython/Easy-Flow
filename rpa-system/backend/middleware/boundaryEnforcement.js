/**
 * Boundary Enforcement Middleware
 * 
 * Express middleware for enforcing boundaries on API routes.
 * Automatically checks and enforces:
 * - Auto-throttling for high-frequency requests
 * - Auto-pause for failed workflows
 * - Auto-disable for repeated violations
 */

const { BoundaryEnforcementService } = require('../services/boundaryEnforcement/boundaryEnforcementService');
const { UserFacingErrorService } = require('../services/errorResolution/userFacingErrorService');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('middleware.boundaryEnforcement');

// Singleton instances
let boundaryService = null;
let errorService = null;

function getBoundaryService() {
  if (!boundaryService) {
    boundaryService = new BoundaryEnforcementService();
  }
  return boundaryService;
}

function getErrorService() {
  if (!errorService) {
    errorService = new UserFacingErrorService();
  }
  return errorService;
}

/**
 * Middleware: Check boundary enforcement before allowing operations
 * Enforces auto-throttling, auto-pause, and auto-disable
 * 
 * Usage:
 *   const { enforceBoundaries } = require('./middleware/boundaryEnforcement');
 *   router.post('/workflows/:id/execute', enforceBoundaries('workflow_execution'), async (req, res) => {...});
 * 
 * @param {string} operationType - Type of operation (workflow_execution, api_call, etc.)
 * @returns {Function} Express middleware
 */
function enforceBoundaries(operationType) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    
    // Skip if no authenticated user
    if (!userId) {
      return next(); // Let auth middleware handle unauthenticated
    }
    
    try {
      const boundaryService = getBoundaryService();
      
      // Check boundaries
      const boundaryResult = await boundaryService.checkBoundaries(userId, {
        type: operationType,
        workflowId: req.body?.workflowId || req.params?.workflowId || req.params?.id,
        executionId: req.params?.executionId,
        endpoint: req.path,
        method: req.method
      });
      
      // Handle throttled
      if (boundaryResult.action === 'THROTTLED') {
        logger.warn('Request blocked by boundary enforcement (throttled)', {
          userId,
          operationType,
          throttleUntil: boundaryResult.throttleUntil
        });
        
        return res.status(429).json({
          ...boundaryResult,
          status: 429,
          retry_after: boundaryResult.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle paused
      if (boundaryResult.action === 'PAUSED') {
        logger.warn('Request blocked by boundary enforcement (paused)', {
          userId,
          operationType,
          workflowId: boundaryResult.workflowId
        });
        
        return res.status(423).json({
          ...boundaryResult,
          status: 423,
          workflow_id: boundaryResult.workflowId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle disabled
      if (boundaryResult.action === 'DISABLED') {
        logger.warn('Request blocked by boundary enforcement (disabled)', {
          userId,
          operationType,
          disableUntil: boundaryResult.disableUntil
        });
        
        return res.status(403).json({
          ...boundaryResult,
          status: 403,
          account_disabled: true,
          support_required: true,
          timestamp: new Date().toISOString()
        });
      }
      
      // No boundary violation - attach state to request for tracking
      req.boundaryState = boundaryResult;
      req.boundaryChecked = true;
      
      next();
      
    } catch (error) {
      // Log error but don't block - fail open for availability
      logger.error('Boundary enforcement error', {
        userId: req.user?.id,
        operationType,
        error: error.message
      });
      
      // Fail open - allow the request but track the issue
      req.boundaryState = { action: 'ERROR', error: error.message };
      req.boundaryChecked = false;
      
      next();
    }
  };
}

/**
 * Middleware: Track execution result for boundary calculations
 * Must be used AFTER the route handler completes
 * 
 * Usage:
 *   router.post('/workflows/:id/execute', enforceBoundaries('workflow_execution'), trackExecution, async (req, res) => {...});
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function trackExecution(req, res, next) {
  // Wrap res.json to track execution result
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    // Track execution after response is sent
    setImmediate(async () => {
      try {
        const userId = req.user?.id;
        
        if (userId && req.boundaryChecked) {
          const boundaryService = getBoundaryService();
          const success = res.statusCode < 400;
          
          await boundaryService.recordExecution(userId, {
            type: req.boundaryState?.type || 'unknown',
            workflowId: req.body?.workflowId || req.params?.workflowId || req.params?.id,
            executionId: req.params?.executionId,
            success
          });
          
          // If failed, record failure and check boundaries
          if (!success) {
            await boundaryService.recordFailure(userId, {
              type: req.boundaryState?.type || 'unknown',
              workflowId: req.body?.workflowId || req.params?.workflowId || req.params?.id,
              executionId: req.params?.executionId,
              error: data
            });
          }
        }
      } catch (err) {
        logger.error('Failed to track execution', { error: err.message });
      }
    });
    
    return originalJson(data);
  };
  
  next();
}

/**
 * Middleware: Get user's current boundary status
 * Useful for displaying boundary info in the UI
 * 
 * Usage:
 *   router.get('/boundary-status', requireAuth, getBoundaryStatus, async (req, res) => {...});
 */
function getBoundaryStatus(req, res, next) {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const boundaryService = getBoundaryService();
  
  boundaryService.getBoundaryStatus(userId)
    .then(status => {
      req.boundaryStatus = status;
      next();
    })
    .catch(error => {
      logger.error('Failed to get boundary status', { userId, error: error.message });
      res.status(500).json({ error: 'Failed to get boundary status' });
    });
}

/**
 * Middleware: Require boundary status check (pass only if not throttled/paused/disabled)
 */
function requireClearBoundaries(operationType) {
  return [
    enforceBoundaries(operationType),
    getBoundaryStatus,
    (req, res, next) => {
      const status = req.boundaryStatus;
      
      if (status?.isThrottled) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retry_after: status.throttleUntil ? new Date(status.throttleUntil).toISOString() : null,
          boundary_status: status
        });
      }
      
      if (status?.isPaused) {
        return res.status(423).json({
          error: 'Account or workflow is paused',
          boundary_status: status
        });
      }
      
      if (status?.isDisabled) {
        return res.status(403).json({
          error: 'Account is disabled',
          support_required: true,
          boundary_status: status
        });
      }
      
      next();
    }
  ];
}

/**
 * Express route handler wrapper that includes boundary enforcement
 * Provides cleaner syntax for routes
 */
function withBoundaryCheck(operationType, handler) {
  return async (req, res, next) => {
    // Run boundary check
    const enforceMw = enforceBoundaries(operationType);
    await new Promise((resolve, reject) => {
      enforceMw(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if request was blocked
    if (res.headersSent) {
      return; // Response already sent (boundary blocked)
    }
    
    // Run the handler
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Utility: Check if user is throttled (for non-middleware use)
 */
async function isUserThrottled(userId) {
  const boundaryService = getBoundaryService();
  const status = await boundaryService.getBoundaryStatus(userId);
  return status?.isThrottled || false;
}

/**
 * Utility: Get user's throttle retry-after time
 */
async function getUserThrottleRetryAfter(userId) {
  const boundaryService = getBoundaryService();
  const status = await boundaryService.getBoundaryStatus(userId);
  return status?.throttleUntil || null;
}

module.exports = {
  enforceBoundaries,
  trackExecution,
  getBoundaryStatus,
  requireClearBoundaries,
  withBoundaryCheck,
  isUserThrottled,
  getUserThrottleRetryAfter
};
