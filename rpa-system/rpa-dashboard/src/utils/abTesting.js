/**
 * A/B Testing Utility
 * Handles variant selection and tracking for A/B tests
 */

import { trackEvent } from './api';

/**
 * Get A/B test variant for a given test name
 * Uses consistent hashing based on test name and user ID (if available)
 * @param {string} testName - Name of the A/B test
 * @param {string|null} userId - Optional user ID for consistent assignment
 * @returns {string} Variant name ('A' or 'B')
 */
export function getABTestVariant(testName, userId = null) {
  if (!testName) return 'A';

  // Try to get user ID from session storage if not provided
  if (!userId) {
    try {
      const session = sessionStorage.getItem('sb-auth-token');
      if (session) {
        const parsed = JSON.parse(session);
        userId = parsed?.user?.id || null;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Create a hash from test name + user ID (or session ID as fallback)
  const seed = `${testName}_${userId || sessionStorage.getItem('session_id') || 'anonymous'}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Assign to variant A or B based on hash
  const variant = Math.abs(hash) % 2 === 0 ? 'A' : 'B';
  
  // Store variant in session storage for consistency
  const storageKey = `ab_test_${testName}`;
  if (!sessionStorage.getItem(storageKey)) {
    sessionStorage.setItem(storageKey, variant);
  }

  return sessionStorage.getItem(storageKey) || variant;
}

/**
 * Track A/B test view event
 * @param {string} testName - Name of the A/B test
 * @param {string} variant - Variant shown ('A' or 'B')
 * @param {object} additionalProps - Additional properties to track
 */
export async function trackABTestView(testName, variant, additionalProps = {}) {
  await trackEvent({
    event_name: 'ab_test_viewed',
    properties: {
      test_name: testName,
      variant: variant,
      timestamp: new Date().toISOString(),
      ...additionalProps
    }
  });
}

