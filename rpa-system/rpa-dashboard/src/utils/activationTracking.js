/**
 * Activation Tracking Utility
 * Comprehensive tracking for user activation milestones
 */

import { trackEvent } from './api';
import { createLogger } from './logger';
import supabase from './supabaseClient';

const logger = createLogger('activationTracking');

/**
 * Track activation milestone
 */
export async function trackActivationMilestone(milestone, properties = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.debug('No user found, skipping activation tracking');
      return;
    }

    // Track as analytics event
    await trackEvent({
      event_name: 'activation_milestone',
      user_id: user.id,
      properties: {
        milestone,
        timestamp: new Date().toISOString(),
        ...properties
      }
    });

    // Store in activation_events table if it exists
    try {
      await supabase.from('activation_events').insert({
        user_id: user.id,
        milestone,
        completed_at: new Date().toISOString(),
        properties: properties || {}
      });
    } catch (e) {
      // Table might not exist, that's okay
      logger.debug('activation_events table not available', { error: e });
    }

    logger.info(`Activation milestone tracked: ${milestone}`, { user_id: user.id, ...properties });
  } catch (error) {
    logger.debug('Failed to track activation milestone', { error, milestone });
  }
}

/**
 * Calculate and track time-to-activate
 */
export async function calculateTimeToActivate(activationEvent) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user signup date
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single();

    if (!profile?.created_at) return null;

    const signupDate = new Date(profile.created_at);
    const activationDate = new Date(activationEvent.timestamp || new Date());
    const timeToActivateMinutes = Math.round((activationDate - signupDate) / (1000 * 60));
    const timeToActivateHours = Math.round(timeToActivateMinutes / 60 * 100) / 100;
    const timeToActivateDays = Math.round(timeToActivateHours / 24 * 100) / 100;

    await trackEvent({
      event_name: 'time_to_activate',
      user_id: user.id,
      properties: {
        time_to_activate_minutes: timeToActivateMinutes,
        time_to_activate_hours: timeToActivateHours,
        time_to_activate_days: timeToActivateDays,
        activation_event: activationEvent.milestone || activationEvent.event_name,
        signup_date: signupDate.toISOString(),
        activation_date: activationDate.toISOString()
      }
    });

    return {
      minutes: timeToActivateMinutes,
      hours: timeToActivateHours,
      days: timeToActivateDays
    };
  } catch (error) {
    logger.debug('Failed to calculate time-to-activate', { error });
    return null;
  }
}

/**
 * Get activation status for current user
 */
export async function getActivationStatus() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { activated: false, milestones: [] };

    // Check if user has workflows (activation milestone)
    const { count: workflowCount } = await supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Check activation events
    const { data: activationEvents } = await supabase
      .from('activation_events')
      .select('milestone, completed_at, properties')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: true });

    const milestones = activationEvents || [];
    const activated = workflowCount > 0;

    return {
      activated,
      workflow_count: workflowCount || 0,
      milestones,
      time_to_activate: milestones.length > 0 ? await calculateTimeToActivate(milestones[0]) : null
    };
  } catch (error) {
    logger.debug('Failed to get activation status', { error });
    return { activated: false, milestones: [] };
  }
}
