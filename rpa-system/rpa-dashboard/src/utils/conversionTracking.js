/**
 * Conversion Tracking Utility
 * Provides consistent event tracking with throttling and error handling
 */

class ConversionTracker {
 constructor() {
 this.eventThrottleMap = new Map();
 this.throttleDelay = 2000; // 2 seconds to prevent duplicate events
 }

 /**
 * Track conversion event with throttling to prevent duplicates
 * @param {string} eventName - GA4 event name
 * @param {object} params - Event parameters
 */
 trackEvent(eventName, params = {}) {
 try {
 // Check if gtag is available
 if (!window.gtag) {
 console.warn('⚠️ gtag not available - conversion tracking skipped');
 return false;
 }

 // Create throttle key
 const throttleKey = `${eventName}_${JSON.stringify(params)}`;
 const now = Date.now();
 
 // Check if event was recently fired
 if (this.eventThrottleMap.has(throttleKey)) {
 const lastFired = this.eventThrottleMap.get(throttleKey);
 if (now - lastFired < this.throttleDelay) {
 console.log(`🚫 Event throttled: ${eventName}`);
 return false;
 }
 }

 // Track the event
 window.gtag('event', eventName, params);
 
 // Update throttle map
 this.eventThrottleMap.set(throttleKey, now);
 
 // Clean up old entries (prevent memory leak)
 this.cleanupThrottleMap();
 
 console.log(`✅ Event tracked: ${eventName}`, params);
 return true;
 
 } catch (error) {
 console.error('❌ Conversion tracking error:', error);
 return false;
 }
 }

 /**
 * Track paywall shown event
 * @param {string} featureName - Feature that triggered paywall
 * @param {string} userPlan - Current user plan
 * @param {string} pagePath - Current page path
 */
 trackPaywallShown(featureName, userPlan = 'unknown', pagePath = null) {
 return this.trackEvent('paywall_shown', {
 'feature_name': featureName,
 'user_plan': userPlan,
 'page_path': pagePath || window.location.pathname
 });
 }

 /**
 * Track upgrade button click
 * @param {string} source - Where the click originated (paywall_modal, pricing_page, etc.)
 * @param {string} ctaText - Text of the clicked button
 * @param {string} userPlan - Current user plan
 * @param {string} featureName - Feature context (optional)
 * @param {string} targetPlan - Target plan (optional)
 */
 trackUpgradeClicked(source, ctaText, userPlan = 'unknown', featureName = null, targetPlan = null) {
 const params = {
 'source': source,
 'cta_text': ctaText,
 'user_plan': userPlan
 };
 
 if (featureName) params.feature_name = featureName;
 if (targetPlan) params.target_plan = targetPlan;
 
 return this.trackEvent('upgrade_clicked', params);
 }

 /**
 * Track paywall dismissal
 * @param {string} featureName - Feature that triggered paywall
 * @param {string} userPlan - Current user plan
 */
 trackPaywallDismissed(featureName, userPlan = 'unknown') {
 return this.trackEvent('paywall_dismissed', {
 'feature_name': featureName,
 'user_plan': userPlan
 });
 }

 /**
 * Track demo request
 * @param {string} source - Where the request originated
 * @param {string} userPlan - Current user plan
 */
 trackDemoRequested(source, userPlan = 'unknown') {
 return this.trackEvent('demo_requested', {
 'source': source,
 'user_plan': userPlan
 });
 }

 /**
 * Track milestone reached
 * @param {string} milestoneType - Type of milestone (tasks_completed, workflows_created, etc.)
 * @param {number} milestoneValue - Value that triggered milestone
 * @param {string} userPlan - Current user plan
 */
 trackMilestoneReached(milestoneType, milestoneValue, userPlan = 'unknown') {
 return this.trackEvent('milestone_reached', {
 'milestone_type': milestoneType,
 'milestone_value': milestoneValue,
 'user_plan': userPlan
 });
 }

 /**
 * Track feature comparison view
 * @param {string} userPlan - Current user plan
 */
 trackFeatureComparisonViewed(userPlan = 'unknown') {
 return this.trackEvent('feature_comparison_viewed', {
 'user_plan': userPlan
 });
 }

 /**
 * Clean up old throttle entries to prevent memory leak
 */
 cleanupThrottleMap() {
 const now = Date.now();
 const cutoff = now - (this.throttleDelay * 5); // Keep entries for 5x throttle delay
 
 for (const [key, timestamp] of this.eventThrottleMap.entries()) {
 if (timestamp < cutoff) {
 this.eventThrottleMap.delete(key);
 }
 }
 }

 /**
 * Clear all throttled events (useful for testing)
 */
 clearThrottleMap() {
 this.eventThrottleMap.clear();
 }
}

// Create singleton instance
const conversionTracker = new ConversionTracker();

export default conversionTracker;

// Export individual methods for convenience
export const {
 trackEvent,
 trackPaywallShown,
 trackUpgradeClicked,
 trackPaywallDismissed,
 trackDemoRequested,
 trackMilestoneReached,
 trackFeatureComparisonViewed
} = conversionTracker;