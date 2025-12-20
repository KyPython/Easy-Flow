/**
 * Environment-Aware Message Utility
 * Provides user-facing messages that adapt based on environment (development, staging, production)
 * 
 * ✅ OBSERVABILITY: All messages are logged through structured logging
 * ✅ UX: Messages are tailored to environment (dev shows more detail, prod shows user-friendly messages)
 */

const logger = require('../middleware/structuredLogging');

const ENV = process.env.NODE_ENV || 'development';
const IS_DEVELOPMENT = ENV === 'development';
const IS_PRODUCTION = ENV === 'production';
const IS_STAGING = ENV === 'staging';

/**
 * Get environment-aware message
 * @param {Object} options - Message configuration
 * @param {string} options.dev - Message for development environment
 * @param {string} options.staging - Message for staging environment (optional, falls back to prod)
 * @param {string} options.prod - Message for production environment
 * @param {string} options.default - Default message if environment-specific not provided
 * @returns {string} Environment-appropriate message
 */
function getMessage({ dev, staging, prod, default: defaultMsg }) {
  if (IS_DEVELOPMENT && dev) {
    return dev;
  }
  if (IS_STAGING && staging) {
    return staging;
  }
  if (IS_PRODUCTION && prod) {
    return prod;
  }
  return defaultMsg || dev || staging || prod || 'An error occurred';
}

/**
 * Get user-friendly error message based on environment
 * @param {Error|string} error - Error object or error message
 * @param {Object} options - Additional options
 * @param {string} options.context - Context where error occurred
 * @param {string} options.userMessage - Custom user-friendly message
 * @param {boolean} options.logError - Whether to log the error (default: true)
 * @returns {string} User-friendly error message
 */
function getUserErrorMessage(error, options = {}) {
  const { context, userMessage, logError = true } = options;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log error through structured logging for observability
  if (logError) {
    logger.error(`[EnvironmentAwareMessages] Error in ${context || 'unknown context'}`, error instanceof Error ? error : new Error(errorMessage), {
      context,
      environment: ENV,
      user_message_provided: !!userMessage
    });
  }

  // Production: Show user-friendly message, hide technical details
  if (IS_PRODUCTION) {
    if (userMessage) {
      return userMessage;
    }
    
    // Map common errors to user-friendly messages
    const errorMappings = {
      'network': 'Connection issue. Please check your internet connection and try again.',
      'timeout': 'Request timed out. Please try again.',
      'not found': 'The requested resource was not found.',
      'unauthorized': 'You do not have permission to perform this action.',
      'validation': 'Please check your input and try again.',
      'database': 'A database error occurred. Please try again later.',
      'rate limit': 'Too many requests. Please wait a moment and try again.'
    };

    for (const [key, message] of Object.entries(errorMappings)) {
      if (errorMessage.toLowerCase().includes(key)) {
        return message;
      }
    }

    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }

  // Development/Staging: Show detailed error message
  if (IS_DEVELOPMENT || IS_STAGING) {
    if (userMessage) {
      return `${userMessage} (Dev: ${errorMessage})`;
    }
    return `Error: ${errorMessage}${errorStack ? `\n\nStack: ${errorStack}` : ''}`;
  }

  return userMessage || errorMessage;
}

/**
 * Get environment-aware notification message
 * @param {Object} options - Notification configuration
 * @param {string} options.type - Notification type (task_completed, task_failed, etc.)
 * @param {Object} options.data - Notification data
 * @param {Object} options.messages - Environment-specific messages
 * @returns {Object} Notification object with environment-aware message
 */
function getNotificationMessage({ type, data = {}, messages = {} }) {
  const { dev, staging, prod, default: defaultMsg } = messages;

  const message = getMessage({ dev, staging, prod, default: defaultMsg });

  // Log notification creation for observability
  logger.info('[EnvironmentAwareMessages] Notification message generated', {
    notification_type: type,
    environment: ENV,
    has_custom_message: !!(dev || staging || prod),
    data_keys: Object.keys(data)
  });

  return {
    message,
    environment: ENV,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format task status message for UI
 * @param {string} status - Task status (completed, failed, running, etc.)
 * @param {Object} options - Additional options
 * @param {string} options.taskName - Name of the task
 * @param {string} options.error - Error message if failed
 * @returns {string} Formatted status message
 */
function getTaskStatusMessage(status, options = {}) {
  const { taskName = 'Task', error } = options;

  const messages = {
    completed: {
      dev: `✅ Task "${taskName}" completed successfully`,
      prod: `Task completed successfully`
    },
    failed: {
      dev: `❌ Task "${taskName}" failed: ${error || 'Unknown error'}`,
      prod: `Task failed. ${error ? getUserErrorMessage(error, { logError: false }) : 'Please try again or contact support.'}`
    },
    running: {
      dev: `🔄 Task "${taskName}" is running...`,
      prod: `Task is running...`
    },
    pending: {
      dev: `⏳ Task "${taskName}" is pending`,
      prod: `Task is pending`
    }
  };

  const statusMessages = messages[status] || messages.failed;
  return getMessage(statusMessages);
}

/**
 * Format system alert message
 * @param {string} alert - Alert message
 * @param {string} severity - Alert severity (low, normal, high, critical)
 * @returns {string} Formatted alert message
 */
function getSystemAlertMessage(alert, severity = 'normal') {
  const prefix = IS_DEVELOPMENT ? `[DEV] ` : '';
  const severityEmoji = {
    low: 'ℹ️',
    normal: '⚠️',
    high: '🔴',
    critical: '🚨'
  };

  const emoji = severityEmoji[severity] || '⚠️';
  
  return {
    message: `${prefix}${emoji} ${alert}`,
    severity,
    environment: ENV,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getMessage,
  getUserErrorMessage,
  getNotificationMessage,
  getTaskStatusMessage,
  getSystemAlertMessage,
  ENV,
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  IS_STAGING
};

