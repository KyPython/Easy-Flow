/**
 * Common Environment Utilities
 * Shared utilities for environment variable parsing and detection
 * Extracted to eliminate duplicate code between analyticsGate.js and devNetLogger.js
 */

/**
 * Get environment variable from multiple potential sources
 * Checks window._env first, then process.env, with fallback to empty string
 * @param {string[]} keys - Array of environment variable keys to check
 * @returns {string} The first matching value or empty string
 */
export function getEnvVariable(keys) {
  // Check window._env first (runtime configuration)
  if (typeof window !== 'undefined' && window._env) {
    for (const key of keys) {
      if (window._env[key]) return window._env[key];
    }
  }

  // Check process.env (build-time configuration)
  if (typeof process !== 'undefined' && process.env) {
    for (const key of keys) {
      if (process.env[key]) return process.env[key];
    }
  }

  return '';
}

/**
 * Check if running in development environment
 * @returns {boolean} True if running in development mode
 */
export function isDevelopment() {
  return (
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') ||
    (typeof window !== 'undefined' && window.location && window.location.hostname === '127.0.0.1')
  );
}

/**
 * Get backend port from environment variables
 * @returns {string} The backend port or default '3030'
 */
export function getBackendPort() {
  return getEnvVariable(['VITE_BACKEND_PORT', 'REACT_APP_BACKEND_PORT']) || '3030';
}

/**
 * Get API base URL from environment variables or auto-detect
 * @returns {string} The API base URL
 */
export function getApiBaseUrl() {
  // Check for explicit env vars first
  const apiUrl = getEnvVariable(['VITE_API_URL', 'VITE_API_BASE', 'REACT_APP_API_URL', 'REACT_APP_API_BASE']);
  if (apiUrl) return apiUrl;

  // Auto-detect based on hostname (only if env vars are not set)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Development environments - use configured port
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const backendPort = getBackendPort();
      return `http://${hostname}:${backendPort}`;
    }

    // Production environments - use same origin (no hardcoded domains)
    // All production URLs should be configured via VITE_API_URL env var
    return window.location.origin;
  }

  // Fallback: empty string (relative URLs will work with proxy)
  return '';
}
