/**
 * Consumer-Friendly Error Messages
 * 
 * Maps technical error categories to user-friendly messages that:
 * - Are clear and actionable
 * - Don't expose internal implementation details
 * - Guide users on what to do next
 * - Never show stack traces or technical jargon
 */

const CONSUMER_FRIENDLY_ERRORS = {
  /**
   * NO_STEPS_EXECUTED
   * Technical: Automation worker didn't process any workflow steps (usually Kafka issue)
   * Consumer: Service temporarily unavailable
   */
  'NO_STEPS_EXECUTED': {
    message: 'Workflow execution failed. Please try running the workflow again.',
    userAction: 'If this issue persists, contact support with your workflow execution ID.',
    statusCode: 500,
    retryable: true
  },

  /**
   * KAFKA_CONNECTION_ERROR
   * Technical: Backend can't publish to or worker can't consume from Kafka
   * Consumer: Service temporarily unavailable
   */
  'KAFKA_CONNECTION_ERROR': {
    message: 'Service temporarily unavailable. Please try again in a moment.',
    userAction: 'Check our status page for service updates.',
    statusCode: 503,
    retryable: true
  },

  /**
   * DATABASE_TIMEOUT
   * Technical: Supabase query took too long
   * Consumer: Request timed out
   */
  'DATABASE_TIMEOUT': {
    message: 'Request timed out. Please try again.',
    userAction: null,
    statusCode: 504,
    retryable: true
  },

  /**
   * WORKFLOW_CONFIGURATION_ERROR
   * Technical: Invalid workflow definition (missing steps, invalid types, etc.)
   * Consumer: Workflow setup issue
   */
  'WORKFLOW_CONFIGURATION_ERROR': {
    message: 'This workflow has a configuration issue and cannot run.',
    userAction: 'Please check your workflow settings and ensure all required fields are filled.',
    statusCode: 400,
    retryable: false
  },

  /**
   * TIMEOUT
   * Technical: Workflow exceeded maximum execution time
   * Consumer: Execution took too long
   */
  'TIMEOUT': {
    message: 'Workflow execution timed out.',
    userAction: 'Try breaking your workflow into smaller steps, or contact support if you need longer execution times.',
    statusCode: 408,
    retryable: true
  },

  /**
   * STEP_EXECUTION_ERROR
   * Technical: A specific step failed during execution
   * Consumer: Specific step failed
   */
  'STEP_EXECUTION_ERROR': {
    message: 'A step in your workflow encountered an error.',
    userAction: 'Review the workflow execution details to see which step failed and why.',
    statusCode: 500,
    retryable: true
  },

  /**
   * AUTHENTICATION_ERROR
   * Technical: Invalid credentials or expired token
   * Consumer: Authentication issue
   */
  'AUTHENTICATION_ERROR': {
    message: 'Authentication failed.',
    userAction: 'Please sign out and sign back in, then try again.',
    statusCode: 401,
    retryable: false
  },

  /**
   * AUTHORIZATION_ERROR
   * Technical: User doesn't have permission for this operation
   * Consumer: Permission denied
   */
  'AUTHORIZATION_ERROR': {
    message: "You don't have permission to perform this action.",
    userAction: 'Contact your team administrator if you need access.',
    statusCode: 403,
    retryable: false
  },

  /**
   * RATE_LIMIT_EXCEEDED
   * Technical: Too many requests in time window
   * Consumer: Rate limited
   */
  'RATE_LIMIT_EXCEEDED': {
    message: "You've exceeded the rate limit for workflow executions.",
    userAction: 'Please wait a moment before trying again.',
    statusCode: 429,
    retryable: true
  },

  /**
   * RESOURCE_NOT_FOUND
   * Technical: Workflow or execution doesn't exist in database
   * Consumer: Not found
   */
  'RESOURCE_NOT_FOUND': {
    message: 'The requested workflow or execution was not found.',
    userAction: 'Please verify the ID and try again.',
    statusCode: 404,
    retryable: false
  },

  /**
   * EXTERNAL_SERVICE_ERROR
   * Technical: Third-party API call failed
   * Consumer: External service issue
   */
  'EXTERNAL_SERVICE_ERROR': {
    message: 'A required external service is currently unavailable.',
    userAction: 'This is usually temporary. Please try again in a few minutes.',
    statusCode: 502,
    retryable: true
  },

  /**
   * VALIDATION_ERROR
   * Technical: Input validation failed
   * Consumer: Invalid input
   */
  'VALIDATION_ERROR': {
    message: 'The workflow input contains invalid data.',
    userAction: 'Please check your input and try again.',
    statusCode: 400,
    retryable: false
  },

  /**
   * DEFAULT
   * Fallback for unknown error categories
   */
  'DEFAULT': {
    message: 'An unexpected error occurred.',
    userAction: 'Please try again. If the issue persists, contact support.',
    statusCode: 500,
    retryable: true
  }
};

/**
 * Get consumer-friendly error message and metadata
 * @param {string} errorCategory - Technical error category (e.g., 'NO_STEPS_EXECUTED')
 * @param {object} context - Additional context (executionId, userId, etc.)
 * @returns {object} Consumer-friendly error details
 */
function getConsumerError(errorCategory, context = {}) {
  const errorConfig = CONSUMER_FRIENDLY_ERRORS[errorCategory] || CONSUMER_FRIENDLY_ERRORS['DEFAULT'];
  
  return {
    // Consumer-facing message (safe to show in UI)
    message: errorConfig.message,
    
    // Optional actionable guidance
    action: errorConfig.userAction,
    
    // HTTP status code
    statusCode: errorConfig.statusCode,
    
    // Whether the operation can be retried
    retryable: errorConfig.retryable,
    
    // Execution ID for support tickets (safe to expose)
    executionId: context.executionId,
    
    // Timestamp (safe to expose)
    timestamp: new Date().toISOString()
  };
}

/**
 * Format error response for API
 * @param {string} errorCategory - Technical error category
 * @param {object} context - Additional context
 * @returns {object} API error response
 */
function formatErrorResponse(errorCategory, context = {}) {
  const consumerError = getConsumerError(errorCategory, context);
  
  return {
    error: {
      message: consumerError.message,
      action: consumerError.action,
      executionId: consumerError.executionId,
      timestamp: consumerError.timestamp,
      retryable: consumerError.retryable
    }
  };
}

/**
 * Map technical error message to consumer-friendly version
 * while preserving full technical details for logging
 * 
 * @param {string} technicalError - Technical error message
 * @param {string} errorCategory - Error category
 * @param {object} context - Additional context
 * @returns {object} { technical, consumer }
 */
function mapError(technicalError, errorCategory, context = {}) {
  const consumerError = getConsumerError(errorCategory, context);
  
  return {
    // For logs (full technical details)
    technical: {
      message: technicalError,
      category: errorCategory,
      context
    },
    
    // For API response (consumer-friendly)
    consumer: {
      message: consumerError.message,
      action: consumerError.userAction,
      executionId: context.executionId,
      retryable: consumerError.retryable
    },
    
    // HTTP status code
    statusCode: consumerError.statusCode
  };
}

module.exports = {
  CONSUMER_FRIENDLY_ERRORS,
  getConsumerError,
  formatErrorResponse,
  mapError
};
