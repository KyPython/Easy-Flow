/**
 * Environment-Aware Error Message Sanitization Utility
 * 
 * Provides consistent error message handling across the application:
 * - Development: Shows detailed technical error messages for debugging
 * - Production: Shows user-friendly, consumer-focused messages
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

/**
 * Sanitize error messages based on environment
 * 
 * @param {string|Error|Object} error - The error to sanitize (string, Error object, or object with error info)
 * @returns {string|null} - Sanitized error message (null if no error provided)
 * 
 * @example
 * sanitizeErrorMessage('Unknown task type: invoice-download')
 * // Development: 'Unknown task type: invoice-download'
 * // Production: 'We encountered an issue processing this task type...'
 */
export const sanitizeErrorMessage = (error) => {
  if (!error) return null;

  // Extract error string from various input types
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

  const devMode = isDevelopment();

  // Production: Map technical errors to user-friendly messages
  const errorMappings = {
    'Unknown task type': 'We encountered an issue processing this task type. Please try again or contact support if the problem persists.',
    'unknown task type': 'We encountered an issue processing this task type. Please try again or contact support if the problem persists.',
    'task type not supported': 'This task type is not currently supported. Please try a different task type.',
    'authentication failed': 'Authentication failed. Please check your credentials and try again.',
    'connection timeout': 'The request took too long to complete. Please try again.',
    'network error': 'A network error occurred. Please check your connection and try again.',
    'invalid url': 'The provided URL is invalid. Please check the URL and try again.',
    'permission denied': 'You do not have permission to perform this action. Please contact support if you believe this is an error.',
    'cannot find module': 'A required component is missing. Please refresh the page or contact support.',
    'circular structure': 'An error occurred while processing data. Please try again.',
    'column.*does not exist': 'A database error occurred. Our team has been notified.',
    'econnrefused': 'Unable to connect to the server. Please check if the service is running.',
    'proxy error': 'Unable to connect to the server. Please check your connection.',
    'request timeout': 'The request took too long. Please try again.',
    'failed to fetch': 'Unable to connect to the server. Please check your internet connection.',
    'json parse': 'Invalid response from server. Please try again.',
    'syntax error': 'An error occurred while processing your request. Please try again.',
    'typeerror': 'An unexpected error occurred. Please try again or contact support.',
    'referenceerror': 'An unexpected error occurred. Please refresh the page.',
    'missing required field': 'Required information is missing. Please check your input and try again.',
    'missing required field:': 'Required information is missing. Please check your input and try again.',
    'pdf_url or url': 'The document URL is required. Please provide a valid URL and try again.',
    'pdf_url': 'The document URL is required. Please provide a valid URL and try again.',
    'url': 'A URL is required. Please provide a valid URL and try again.',
  };

  // Check for specific error patterns (case-insensitive) - apply in both dev and prod
  const errorLower = errorStr.toLowerCase();
  for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
    // Handle regex patterns (patterns that contain regex chars)
    if (pattern.includes('.*') || pattern.includes('^') || pattern.includes('$')) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(errorStr)) {
          // In development, include both friendly message and original error for debugging
          return devMode ? `${friendlyMessage} (Original: ${errorStr})` : friendlyMessage;
        }
      } catch (e) {
        // If regex is invalid, fall through to simple string matching
      }
    }
    // Simple string matching
    if (errorLower.includes(pattern.toLowerCase())) {
      // In development, include both friendly message and original error for debugging
      // In production, show only the friendly message
      if (devMode) {
        return `${friendlyMessage} (Original: ${errorStr})`;
      } else {
        return friendlyMessage;
      }
    }
  }

  // In development: for errors that don't match known patterns, return original with cleanup
  if (devMode) {
    // Still clean up stack traces and very long errors, but keep technical details
    if (errorStr.includes('stack') || errorStr.includes('trace') || errorStr.length > 500) {
      // Truncate very long errors but keep technical info
      const truncated = errorStr.length > 500 ? errorStr.substring(0, 500) + '...' : errorStr;
      return truncated;
    }
    return errorStr; // Return original technical error in development
  }

  // Check for technical error patterns (TypeError, SyntaxError, etc.)
  const technicalPatterns = [
    /Error:\s*(Cannot find module|Failed to load|WebpackError)/i,
    /TypeError:\s*(Cannot read properties of undefined|is not a function|Cannot read property)/i,
    /SyntaxError:\s*(Unexpected token|JSON.parse)/i,
    /ReferenceError:\s*(.*is not defined)/i,
    /Network Error|Request failed with status code/i,
    /database_error|database error/i,
    /column ".*" does not exist/i,
    /rpc.*failed/i,
    /messaging\/registration-token-not-registered/i,
    /Converting circular structure to JSON/i,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(errorStr)) {
      return 'A technical issue occurred during processing. Our team has been notified. Please try again later or contact support.';
    }
  }

  // If it's a short, readable message, return it as-is (might already be user-friendly)
  if (errorStr.length < 100 && !errorStr.includes('stack') && !errorStr.includes('trace') && !errorStr.includes('Error:')) {
    return errorStr;
  }

  // Default fallback for technical errors in production
  return 'An error occurred while processing your request. Please try again or contact support if the problem persists.';
};

/**
 * Extract error message from various error formats
 * Handles Axios errors, standard Errors, API response errors, etc.
 * 
 * @param {any} error - The error object
 * @returns {string} - Extracted error message
 */
export const extractErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';

  // Axios error structure
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (data.error) return typeof data.error === 'string' ? data.error : String(data.error);
    if (data.details) return data.details;
  }

  // Standard Error object
  if (error.message) return error.message;

  // String error
  if (typeof error === 'string') return error;

  // Object with error info
  if (error.error) return typeof error.error === 'string' ? error.error : String(error.error);

  // Last resort
  return String(error);
};

/**
 * Get user-friendly error message (extracts and sanitizes)
 * 
 * @param {any} error - The error to process
 * @returns {string|null} - User-friendly error message
 */
export const getUserFriendlyError = (error) => {
  if (!error) return null;
  const extracted = extractErrorMessage(error);
  return sanitizeErrorMessage(extracted);
};

export default {
  sanitizeErrorMessage,
  extractErrorMessage,
  getUserFriendlyError,
  isDevelopment,
};

