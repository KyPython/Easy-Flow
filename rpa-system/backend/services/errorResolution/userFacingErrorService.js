/**
 * User-Facing Error Service
 *
 * Provides user-friendly error messages with actionable resolution steps.
 * Transforms technical errors into clear, actionable guidance for users.
 *
 * Features:
 * - Comprehensive error categorization
 * - User-friendly error messages
 * - Actionable resolution steps
 * - Support for variable substitution
 * - Resolution tracking and analytics
 */

const { v4: uuidv4 } = require('uuid');
const {
  ErrorCategory,
  ErrorCategoryMetadata,
  LegacyCategoryMappings,
  getFriendlyServiceName,
  getHttpStatus,
  isBoundaryRelated,
  isRetryable,
  getRetryDelay
} = require('./errorCategories');
const { getResolutionTemplate, resolveTemplate } = require('./resolutionTemplates');
const { getSupabase } = require('../../utils/supabaseClient');
const { createLogger } = require('../../middleware/structuredLogging');

const logger = createLogger('services.userFacingError');

class UserFacingErrorService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Get complete error resolution for any failure
   * @param {string} category - Error category
   * @param {Object} context - Error context (userId, workflowId, error details)
   * @returns {Promise<Object>} Complete resolution information
   */
  async getResolution(category, context = {}) {
    // Map legacy categories if needed
    const resolvedCategory = this._resolveCategory(category);

    // Get base template
    const template = getResolutionTemplate(resolvedCategory);

    // Enrich with context-specific variables
    const variables = this._buildVariables(resolvedCategory, context);

    // Resolve template with variables
    const resolved = resolveTemplate(template, variables);

    // Enrich with user-specific data
    const enriched = await this._enrichWithUserContext(resolved, context);

    // Add metadata
    enriched.metadata = this._getMetadata(resolvedCategory);

    // Generate resolution ID for tracking
    enriched.resolutionId = this._generateResolutionId();

    return enriched;
  }

  /**
   * Transform any error to user-facing format
   * @param {Error} error - Original error
   * @param {string} category - Error category
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} User-facing error response
   */
  async toUserFacing(error, category, context = {}) {
    const resolution = await this.getResolution(category, {
      error: error,
      ...context
    });

    // Determine HTTP status
    const httpStatus = getHttpStatus(category);

    return {
      // HTTP status for programmatic handling
      status: httpStatus,

      // User-facing response
      what: resolution.what,
      why: resolution.why,
      action: {
        primary: resolution.action.primary,
        secondary: resolution.action.secondary,
        steps: resolution.action.steps
      },

      // Resolution ID for support reference
      resolutionId: resolution.resolutionId,

      // Retry information
      retryable: isRetryable(category),
      retryAfter: resolution.retryAfter || getRetryDelay(category),

      // Boundary status if applicable
      boundaryStatus: resolution.boundaryStatus || null,

      // Help resources
      help: resolution.helpLinks || [],

      // Additional context
      context: {
        category: category,
        timestamp: new Date().toISOString(),
        workflowId: context.workflowId || null,
        executionId: context.executionId || null
      }
    };
  }

  /**
   * Categorize an error based on its properties
   * @param {Error} error - The error to categorize
   * @param {Object} context - Additional context
   * @returns {Promise<string>} Error category
   */
  async categorizeError(error, context = {}) {
    const message = (error?.message || '').toLowerCase();
    const code = error?.code || '';

    // Check for authentication errors
    if (context.isAuthError || message.includes('authentication') ||
        message.includes('unauthorized') || message.includes('jwt') ||
        code === 'UNAUTHORIZED' || code === 'AUTHENTICATION_ERROR') {
      if (message.includes('expired') || code === 'TOKEN_EXPIRED') {
        return ErrorCategory.AUTH_TOKEN_EXPIRED;
      }
      if (message.includes('invalid') || message.includes('wrong password')) {
        return ErrorCategory.AUTH_INVALID_CREDENTIALS;
      }
      return ErrorCategory.SERVICE_AUTH_FAILED;
    }

    // Check for rate limiting
    if (message.includes('rate limit') || code === 'RATE_LIMIT_EXCEEDED' ||
        context.isRateLimit || code === 429) {
      return ErrorCategory.RATE_LIMIT_EXCEEDED;
    }

    // Check for timeout
    if (message.includes('timeout') || code === 'ETIMEDOUT' ||
        context.isTimeout || code === 408) {
      return ErrorCategory.WORKFLOW_TIMEOUT;
    }

    // Check for element not found
    if (message.includes('element') || message.includes('selector') ||
        message.includes('not found') || message.includes('could not find')) {
      return ErrorCategory.WORKFLOW_ELEMENT_NOT_FOUND;
    }

    // Check for page load errors
    if (message.includes('page load') || message.includes('navigation') ||
        message.includes('load') || context.isPageLoadError) {
      return ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED;
    }

    // Check for service unavailable
    if (message.includes('service unavailable') || code === 'ECONNREFUSED' ||
        code === 503 || context.isServiceUnavailable) {
      return ErrorCategory.SERVICE_UNAVAILABLE;
    }

    // Check for permission denied
    if (message.includes('permission') || message.includes('access denied') ||
        code === 'PERMISSION_DENIED' || code === 403) {
      if (context.isExternalService) {
        return ErrorCategory.SERVICE_PERMISSION_DENIED;
      }
      return ErrorCategory.AUTH_INSUFFICIENT_PERMISSIONS;
    }

    // Check for boundary enforcement
    if (context.isBoundaryThrottled) {
      return ErrorCategory.BOUNDARY_AUTO_THROTTLED;
    }
    if (context.isBoundaryPaused) {
      return ErrorCategory.BOUNDARY_AUTO_PAUSED;
    }
    if (context.isBoundaryDisabled) {
      return ErrorCategory.BOUNDARY_AUTO_DISABLED;
    }

    // Check for user cancellation
    if (message.includes('cancelled') || message.includes('canceled') ||
        context.isCancelled) {
      return ErrorCategory.USER_CANCELLED;
    }

    // Check for validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        code === 'VALIDATION_ERROR') {
      if (context.isDataValidation) {
        return ErrorCategory.DATA_VALIDATION_FAILED;
      }
      if (context.isConfigValidation) {
        return ErrorCategory.CONFIG_INVALID;
      }
      return ErrorCategory.WORKFLOW_VALIDATION_FAILED;
    }

    // Check for missing configuration
    if (message.includes('missing') || message.includes('required') ||
        message.includes('not provided')) {
      return ErrorCategory.CONFIG_MISSING_FIELD;
    }

    // Check for data not found
    if (message.includes('not found') || message.includes('does not exist') ||
        code === 'NOT_FOUND' || code === 404) {
      return ErrorCategory.DATA_NOT_FOUND;
    }

    // Default to unknown
    return ErrorCategory.UNKNOWN_ERROR;
  }

  /**
   * Handle an error and return user-facing response
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context
   * @returns {Promise<Object>} User-facing error response
   */
  async handleError(error, context = {}) {
    // Categorize the error
    const category = await this.categorizeError(error, context);

    // Generate user-facing response
    const response = await this.toUserFacing(error, category, context);

    // Log the error with resolution ID
    logger.error('Error handled with user-facing response', {
      error: error?.message,
      category,
      resolutionId: response.resolutionId,
      userId: context.userId,
      workflowId: context.workflowId
    });

    // Store error for analytics
    await this._storeError(context.userId, response, error);

    return response;
  }

  /**
   * Generate a response for HTTP errors
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} User-facing response
   */
  async fromHttpStatus(statusCode, message, context = {}) {
    const categoryMap = {
      400: ErrorCategory.CONFIG_INVALID,
      401: ErrorCategory.AUTH_TOKEN_EXPIRED,
      403: ErrorCategory.AUTH_INSUFFICIENT_PERMISSIONS,
      404: ErrorCategory.DATA_NOT_FOUND,
      408: ErrorCategory.WORKFLOW_TIMEOUT,
      422: ErrorCategory.WORKFLOW_VALIDATION_FAILED,
      429: ErrorCategory.RATE_LIMIT_EXCEEDED,
      500: ErrorCategory.SYSTEM_INTERNAL_ERROR,
      502: ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED,
      503: ErrorCategory.SERVICE_UNAVAILABLE
    };

    const category = categoryMap[statusCode] || ErrorCategory.UNKNOWN_ERROR;

    return this.toUserFacing({ message }, category, {
      ...context,
      statusCode
    });
  }

  /**
   * Get resolution by ID
   * @param {string} resolutionId - Resolution ID
   * @returns {Promise<Object|null>} Resolution details
   */
  async getResolutionById(resolutionId) {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('error_resolutions')
        .select('*')
        .eq('resolution_id', resolutionId)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (err) {
      logger.warn('Failed to get resolution by ID', { resolutionId, error: err.message });
      return null;
    }
  }

  // =====================================================
  // Private Methods
  // =====================================================

  /**
   * Resolve legacy category to new category
   */
  _resolveCategory(category) {
    return LegacyCategoryMappings[category] || category;
  }

  /**
   * Build variables for template substitution
   */
  _buildVariables(category, context) {
    const variables = {
      service: context.service || 'the service',
      limit: context.limit || 'the limit',
      count: context.count || 'the count',
      unit: context.unit || 'minute',
      duration: context.duration || '30 seconds',
      timeout: context.timeout || '30',
      element: context.element || 'the element',
      plan: context.plan || 'current',
      resource: context.resource || 'resource',
      time: context.time || '30 minutes',
      quota: context.quota || 'quota'
    };

    // Extract service from context if available
    if (context.integrationName) {
      variables.service = getFriendlyServiceName(context.integrationName);
    }

    return variables;
  }

  /**
   * Enrich resolution with user context
   */
  async _enrichWithUserContext(resolution, context) {
    // Add user-specific information if available
    if (context.userId && this.supabase) {
      try {
        const { data: userData } = await this.supabase
          .from('user_profiles')
          .select('plan_name, email')
          .eq('id', context.userId)
          .single();

        if (userData) {
          resolution.userPlan = userData.plan_name;
          resolution.userEmail = userData.email;
        }
      } catch (err) {
        // Ignore errors - user context enrichment is best-effort
      }
    }

    return resolution;
  }

  /**
   * Get metadata for error tracking
   */
  _getMetadata(category) {
    const categoryMetadata = ErrorCategoryMetadata[category] || {};
    return {
      category,
      severity: categoryMetadata.severity || 'error',
      retryable: categoryMetadata.retryable || false,
      boundaryRelated: isBoundaryRelated(category),
      priority: categoryMetadata.priority || 'medium'
    };
  }

  /**
   * Generate unique resolution ID
   */
  _generateResolutionId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().slice(0, 8).toUpperCase();
    return `RES-${timestamp}-${random}`;
  }

  /**
   * Store error for analytics
   */
  async _storeError(userId, response, originalError) {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from('error_resolutions')
        .insert({
          resolution_id: response.resolutionId,
          user_id: userId,
          category: response.context.category,
          what: response.what,
          why: response.why,
          action_primary: response.action.primary,
          retryable: response.retryable,
          retry_after: response.retryAfter,
          original_error: originalError?.message,
          created_at: new Date().toISOString()
        });
    } catch (err) {
      logger.warn('Failed to store error resolution', { error: err.message });
    }
  }
}

/**
 * Create user-facing error response object
 * Helper function for quick error responses
 */
function createUserFacingError(category, message, context = {}) {
  const service = new UserFacingErrorService();
  return service.toUserFacing({ message }, category, context);
}

module.exports = {
  UserFacingErrorService,
  createUserFacingError,
  ErrorCategory
};
