/**
 * Error Category Definitions for User-Facing Failure Resolution Layer
 *
 * Comprehensive error categorization system with metadata for each category.
 * Each category maps to specific user-facing resolution steps.
 */

const ErrorCategory = {
  // =====================================================
  // RATE LIMITING & QUOTAS
  // =====================================================

  /**
   * User exceeded a rate limit from an external service
   * Example: "Your workflow hit a rate limit from Service X"
   */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  /**
   * User exceeded their plan quota
   * Example: "You've reached your monthly API limit"
   */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  /**
   * User reached their monthly limit for a specific resource
   * Example: "You've used all 100 workflow runs this month"
   */
  MONTHLY_LIMIT_REACHED: 'MONTHLY_LIMIT_REACHED',

  // =====================================================
  // AUTHENTICATION & AUTHORIZATION
  // =====================================================

  /**
   * User's authentication token has expired
   * Example: "Your session has expired"
   */
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',

  /**
   * User provided invalid credentials
   * Example: "Login failed - incorrect username or password"
   */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',

  /**
   * User lacks required permissions for the action
   * Example: "You don't have permission to access this resource"
   */
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',

  /**
   * Multi-factor authentication is required
   * Example: "Please complete two-factor authentication"
   */
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',

  // =====================================================
  // WORKFLOW EXECUTION
  // =====================================================

  /**
   * Workflow operation timed out
   * Example: "The page took too long to load"
   */
  WORKFLOW_TIMEOUT: 'WORKFLOW_TIMEOUT',

  /**
   * Could not find a UI element on the page
   * Example: "We couldn't find the 'Submit' button"
   */
  WORKFLOW_ELEMENT_NOT_FOUND: 'WORKFLOW_ELEMENT_NOT_FOUND',

  /**
   * Page failed to load properly
   * Example: "The page didn't load completely"
   */
  WORKFLOW_PAGE_LOAD_FAILED: 'WORKFLOW_PAGE_LOAD_FAILED',

  /**
   * Navigation to a different page failed
   * Example: "Failed to navigate to the next page"
   */
  WORKFLOW_NAVIGATION_FAILED: 'WORKFLOW_NAVIGATION_FAILED',

  /**
   * Workflow validation step failed
   * Example: "The data validation failed"
   */
  WORKFLOW_VALIDATION_FAILED: 'WORKFLOW_VALIDATION_FAILED',

  /**
   * Assertion/condition check failed
   * Example: "Expected element was not visible"
   */
  WORKFLOW_ASSERTION_FAILED: 'WORKFLOW_ASSERTION_FAILED',

  // =====================================================
  // EXTERNAL SERVICES
  // =====================================================

  /**
   * External service is rate limiting the user
   * Example: "Google Sheets is limiting requests"
   */
  SERVICE_RATE_LIMIT: 'SERVICE_RATE_LIMIT',

  /**
   * External service is temporarily unavailable
   * Example: "Service X is temporarily down"
   */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  /**
   * Authentication with external service failed
   * Example: "Your Google account connection expired"
   */
  SERVICE_AUTH_FAILED: 'SERVICE_AUTH_FAILED',

  /**
   * External service denied permission
   * Example: "Service X access was revoked"
   */
  SERVICE_PERMISSION_DENIED: 'SERVICE_PERMISSION_DENIED',

  // =====================================================
  // DATA & CONFIGURATION
  // =====================================================

  /**
   * Required data was not found
   * Example: "The requested record doesn't exist"
   */
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',

  /**
   * Data validation failed
   * Example: "The uploaded file format is invalid"
   */
  DATA_VALIDATION_FAILED: 'DATA_VALIDATION_FAILED',

  /**
   * Data export operation failed
   * Example: "Failed to export your data"
   */
  DATA_EXPORT_FAILED: 'DATA_EXPORT_FAILED',

  /**
   * Configuration is invalid
   * Example: "Your workflow configuration has errors"
   */
  CONFIG_INVALID: 'CONFIG_INVALID',

  /**
   * Required configuration field is missing
   * Example: "Required field 'url' is missing"
   */
  CONFIG_MISSING_FIELD: 'CONFIG_MISSING_FIELD',

  // =====================================================
  // SYSTEM ERRORS
  // =====================================================

  /**
   * System is under heavy load
   * Example: "The service is experiencing high demand"
   */
  SYSTEM_OVERLOAD: 'SYSTEM_OVERLOAD',

  /**
   * System is undergoing scheduled maintenance
   * Example: "System maintenance in progress"
   */
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',

  /**
   * Unexpected internal error occurred
   * Example: "Something went wrong on our end"
   */
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',

  // =====================================================
  // USER ACTIONS
  // =====================================================

  /**
   * User cancelled the operation
   * Example: "Execution was cancelled by user"
   */
  USER_CANCELLED: 'USER_CANCELLED',

  /**
   * User action timed out (waiting for input)
   * Example: "You took too long to respond"
   */
  USER_TIMEOUT: 'USER_TIMEOUT',

  // =====================================================
  // BOUNDARY VIOLATIONS
  // =====================================================

  /**
   * User was automatically throttled for high frequency
   * Example: "Your workflow was temporarily paused due to frequency"
   */
  BOUNDARY_AUTO_THROTTLED: 'BOUNDARY_AUTO_THROTTLED',

  /**
   * Workflow was automatically paused due to failures
   * Example: "Your workflow was paused due to repeated failures"
   */
  BOUNDARY_AUTO_PAUSED: 'BOUNDARY_AUTO_PAUSED',

  /**
   * Account was automatically disabled due to violations
   * Example: "Your account was temporarily disabled"
   */
  BOUNDARY_AUTO_DISABLED: 'BOUNDARY_AUTO_DISABLED',

  // =====================================================
  // LEGACY / MIGRATION
  // =====================================================

  /**
   * Legacy error category - maps to new categories
   * Used during transition period
   */
  LEGACY_TIMEOUT: 'LEGACY_TIMEOUT',
  LEGACY_ELEMENT_NOT_FOUND: 'LEGACY_ELEMENT_NOT_FOUND',
  LEGACY_AUTH_ERROR: 'LEGACY_AUTH_ERROR',
  LEGACY_NETWORK_ERROR: 'LEGACY_NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Error category metadata for enhanced processing
 */
const ErrorCategoryMetadata = {
  [ErrorCategory.RATE_LIMIT_EXCEEDED]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 429,
    priority: 'high'
  },
  [ErrorCategory.QUOTA_EXCEEDED]: {
    severity: 'info',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 403,
    priority: 'high'
  },
  [ErrorCategory.MONTHLY_LIMIT_REACHED]: {
    severity: 'info',
    retryable: false,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 403,
    priority: 'high'
  },
  [ErrorCategory.AUTH_TOKEN_EXPIRED]: {
    severity: 'warning',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 401,
    priority: 'medium'
  },
  [ErrorCategory.AUTH_INVALID_CREDENTIALS]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 401,
    priority: 'high'
  },
  [ErrorCategory.AUTH_INSUFFICIENT_PERMISSIONS]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 403,
    priority: 'high'
  },
  [ErrorCategory.AUTH_MFA_REQUIRED]: {
    severity: 'warning',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 401,
    priority: 'medium'
  },
  [ErrorCategory.WORKFLOW_TIMEOUT]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 408,
    priority: 'medium'
  },
  [ErrorCategory.WORKFLOW_ELEMENT_NOT_FOUND]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 422,
    priority: 'high'
  },
  [ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 502,
    priority: 'medium'
  },
  [ErrorCategory.WORKFLOW_NAVIGATION_FAILED]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 502,
    priority: 'medium'
  },
  [ErrorCategory.WORKFLOW_VALIDATION_FAILED]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 422,
    priority: 'high'
  },
  [ErrorCategory.WORKFLOW_ASSERTION_FAILED]: {
    severity: 'error',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 422,
    priority: 'medium'
  },
  [ErrorCategory.SERVICE_RATE_LIMIT]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 429,
    priority: 'high'
  },
  [ErrorCategory.SERVICE_UNAVAILABLE]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 503,
    priority: 'high'
  },
  [ErrorCategory.SERVICE_AUTH_FAILED]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 401,
    priority: 'high'
  },
  [ErrorCategory.SERVICE_PERMISSION_DENIED]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 403,
    priority: 'high'
  },
  [ErrorCategory.DATA_NOT_FOUND]: {
    severity: 'info',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 404,
    priority: 'low'
  },
  [ErrorCategory.DATA_VALIDATION_FAILED]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 422,
    priority: 'high'
  },
  [ErrorCategory.DATA_EXPORT_FAILED]: {
    severity: 'error',
    retryable: true,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 500,
    priority: 'medium'
  },
  [ErrorCategory.CONFIG_INVALID]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 400,
    priority: 'high'
  },
  [ErrorCategory.CONFIG_MISSING_FIELD]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 400,
    priority: 'high'
  },
  [ErrorCategory.SYSTEM_OVERLOAD]: {
    severity: 'warning',
    retryable: true,
    retryAfter: true,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 503,
    priority: 'high'
  },
  [ErrorCategory.SYSTEM_MAINTENANCE]: {
    severity: 'info',
    retryable: false,
    retryAfter: true,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 503,
    priority: 'high'
  },
  [ErrorCategory.SYSTEM_INTERNAL_ERROR]: {
    severity: 'error',
    retryable: true,
    retryAfter: true,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 500,
    priority: 'critical'
  },
  [ErrorCategory.USER_CANCELLED]: {
    severity: 'info',
    retryable: false,
    retryAfter: false,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 200,
    priority: 'low'
  },
  [ErrorCategory.USER_TIMEOUT]: {
    severity: 'info',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: false,
    httpStatus: 408,
    priority: 'low'
  },
  [ErrorCategory.BOUNDARY_AUTO_THROTTLED]: {
    severity: 'warning',
    retryable: false,
    retryAfter: true,
    userActionable: true,
    boundaryRelated: true,
    httpStatus: 429,
    priority: 'high'
  },
  [ErrorCategory.BOUNDARY_AUTO_PAUSED]: {
    severity: 'warning',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: true,
    httpStatus: 423,
    priority: 'high'
  },
  [ErrorCategory.BOUNDARY_AUTO_DISABLED]: {
    severity: 'error',
    retryable: false,
    retryAfter: false,
    userActionable: true,
    boundaryRelated: true,
    httpStatus: 403,
    priority: 'critical'
  },
  [ErrorCategory.UNKNOWN_ERROR]: {
    severity: 'error',
    retryable: true,
    retryAfter: true,
    userActionable: false,
    boundaryRelated: false,
    httpStatus: 500,
    priority: 'medium'
  }
};

/**
 * Legacy error category mappings
 * Maps old error categories to new categories
 */
const LegacyCategoryMappings = {
  'TIMEOUT_ERROR': ErrorCategory.WORKFLOW_TIMEOUT,
  'ELEMENT_NOT_FOUND': ErrorCategory.WORKFLOW_ELEMENT_NOT_FOUND,
  'PAGE_LOAD_ERROR': ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED,
  'AUTHENTICATION_ERROR': ErrorCategory.SERVICE_AUTH_FAILED,
  'NETWORK_ERROR': ErrorCategory.SERVICE_UNAVAILABLE,
  'USER_CANCELLED': ErrorCategory.USER_CANCELLED,
  'AUTOMATION_SERVICE_UNAVAILABLE': ErrorCategory.SERVICE_UNAVAILABLE,
  'AUTOMATION_SERVICE_NOT_CONFIGURED': ErrorCategory.CONFIG_INVALID
};

/**
 * Service name mappings for external service errors
 */
const ServiceNameMappings = {
  'google_sheets': 'Google Sheets',
  'google_drive': 'Google Drive',
  'gmail': 'Gmail',
  'slack': 'Slack',
  'dropbox': 'Dropbox',
  'salesforce': 'Salesforce',
  'hubspot': 'HubSpot',
  'quickbooks': 'QuickBooks',
  'asana': 'Asana',
  'trello': 'Trello',
  'linkedin': 'LinkedIn',
  'twitter': 'X (Twitter)',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic'
};

/**
 * Get friendly service name
 * @param {string} serviceKey - Internal service key
 * @returns {string} User-friendly service name
 */
function getFriendlyServiceName(serviceKey) {
  return ServiceNameMappings[serviceKey?.toLowerCase()] || serviceKey || 'the service';
}

/**
 * Get HTTP status for category
 * @param {string} category - Error category
 * @returns {number} HTTP status code
 */
function getHttpStatus(category) {
  const metadata = ErrorCategoryMetadata[category];
  return metadata?.httpStatus || 500;
}

/**
 * Check if category is boundary-related
 * @param {string} category - Error category
 * @returns {boolean} Whether category is boundary-related
 */
function isBoundaryRelated(category) {
  const metadata = ErrorCategoryMetadata[category];
  return metadata?.boundaryRelated || false;
}

/**
 * Check if error is retryable
 * @param {string} category - Error category
 * @returns {boolean} Whether error is retryable
 */
function isRetryable(category) {
  const metadata = ErrorCategoryMetadata[category];
  return metadata?.retryable || false;
}

/**
 * Get retry delay for category (in milliseconds)
 * @param {string} category - Error category
 * @param {number} defaultDelay - Default retry delay
 * @returns {number} Retry delay in milliseconds
 */
function getRetryDelay(category, defaultDelay = 60000) {
  const delays = {
    [ErrorCategory.RATE_LIMIT_EXCEEDED]: 30 * 60 * 1000, // 30 minutes
    [ErrorCategory.SERVICE_RATE_LIMIT]: 60 * 1000, // 1 minute
    [ErrorCategory.SERVICE_UNAVAILABLE]: 5 * 60 * 1000, // 5 minutes
    [ErrorCategory.WORKFLOW_TIMEOUT]: 60 * 1000, // 1 minute
    [ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED]: 30 * 1000, // 30 seconds
    [ErrorCategory.WORKFLOW_NAVIGATION_FAILED]: 30 * 1000, // 30 seconds
    [ErrorCategory.BOUNDARY_AUTO_THROTTLED]: 30 * 60 * 1000, // 30 minutes
    [ErrorCategory.SYSTEM_OVERLOAD]: 2 * 60 * 1000, // 2 minutes
    [ErrorCategory.SYSTEM_MAINTENANCE]: 60 * 60 * 1000, // 1 hour
    [ErrorCategory.SYSTEM_INTERNAL_ERROR]: 5 * 60 * 1000 // 5 minutes
  };

  return delays[category] || defaultDelay;
}

module.exports = {
  ErrorCategory,
  ErrorCategoryMetadata,
  LegacyCategoryMappings,
  ServiceNameMappings,
  getFriendlyServiceName,
  getHttpStatus,
  isBoundaryRelated,
  isRetryable,
  getRetryDelay
};
