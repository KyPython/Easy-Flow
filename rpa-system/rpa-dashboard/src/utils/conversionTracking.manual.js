/**
 * Browser-only manual test helper for conversion tracking
 * This file is intentionally NOT a Jest test. Use in the browser console:
 *   testConversionTracking()
 */

// Test script for browser console
const testConversionTracking = () => {
  console.log('🧪 Testing Conversion Tracking...');
  
  // Mock gtag for testing
  if (typeof window !== 'undefined' && !window.gtag) {
    window.gtag = (type, event, params) => {
      console.log(`📊 MOCK GA4 Event: ${event}`, params);
    };
  }
  
  // Test basic event tracking
  console.log('\n1. Testing basic event tracking...');
  if (typeof window !== 'undefined' && window.conversionTracker) {
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows');
    window.conversionTracker.trackUpgradeClicked('paywall_modal', 'Upgrade Now', 'hobbyist', 'advanced_features');
    window.conversionTracker.trackPaywallDismissed('advanced_features', 'hobbyist');
  }
  
  // Test throttling
  console.log('\n2. Testing throttling (should prevent duplicates)...');
  if (typeof window !== 'undefined' && window.conversionTracker) {
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows');
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows'); // Should be throttled
  }
  
  console.log('\n✅ Conversion tracking test complete!');
  console.log('Check your browser network tab and GA4 Real-time events.');
};

// Make test function globally available in browser
if (typeof window !== 'undefined') {
  window.testConversionTracking = testConversionTracking;
}

export default testConversionTracking;
