/**
 * Environment-Aware Messaging Utility for Backend
 *
 * Provides consistent, environment-aware messaging across the backend:
 * - Development: Shows detailed technical messages for debugging
 * - Production: Shows user-friendly, consumer-focused messages
 *
 * Used for all user-facing messages, logs, and API error responses.
 */

const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('envAwareMessages');

/**
 * Detect if we're in production mode
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get environment-aware message
 *
 * @param {Object} options - Message options
 * @param {string} options.dev - Development message (technical, detailed)
 * @param {string} options.prod - Production message (user-friendly)
 * @param {string} options.default - Default message if dev/prod not specified
 * @returns {string} - Environment-appropriate message
 *
 * @example
 * getEnvMessage({
 *   dev: 'Database connection failed: ' + err.message,
 *   prod: 'Unable to connect to database. Please try again later.',
 *   default: 'An error occurred'
 * })
 */
function getEnvMessage({ dev, prod, default: defaultMsg }) {
  if (isProduction()) {
    return prod || defaultMsg || 'An error occurred';
  }
  return dev || defaultMsg || prod || 'An error occurred';
}

/**
 * Get environment-aware log message
 * For logs that should show technical details in dev but be silent/minimal in prod
 *
 * @param {string} devMessage - Technical message for development
 * @param {string} prodMessage - Optional user-friendly message for production
 * @returns {string|null} - Message to log, or null if should be suppressed
 */
function getEnvLogMessage(devMessage, prodMessage = null) {
  if (isProduction()) {
    return prodMessage; // null = suppress in production
  }
  return devMessage;
}

/**
 * Environment-aware logging wrapper
 * Automatically logs with appropriate detail level based on environment
 *
 * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
 * @param {string} devMessage - Technical message for development
 * @param {string} prodMessage - Optional user-friendly message for production
 * @param {Object} extra - Additional context data
 */
function envLog(level, devMessage, prodMessage = null, extra = {}) {
  const message = getEnvLogMessage(devMessage, prodMessage);
  if (!message && isProduction()) {
    return; // Suppress in production if no prod message
  }

  const logData = isProduction() ? { message: prodMessage || message } : { message, ...extra };

  switch (level) {
    case 'debug':
      logger.debug(logData, message);
      break;
    case 'info':
      logger.info(logData, message);
      break;
    case 'warn':
      logger.warn(logData, message);
      break;
    case 'error':
      logger.error(logData, message);
      break;
    default:
      logger.info(logData, message);
  }
}

/**
 * Get user-facing notification message
 * Always returns a user-friendly message, but includes technical details in dev
 *
 * @param {Object} options - Message options
 * @param {string} options.userFriendly - User-friendly message (shown in both dev and prod)
 * @param {string} options.technical - Technical details (only shown in dev)
 * @returns {string} - Complete message for current environment
 */
function getUserMessage({ userFriendly, technical = '' }) {
  if (!isProduction() && technical) {
    return `${userFriendly} (Technical: ${technical})`;
  }
  return userFriendly;
}

/**
 * Get environment-aware error message
 * Combines error message sanitization with environment awareness
 *
 * @param {string|Error|Object} error - The error to format
 * @param {Object} options - Additional options
 * @param {string} options.userFriendly - Override user-friendly message
 * @param {boolean} options.includeStack - Include stack trace (dev only)
 * @returns {string} - Formatted error message
 */
function getEnvErrorMessage(error, options = {}) {
  const { userFriendly, includeStack = false } = options;

  // Extract error string
  let errorStr = '';
  if (typeof error === 'string') {
    errorStr = error;
  } else if (error instanceof Error) {
    errorStr = error.message || String(error);
  } else if (error?.message) {
    errorStr = error.message;
  } else if (error?.error) {
    errorStr = typeof error.error === 'string' ? error.error : String(error.error);
  } else {
    errorStr = String(error);
  }

  // If user-friendly override provided, use it
  if (userFriendly) {
    if (!isProduction() && errorStr) {
      return `${userFriendly} (Technical: ${errorStr})`;
    }
    return userFriendly;
  }

  // Sanitize error message for production
  let sanitized = errorStr;
  if (isProduction()) {
    // Remove sensitive information patterns
    sanitized = errorStr
      .replace(/Bearer\s+[a-zA-Z0-9-_]+/g, 'Bearer [REDACTED]')
      .replace(/(password|secret|token|key|auth)["']?\s*[:=]\s*["']?[^"'\s}]+/gi, '$1: [REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
  }

  // In development, optionally include stack trace
  if (!isProduction() && includeStack && error instanceof Error && error.stack) {
    return `${sanitized}\n\nStack trace:\n${error.stack}`;
  }

  return sanitized;
}

/**
 * Environment-aware API response formatter
 * Creates consistent API responses with environment-appropriate messages
 *
 * @param {Object} options - Response options
 * @param {boolean} options.success - Whether the operation succeeded
 * @param {string} options.message - User-facing message
 * @param {string} options.devMessage - Technical message (dev only)
 * @param {Object} options.data - Response data
 * @param {Error} options.error - Error object (if failed)
 * @returns {Object} - Formatted API response
 */
function formatApiResponse({ success, message, devMessage, data, error }) {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };

  if (success) {
    response.message = message || 'Operation completed successfully';
    if (data) {
      response.data = data;
    }
  } else {
    response.message = message || getEnvMessage({
      dev: devMessage || error?.message || 'An error occurred',
      prod: message || 'An error occurred. Please try again.',
      default: 'An error occurred'
    });

    if (!isProduction() && (devMessage || error)) {
      response.devMessage = getEnvErrorMessage(error || devMessage, { includeStack: true });
    }

    if (error?.code) {
      response.code = error.code;
    }
  }

  return response;
}

/**
 * Format toast/notification message for current environment
 * For use with WebSocket notifications, real-time updates
 *
 * @param {Object} options - Message options
 * @param {string} options.dev - Development message
 * @param {string} options.prod - Production message
 * @returns {string} - Formatted message
 */
function formatNotification({ dev, prod }) {
  return getEnvMessage({ dev, prod });
}

module.exports = {
  isProduction,
  getEnvMessage,
  getEnvLogMessage,
  envLog,
  getUserMessage,
  getEnvErrorMessage,
  formatApiResponse,
  formatNotification
};
