/**
 * Environment-Aware Messaging Utility
 * 
 * Provides consistent, environment-aware messaging across the entire UI:
 * - Development: Shows detailed technical messages for debugging
 * - Production: Shows user-friendly, consumer-focused messages
 * 
 * This utility should be used for ALL user-facing messages, logs, and notifications.
 */

/**
 * Detect if we're in development mode
 */
export const isDevelopment = () => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV !== 'production' ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
       window.location.hostname === '127.0.0.1'))
  );
};

export const isProduction = () => !isDevelopment();

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
 *   dev: 'Firebase config missing: REACT_APP_FIREBASE_PROJECT_ID not set',
 *   prod: 'Configuration error. Please contact support.'
 * })
 */
export const getEnvMessage = ({ dev, prod, default: defaultMsg }) => {
  if (isDevelopment()) {
    return dev || defaultMsg || prod || 'An error occurred';
  }
  return prod || defaultMsg || dev || 'An error occurred';
};

/**
 * Get environment-aware log message
 * For console logs that should show technical details in dev but be silent/minimal in prod
 * 
 * @param {string} devMessage - Technical message for development
 * @param {string} prodMessage - Optional user-friendly message for production (if null, logs are suppressed in prod)
 * @returns {string|null} - Message to log, or null if should be suppressed
 */
export const getEnvLogMessage = (devMessage, prodMessage = null) => {
  if (isDevelopment()) {
    return devMessage;
  }
  return prodMessage; // null = suppress in production
};

/**
 * Format console log with environment awareness
 * Automatically formats messages based on environment
 * 
 * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
 * @param {string} devMessage - Technical message for development
 * @param {string} prodMessage - Optional user-friendly message for production
 * @param {Object} extra - Additional context data
 */
export const envLog = (level, devMessage, prodMessage = null, extra = {}) => {
  const message = getEnvLogMessage(devMessage, prodMessage);
  if (!message) return; // Suppress in production if no prod message provided
  
  const consoleMethod = level === 'debug' ? 'debug' :
                       level === 'info' ? 'info' :
                       level === 'warn' ? 'warn' :
                       level === 'error' ? 'error' : 'log';
  
  if (isDevelopment() && extra && Object.keys(extra).length > 0) {
    console[consoleMethod](message, extra);
  } else {
    console[consoleMethod](message);
  }
};

/**
 * Get user-facing notification message
 * Always returns a user-friendly message, but includes technical details in dev
 * 
 * @param {Object} options - Message options
 * @param {string} options.userFriendly - User-friendly message (shown in both dev and prod)
 * @param {string} options.technical - Technical details (only shown in dev)
 * @returns {string} - Complete message for current environment
 */
export const getUserMessage = ({ userFriendly, technical = '' }) => {
  if (isDevelopment() && technical) {
    return `${userFriendly}${technical ? ` (${technical})` : ''}`;
  }
  return userFriendly;
};

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
export const getEnvErrorMessage = (error, options = {}) => {
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
    if (isDevelopment() && errorStr) {
      return `${userFriendly} (Technical: ${errorStr})`;
    }
    return userFriendly;
  }
  
  // Otherwise, use error message sanitization
  const { sanitizeErrorMessage } = require('./errorMessages');
  const sanitized = sanitizeErrorMessage(errorStr);
  
  // In development, optionally include stack trace
  if (isDevelopment() && includeStack && error instanceof Error && error.stack) {
    return `${sanitized}\n\nStack trace:\n${error.stack}`;
  }
  
  return sanitized;
};

/**
 * Environment-aware toast/notification message formatter
 * For use with toast notifications, alerts, and user-facing messages
 * 
 * @param {Object} options - Message options
 * @param {string} options.dev - Development message
 * @param {string} options.prod - Production message
 * @returns {string} - Formatted message
 */
export const formatNotification = ({ dev, prod }) => {
  return getEnvMessage({ dev, prod });
};

export default {
  isDevelopment,
  isProduction,
  getEnvMessage,
  getEnvLogMessage,
  envLog,
  getUserMessage,
  getEnvErrorMessage,
  formatNotification,
};

