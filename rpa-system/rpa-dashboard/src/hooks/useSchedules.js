import { useState, useEffect, useCallback } from 'react';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { buildApiUrl } from '../utils/config';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';
const logger = createLogger('useSchedules');

export const useSchedules = (workflowId) => {
 const [schedules, setSchedules] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 // Load schedules for the workflow
 const loadSchedules = useCallback(async () => {
 if (!workflowId) {
 setSchedules([]);
 setLoading(false);
 return;
 }

 try {
 setLoading(true);
 setError(null);

 // Ensure real client initialized and get session token
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const { data } = await api.get(buildApiUrl('/api/schedules'));
 
 // Filter schedules for this workflow
 // Handle case where data might be undefined or null
 if (data && Array.isArray(data)) {
 const workflowSchedules = data.filter(
 schedule => schedule.workflow_id === workflowId
 );
 setSchedules(workflowSchedules);
 } else {
 // If data is not an array, set empty array
 setSchedules([]);
 }
 } catch (err) {
 logger.error('Error loading schedules:', err);
 // Check for 403 (plan restriction), 401 (auth), or 429 (rate limit) errors
 // Handle both axios errors (err.response) and direct status codes
 const status = err.response?.status || err.status || 
 (err.message?.includes('403') ? 403 : 
 err.message?.includes('429') ? 429 : 
 err.message?.includes('401') ? 401 : null);
 const is403 = status === 403 || err.message?.includes('403') || err.message?.includes('status code 403');
 const is401 = status === 401 || err.message?.includes('401') || err.message?.includes('status code 401');
 const is429 = status === 429 || err.message?.includes('429') || err.message?.includes('status code 429') || err.message?.includes('rate limit');
 
 if (is429) {
 setError({
 type: 'rate_limit',
 message: 'Rate limit exceeded. The service is temporarily busy. Please wait a moment and try again.'
 });
 } else if (is403) {
 setError({
 type: 'plan_restriction',
 message: 'Scheduled automations are not available on your current plan. Please upgrade to access this feature.'
 });
 } else if (is401) {
 setError({
 type: 'auth',
 message: 'Please sign in to view schedules.'
 });
 } else {
 setError({
 type: 'generic',
 message: err.message || 'Failed to load schedules'
 });
 }
 } finally {
 setLoading(false);
 }
 }, [workflowId]);

 // Create new schedule
 const createSchedule = async (scheduleData) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const { data: result } = await api.post(buildApiUrl('/api/schedules'), {
 workflowId: scheduleData.workflowId,
 name: scheduleData.name,
 scheduleType: scheduleData.scheduleType,
 cronExpression: scheduleData.cronExpression,
 intervalSeconds: scheduleData.intervalSeconds,
 timezone: scheduleData.timezone,
 maxExecutions: scheduleData.maxExecutions,
 webhookSecret: scheduleData.webhookSecret
 });
 
 // Add the new schedule to the list
 setSchedules(prev => [result.schedule, ...prev]);
 
 return result.schedule;
 } catch (err) {
 logger.error('Error creating schedule:', err);
 throw err;
 }
 };

 // Update existing schedule
 const updateSchedule = async (scheduleId, updates) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const { data: result } = await api.put(buildApiUrl(`/api/schedules/${scheduleId}`), updates);
 
 // Update the schedule in the list
 setSchedules(prev => 
 prev.map(schedule => 
 schedule.id === scheduleId ? result.schedule : schedule
 )
 );
 
 return result.schedule;
 } catch (err) {
 logger.error('Error updating schedule:', err);
 throw err;
 }
 };

 // Delete schedule
 const deleteSchedule = async (scheduleId) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 await api.delete(buildApiUrl(`/api/schedules/${scheduleId}`));

 // Remove the schedule from the list
 setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
 
 return true;
 } catch (err) {
 logger.error('Error deleting schedule:', err);
 throw err;
 }
 };

 // Trigger schedule manually
 const triggerSchedule = async (scheduleId) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const { data: result } = await api.post(buildApiUrl(`/api/schedules/${scheduleId}/trigger`));
 return result;
 } catch (err) {
 logger.error('Error triggering schedule:', err);
 throw err;
 }
 };

 // Get execution history for a schedule
 const getScheduleExecutions = async (scheduleId, limit = 50, offset = 0) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const { data: result } = await api.get(buildApiUrl(`/api/schedules/${scheduleId}/executions?limit=${limit}&offset=${offset}`));
 return result.executions;
 } catch (err) {
 logger.error('Error fetching schedule executions:', err);
 throw err;
 }
 };

 // Enable/disable schedule
 const toggleSchedule = async (scheduleId, isActive) => {
 try {
 await updateSchedule(scheduleId, { isActive });
 return true;
 } catch (err) {
 logger.error('Error toggling schedule:', err);
 throw err;
 }
 };

 // Refresh schedules (useful for real-time updates)
 const refreshSchedules = useCallback(() => {
 loadSchedules();
 }, [loadSchedules]);

 // Load schedules on mount or when workflowId changes
 useEffect(() => {
 loadSchedules();
 }, [loadSchedules]);

 // Set up real-time subscription for schedule changes
 useEffect(() => {
 if (!workflowId) return;
 let subscription = null;
 (async () => {
 try {
 const client = await initSupabase();
 logger.info('useSchedules creating realtime channel for workflow', workflowId);
 subscription = client
 .channel('workflow_schedules')
 .on(
 'postgres_changes',
 {
 event: '*',
 schema: 'public',
 table: 'workflow_schedules',
 filter: `workflow_id=eq.${workflowId}`
 },
 (payload) => {
 logger.info('useSchedules Schedule change payload:', payload);
 switch (payload.eventType) {
 case 'INSERT':
 setSchedules(prev => [payload.new, ...prev]);
 break;
 case 'UPDATE':
 setSchedules(prev =>
 prev.map(schedule =>
 schedule.id === payload.new.id ? payload.new : schedule
 )
 );
 break;
 case 'DELETE':
 setSchedules(prev =>
 prev.filter(schedule => schedule.id !== payload.old.id)
 );
 break;
 default:
 break;
 }
 }
 );

 try {
 const sub = subscription.subscribe((status) => {
 logger.info('useSchedules realtime subscription status', status);
 });
 logger.info('useSchedules subscribe() called for workflow_schedules', sub || subscription);
 } catch (sErr) {
 logger.warn('useSchedules subscribe call failed', sErr && sErr.message ? sErr.message : sErr);
 }
 } catch (err) {
 logger.warn('useSchedules realtime init failed', err);
 }
 })();

	return () => {
		try {
			if (subscription && subscription.unsubscribe) subscription.unsubscribe();
		} catch (err) {
			// eslint-disable-next-line no-console
			logger.debug('useSchedules unsubscribe failed', err && (err.message || err));
		}
	};
 }, [workflowId]);

 return {
 schedules,
 loading,
 error,
 createSchedule,
 updateSchedule,
 deleteSchedule,
 triggerSchedule,
 getScheduleExecutions,
 toggleSchedule,
 refreshSchedules,
 loadSchedules
 };
};
