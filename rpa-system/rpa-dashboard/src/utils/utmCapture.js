/**
 * UTM Parameter Capture Utility
 * Captures and stores UTM parameters from URL for analytics
 */

/**
 * Extract UTM parameters from current URL
 * @returns {object} Object with UTM parameters
 */
export function captureUTMParams() {
  const urlParams = new URLSearchParams(window.location.search);
  
  return {
    source: urlParams.get('utm_source') || null,
    medium: urlParams.get('utm_medium') || null,
    campaign: urlParams.get('utm_campaign') || null,
    term: urlParams.get('utm_term') || null,
    content: urlParams.get('utm_content') || null,
    referrer: document.referrer || null,
    landing_page: window.location.pathname
  };
}

/**
 * Store UTM parameters in session storage for later use
 * @param {object} utmParams - UTM parameters object
 */
export function storeUTMParams(utmParams) {
  try {
    sessionStorage.setItem('utm_params', JSON.stringify({
      ...utmParams,
      captured_at: new Date().toISOString()
    }));
  } catch (e) {
    console.debug('[utmCapture] Failed to store UTM params:', e);
  }
}

/**
 * Get stored UTM parameters from session storage
 * @returns {object|null} Stored UTM parameters or null
 */
export function getStoredUTMParams() {
  try {
    const stored = sessionStorage.getItem('utm_params');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.debug('[utmCapture] Failed to retrieve UTM params:', e);
    return null;
  }
}

/**
 * Capture and store UTM parameters on page load
 * Call this on component mount or page load
 */
export function captureAndStoreUTM() {
  const utmParams = captureUTMParams();
  
  // Only store if we have at least one UTM parameter
  if (utmParams.source || utmParams.medium || utmParams.campaign) {
    storeUTMParams(utmParams);
  }
  
  return utmParams;
}

