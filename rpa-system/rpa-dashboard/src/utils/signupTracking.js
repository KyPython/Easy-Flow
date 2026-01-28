/**
 * Signup Tracking Utility
 * Comprehensive tracking for signup funnel with error categorization
 */

import { trackEvent } from './api';
import { createLogger } from './logger';

const logger = createLogger('signupTracking');

/**
 * Error categories for signup failures
 */
export const SIGNUP_ERROR_TYPES = {
  VALIDATION: 'validation_error',
  NETWORK: 'network_error',
  RATE_LIMIT: 'rate_limit',
  USER_EXISTS: 'user_already_exists',
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  INVALID_CREDENTIALS: 'invalid_credentials',
  SERVER_ERROR: 'server_error',
  UNKNOWN: 'unknown_error'
};

/**
 * Categorize signup error for analytics
 */
export function categorizeSignupError(error) {
  if (!error) return SIGNUP_ERROR_TYPES.UNKNOWN;

  const msg = (error.message || error.toString() || '').toLowerCase();
  const status = error.status || error.statusCode;

  // Network errors
  if (
    error instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('enotfound') ||
    msg.includes('getaddrinfo')
  ) {
    return SIGNUP_ERROR_TYPES.NETWORK;
  }

  // Rate limiting
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many attempts')) {
    return SIGNUP_ERROR_TYPES.RATE_LIMIT;
  }

  // User already exists
  if (
    msg.includes('user already registered') ||
    msg.includes('email already registered') ||
    msg.includes('user already exists')
  ) {
    return SIGNUP_ERROR_TYPES.USER_EXISTS;
  }

  // Email not confirmed
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return SIGNUP_ERROR_TYPES.EMAIL_NOT_CONFIRMED;
  }

  // Invalid credentials
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password') ||
    msg.includes('wrong password') ||
    msg.includes('incorrect password')
  ) {
    return SIGNUP_ERROR_TYPES.INVALID_CREDENTIALS;
  }

  // Validation errors (client-side)
  if (msg.includes('invalid email') || msg.includes('password') || status === 400) {
    return SIGNUP_ERROR_TYPES.VALIDATION;
  }

  // Server errors
  if (status >= 500 || msg.includes('internal server error')) {
    return SIGNUP_ERROR_TYPES.SERVER_ERROR;
  }

  return SIGNUP_ERROR_TYPES.UNKNOWN;
}

/**
 * Track signup form viewed
 */
export async function trackSignupFormViewed(properties = {}) {
  try {
    await trackEvent({
      event_name: 'signup_form_viewed',
      properties: {
        timestamp: new Date().toISOString(),
        ...properties
      }
    });
  } catch (e) {
    logger.debug('Failed to track signup_form_viewed', { error: e });
  }
}

/**
 * Track signup attempt (user clicks submit)
 */
export async function trackSignupAttempt(properties = {}) {
  try {
    await trackEvent({
      event_name: 'signup_attempt',
      properties: {
        timestamp: new Date().toISOString(),
        ...properties
      }
    });
  } catch (e) {
    logger.debug('Failed to track signup_attempt', { error: e });
  }
}

/**
 * Track signup validation error (client-side validation failure)
 */
export async function trackSignupValidationError(errorType, properties = {}) {
  try {
    await trackEvent({
      event_name: 'signup_validation_error',
      properties: {
        error_type: errorType,
        timestamp: new Date().toISOString(),
        ...properties
      }
    });
  } catch (e) {
    logger.debug('Failed to track signup_validation_error', { error: e });
  }
}

/**
 * Track signup failure (server-side error)
 */
export async function trackSignupFailure(error, properties = {}) {
  try {
    const errorCategory = categorizeSignupError(error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorStatus = error?.status || error?.statusCode || null;

    await trackEvent({
      event_name: 'signup_failure',
      properties: {
        error_type: errorCategory,
        error_message: errorMessage.substring(0, 200), // Limit message length
        error_status: errorStatus,
        timestamp: new Date().toISOString(),
        ...properties
      }
    });

    // Also log to console/logger for debugging
    logger.error('[signupTracking] Signup failure tracked', {
      error_type: errorCategory,
      error_message: errorMessage,
      error_status: errorStatus,
      ...properties
    });
  } catch (e) {
    logger.debug('Failed to track signup_failure', { error: e });
  }
}

/**
 * Track signup success
 */
export async function trackSignupSuccess(properties = {}) {
  try {
    await trackEvent({
      event_name: 'signup_success',
      properties: {
        timestamp: new Date().toISOString(),
        ...properties
      }
    });
  } catch (e) {
    logger.debug('Failed to track signup_success', { error: e });
  }
}
