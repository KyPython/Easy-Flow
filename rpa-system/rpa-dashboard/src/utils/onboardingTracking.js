/**
 * Onboarding Flow Tracking Utility
 * Tracks user progress through onboarding steps for analytics
 */

import { trackEvent } from './api';
import supabase from './supabaseClient';

/**
 * Track an onboarding step completion
 * @param {string} stepName - Name of the onboarding step (e.g., 'email_verified', 'first_login', 'tutorial_started', 'tutorial_completed', 'first_workflow_created')
 * @param {object} additionalProps - Additional properties to track
 */
export async function trackOnboardingStep(stepName, additionalProps = {}) {
 if (!stepName) return;

 try {
 // Get current user
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 console.debug('[onboardingTracking] No user found, skipping step tracking');
 return;
 }

 // Insert into onboarding_events table
 const { error } = await supabase.from('onboarding_events').insert({
 user_id: user.id,
 step: stepName,
 completed_at: new Date().toISOString(),
 properties: additionalProps || {}
 });

 if (error) {
 console.warn('[onboardingTracking] Failed to insert onboarding event:', error);
 }

 // Also track as analytics event
 await trackEvent({
 event_name: 'onboarding_step',
 user_id: user.id,
 properties: {
 step: stepName,
 timestamp: new Date().toISOString(),
 ...additionalProps
 }
 });
 } catch (error) {
 // Silently fail - tracking should never break the app
 console.debug('[onboardingTracking] Error tracking step:', error);
 }
}

/**
 * Get onboarding progress for current user
 * @returns {Promise<object>} Object with step names as keys and completion status as values
 */
export async function getOnboardingProgress() {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return {};

 const { data, error } = await supabase
 .from('onboarding_events')
 .select('step, completed_at')
 .eq('user_id', user.id);

 if (error) {
 console.warn('[onboardingTracking] Failed to fetch onboarding progress:', error);
 return {};
 }

 const progress = {};
 if (data) {
 data.forEach(event => {
 progress[event.step] = {
 completed: true,
 completed_at: event.completed_at
 };
 });
 }

 return progress;
 } catch (error) {
 console.debug('[onboardingTracking] Error fetching progress:', error);
 return {};
 }
}

