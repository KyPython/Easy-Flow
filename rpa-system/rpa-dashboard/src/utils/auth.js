/**
 * Authentication helpers shared across dashboard utils
 */

export function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export function getAuthToken() {
  const rawToken = safeLocalStorageGet('dev_token') || safeLocalStorageGet('authToken') || safeLocalStorageGet('token') || null;
  if (!rawToken) return null;
  if (rawToken === 'undefined' || rawToken === 'null') return null;
  return rawToken;
}

export function clearAuthTokens() {
  try {
    localStorage.removeItem('dev_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
  } catch (e) {
    // ignore
  }
}

export default { safeLocalStorageGet, getAuthToken, clearAuthTokens };
