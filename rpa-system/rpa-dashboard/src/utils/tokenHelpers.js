/**
 * Shared Token Helpers
 * Centralized token retrieval and management utilities
 * Extracted to avoid duplication across analyticsGate.js and devNetLogger.js
 */

/**
 * Get auth token from localStorage
 * Supports multiple storage keys and guards against invalid values
 * @returns {string|null} The auth token or null if not found
 */
export function getAuthToken() {
  try {
    const rawToken = localStorage.getItem('dev_token') || 
                     localStorage.getItem('authToken') || 
                     localStorage.getItem('token');
    
    // Guard against string 'null'/'undefined' which can occur due to bugs
    if (rawToken && rawToken !== 'undefined' && rawToken !== 'null') {
      return rawToken;
    }
    return null;
  } catch {
    // localStorage may be unavailable in some environments (SSR/tests)
    return null;
  }
}

/**
 * Clear auth tokens from localStorage
 * Clears all known token storage keys
 */
export function clearAuthTokens() {
  try {
    localStorage.removeItem('dev_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
  } catch (e) {
    console.error('[tokenHelpers] Failed to clear auth tokens:', e);
  }
}

/**
 * Dispatch a custom event for app-level auth handling
 * @param {string} eventName - The name of the event to dispatch
 * @param {object} detail - Optional detail data for the event
 * @returns {boolean} Whether the event was dispatched successfully
 */
export function dispatchAuthEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      return true;
    } catch (e) {
      console.error(`[tokenHelpers] Failed to dispatch ${eventName}:`, e);
      return false;
    }
  }
  return false;
}

/**
 * Check if an endpoint is an auth endpoint (to avoid infinite loops during self-heal)
 * @param {string} url - The URL to check
 * @returns {boolean} Whether the URL is an auth endpoint
 */
export function isAuthEndpoint(url) {
  return url.includes('/auth/') || url.includes('/login') || url.includes('/session');
}

export default {
  getAuthToken,
  clearAuthTokens,
  dispatchAuthEvent,
  isAuthEndpoint
};
