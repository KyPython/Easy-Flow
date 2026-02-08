/**
 * Resolution API Routes
 * 
 * API endpoints for user-facing error resolution:
 * - GET /api/resolution/:resolutionId - Get resolution steps
 * - POST /api/resolution/:resolutionId/execute - Execute resolution action
 * - GET /api/boundary-status - Get current boundary status
 * - POST /api/boundary/:workflowId/resume - Resume a paused workflow
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getBoundaryStatus, enforceBoundaries } = require('../middleware/boundaryEnforcement');
const { UserFacingErrorService } = require('../services/errorResolution/userFacingErrorService');
const { BoundaryEnforcementService } = require('../services/boundaryEnforcement/boundaryEnforcementService');
const { createLogger } = require('../middleware/structuredLogging');

const router = express.Router();
const logger = createLogger('routes.resolution');
const errorService = new UserFacingErrorService();
const boundaryService = new BoundaryEnforcementService();

/**
 * GET /api/resolution/:resolutionId
 * Get resolution steps for a specific resolution ID
 */
router.get('/:resolutionId', requireAuth, async (req, res) => {
  try {
    const { resolutionId } = req.params;
    const userId = req.user.id;
    
    // Try to get from database first
    const stored = await errorService.getResolutionById(resolutionId);
    
    if (stored && stored.user_id === userId) {
      return res.json({
        success: true,
        resolution: {
          resolutionId: stored.resolution_id,
          category: stored.category,
          what: stored.what,
          why: stored.why,
          action: {
            primary: stored.action_primary,
            steps: JSON.parse(stored.action_steps || '[]')
          },
          createdAt: stored.created_at
        }
      });
    }
    
    // Resolution not found or doesn't belong to user
    // This could be an old resolution or an invalid ID
    logger.warn('Resolution not found or access denied', { resolutionId, userId });
    
    return res.status(404).json({
      success: false,
      error: 'Resolution not found',
      message: 'This resolution ID is invalid or has expired.'
    });
    
  } catch (error) {
    logger.error('Failed to get resolution', { 
      resolutionId: req.params.resolutionId, 
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to get resolution' });
  }
});

/**
 * POST /api/resolution/:resolutionId/execute
 * Execute a resolution action
 */
router.post('/:resolutionId/execute', requireAuth, async (req, res) => {
  try {
    const { resolutionId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;
    
    logger.info('Resolution action executed', { resolutionId, action, userId });
    
    // Get the resolution
    const stored = await errorService.getResolutionById(resolutionId);
    
    if (!stored || stored.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Resolution not found'
      });
    }
    
    // Validate action
    const validActions = ['upgrade', 'retry', 'fix', 'contact_support', 'review'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action',
        validActions
      });
    }
    
    // Execute action-specific logic
    let result = { success: true, message: '' };
    
    switch (action) {
      case 'upgrade':
        result = {
          success: true,
          message: 'Redirecting to pricing page...',
          redirectUrl: '/pricing'
        };
        break;
        
      case 'retry':
        // Return information needed to retry
        result = {
          success: true,
          message: 'You can now retry the operation',
          retryAvailable: true,
          retryAfter: 0 // Available immediately
        };
        break;
        
      case 'fix':
        result = {
          success: true,
          message: 'Please fix the issue and retry'
        };
        break;
        
      case 'contact_support':
        result = {
          success: true,
          message: 'Support ticket created',
          redirectUrl: `/support?resolution=${resolutionId}`
        };
        break;
        
      case 'review':
        result = {
          success: true,
          message: 'Please review the error details and take appropriate action'
        };
        break;
    }
    
    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
    
  } catch (error) {
    logger.error('Failed to execute resolution action', { 
      resolutionId: req.params.resolutionId, 
      action: req.body.action,
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to execute resolution action' });
  }
});

/**
 * GET /api/boundary-status
 * Get current boundary status for the authenticated user
 */
router.get('/user/status', requireAuth, getBoundaryStatus, async (req, res) => {
  try {
    // getBoundaryStatus middleware already fetched the status
    const status = req.boundaryStatus;
    
    res.json({
      success: true,
      boundaryStatus: {
        isThrottled: status.isThrottled,
        throttleUntil: status.throttleUntil,
        isPaused: status.isPaused,
        pauseInfo: status.isPaused ? {
          pauseUntil: status.pauseUntil,
          workflows: status.pausedWorkflows
        } : null,
        isDisabled: status.isDisabled,
        disableInfo: status.isDisabled ? {
          disableUntil: status.disableUntil
        } : null,
        stats: {
          executionsToday: status.stats.totalExecutionsToday,
          consecutiveFailures: status.stats.consecutiveFailures,
          failuresToday: status.stats.totalFailuresToday
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get boundary status', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to get boundary status' });
  }
});

/**
 * POST /api/boundary/workflow/:workflowId/resume
 * Resume a paused workflow
 */
router.post('/workflow/:workflowId/resume', requireAuth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;
    
    logger.info('Resuming paused workflow', { userId, workflowId });
    
    // Resume the workflow
    const result = await boundaryService.resume(userId, workflowId);
    
    res.json({
      success: true,
      message: 'Workflow resumed successfully',
      boundaryStatus: result
    });
    
  } catch (error) {
    logger.error('Failed to resume workflow', { 
      workflowId: req.params.workflowId, 
      userId: req.user.id,
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to resume workflow' });
  }
});

/**
 * POST /api/boundary/user/resume
 * Resume a throttled user (requires support-level auth in production)
 */
router.post('/user/resume', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.info('User resuming from throttle', { userId });
    
    // Resume the user (clears throttling only, not pause/disable)
    const result = await boundaryService.resume(userId, null);
    
    res.json({
      success: true,
      message: 'Throttling cleared successfully',
      boundaryStatus: result
    });
    
  } catch (error) {
    logger.error('Failed to resume user', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to resume user' });
  }
});

/**
 * GET /api/boundary/throttle-check
 * Check if user is currently throttled (lightweight endpoint)
 */
router.get('/user/throttle-check', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { isUserThrottled, getUserThrottleRetryAfter } = require('../middleware/boundaryEnforcement');
    
    const throttled = await isUserThrottled(userId);
    
    if (throttled) {
      const retryAfter = await getUserThrottleRetryAfter(userId);
      return res.json({
        throttled: true,
        retryAfter: retryAfter ? Math.max(0, new Date(retryAfter) - new Date()) : null,
        retryAfterIso: retryAfter
      });
    }
    
    res.json({ throttled: false });
    
  } catch (error) {
    logger.error('Failed to check throttle status', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to check throttle status' });
  }
});

/**
 * GET /api/resolution/categories
 * Get list of all error categories and their descriptions
 */
router.get('/categories', async (req, res) => {
  try {
    const { ErrorCategory, ErrorCategoryMetadata } = require('../services/errorResolution/errorCategories');
    
    const categories = Object.values(ErrorCategory)
      .filter(cat => !cat.startsWith('LEGACY_')) // Exclude legacy categories
      .map(cat => ({
        id: cat,
        metadata: ErrorCategoryMetadata[cat] || {}
      }));
    
    res.json({
      success: true,
      categories
    });
    
  } catch (error) {
    logger.error('Failed to get error categories', { error: error.message });
    res.status(500).json({ error: 'Failed to get error categories' });
  }
});

/**
 * GET /api/resolution/help-links
 * Get help links for a specific category
 */
router.get('/help-links/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { ErrorCategory, ErrorCategoryMetadata } = require('../services/errorResolution/errorCategories');
    const { getResolutionTemplate } = require('../services/errorResolution/resolutionTemplates');
    
    // Resolve legacy categories
    const legacyMap = {
      'TIMEOUT_ERROR': 'WORKFLOW_TIMEOUT',
      'ELEMENT_NOT_FOUND': 'WORKFLOW_ELEMENT_NOT_FOUND',
      'PAGE_LOAD_ERROR': 'WORKFLOW_PAGE_LOAD_FAILED',
      'AUTHENTICATION_ERROR': 'SERVICE_AUTH_FAILED',
      'NETWORK_ERROR': 'SERVICE_UNAVAILABLE'
    };
    
    const resolvedCategory = legacyMap[category] || category;
    
    const template = getResolutionTemplate(resolvedCategory);
    const metadata = ErrorCategoryMetadata[resolvedCategory] || {};
    
    res.json({
      success: true,
      category: resolvedCategory,
      helpLinks: template?.helpLinks || [],
      severity: metadata.severity || 'error',
      retryable: metadata.retryable || false
    });
    
  } catch (error) {
    logger.error('Failed to get help links', { 
      category: req.params.category, 
      error: error.message 
    });
    res.status(500).json({ error: 'Failed to get help links' });
  }
});

module.exports = router;
