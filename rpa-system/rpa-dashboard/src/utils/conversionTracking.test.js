/**
 * Simple test file for conversion tracking
 * Run this in browser console to verify tracking works
 */

// Test script for browser console
const testConversionTracking = () => {
  console.log('🧪 Testing Conversion Tracking...');
  
  // Import the tracker (this would work in browser with ES6 modules)
  // const conversionTracker = require('./conversionTracking').default;
  
  // Mock gtag for testing
  if (!window.gtag) {
    window.gtag = (type, event, params) => {
      console.log(`📊 MOCK GA4 Event: ${event}`, params);
    };
  }
  
  // Test basic event tracking
  console.log('\n1. Testing basic event tracking...');
  if (window.conversionTracker) {
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows');
    window.conversionTracker.trackUpgradeClicked('paywall_modal', 'Upgrade Now', 'hobbyist', 'advanced_features');
    window.conversionTracker.trackPaywallDismissed('advanced_features', 'hobbyist');
  }
  
  // Test throttling
  console.log('\n2. Testing throttling (should prevent duplicates)...');
  if (window.conversionTracker) {
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows');
    window.conversionTracker.trackPaywallShown('advanced_features', 'hobbyist', '/app/workflows'); // Should be throttled
  }
  
  console.log('\n✅ Conversion tracking test complete!');
  console.log('Check your browser network tab and GA4 Real-time events.');
};

// Instructions for manual testing
console.log(`
🧪 CONVERSION TRACKING TEST INSTRUCTIONS:

1. Open browser console on your EasyFlow app
2. Run: testConversionTracking()
3. Trigger a real paywall (try accessing a Pro feature)
4. Click upgrade buttons on pricing page
5. Check GA4 Real-time > Events tab within 30 seconds

Expected events:
- paywall_shown
- upgrade_clicked  
- paywall_dismissed
- feature_comparison_viewed
- milestone_reached (when implemented)

If you see "✅ Event tracked: [event_name]" in console, it's working!
`);

// Make test function globally available
if (typeof window !== 'undefined') {
  window.testConversionTracking = testConversionTracking;
}

export default testConversionTracking;