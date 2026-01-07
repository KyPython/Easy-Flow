import { useState, useEffect, useCallback } from 'react';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { buildApiUrl } from '../utils/config';
import { api } from '../utils/api';

// UUID validation regex (matches Supabase UUID format)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate workflowId is a valid UUID or special case "new"
const isValidWorkflowId = (id) => {
 if (!id) return false;
 // Allow "new" as a special case for creating new workflows
 if (id === 'new') return true;
 return uuidRegex.test(id);
};

export const useWorkflowExecutions = (workflowId) => {
 const [executions, setExecutions] = useState([]);
 const [stats, setStats] = useState({
 total: 0,
 completed: 0,
 failed: 0,
 running: 0,
 cancelled: 0
 });
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 // Load executions for the workflow
 const loadExecutions = useCallback(async () => {
 if (!workflowId || !isValidWorkflowId(workflowId)) {
 setExecutions([]);
 setStats({ total: 0, completed: 0, failed: 0, running: 0, cancelled: 0 });
 setLoading(false);
 if (workflowId && !isValidWorkflowId(workflowId)) {
 console.warn(`[useWorkflowExecutions] Invalid workflowId format: "${workflowId}". Expected UUID format.`);
 setError(`Invalid workflow ID format: "${workflowId}"`);
 }
 return;
 }

 try {
 setLoading(true);
 setError(null);
 // Ensure the real Supabase client is initialized before calling DB methods
 const client = await initSupabase();
 // ✅ PERFORMANCE: Optimized list query - only fetch fields needed for list display
 // Excluded fields:
 // - input_data, output_data: Large JSON payloads, fetched on-demand via getExecutionDetails()
 // - error_step_id: Not displayed in list view (only in detail modal)
 // - trigger_data: Not displayed in list view (only triggered_by is shown)
 // - created_at: Not displayed in list view (started_at is used instead)
 // 
 // This reduces bandwidth, improves UI rendering speed, and reduces memory usage
 const { data, error: fetchError } = await client
 .from('workflow_executions')
 .select(`
 id,
 execution_number,
 status,
 started_at,
 completed_at,
 duration_seconds,
 error_message,
 triggered_by,
 steps_executed,
 steps_total
 `)
 .eq('workflow_id', workflowId)
 .order('started_at', { ascending: false })
 .limit(100);

 if (fetchError) throw fetchError;

 setExecutions(data || []);

 // Helper to detect false "completed" status (0 steps executed = actually failed)
 const getActualStatus = (execution) => {
 if (execution.status === 'completed' && 
 execution.steps_total > 0 && 
 (execution.steps_executed === 0 || !execution.steps_executed)) {
 return 'failed';
 }
 return execution.status;
 };

 // Calculate stats (treat false "completed" as failed)
 const newStats = {
 total: data?.length || 0,
 completed: data?.filter(e => {
 const actual = getActualStatus(e);
 return actual === 'completed';
 }).length || 0,
 failed: data?.filter(e => {
 const actual = getActualStatus(e);
 return actual === 'failed';
 }).length || 0,
 running: data?.filter(e => e.status === 'running').length || 0,
 cancelled: data?.filter(e => e.status === 'cancelled').length || 0
 };
 setStats(newStats);

 } catch (err) {
 console.error('Error loading executions:', err);
 setError(err.message);
 } finally {
 setLoading(false);
 }
 }, [workflowId]);

 // ✅ PERFORMANCE: Separate optimized query for detail view
 // This fetches complete execution data including large JSON fields (input_data, output_data)
 // and all step execution details. Only called when user clicks to view execution details.
 // 
 // Why separate from list query?
 // - List query excludes large fields (input_data, output_data) for faster rendering
 // - Detail query fetches everything needed for the detail modal
 // - Reduces initial load time while ensuring detail view has all data
 const getExecutionDetails = async (executionId) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;
 
 // Try API endpoint first (includes authentication and authorization checks)
 if (token) {
 try {
 const { data: executionData } = await api.get(buildApiUrl(`/api/executions/${executionId}`));
 if (executionData?.execution) {
 return executionData.execution;
 }
 if (executionData) {
 return executionData;
 }
 } catch (apiError) {
 // If API fails, fall back to direct Supabase query
 console.warn('[getExecutionDetails] API call failed, falling back to direct query:', apiError?.message);
 }
 }
 
 // Fallback to direct Supabase query if API fails or no token
 // ✅ DETAIL VIEW: Explicitly select all fields needed for detail modal
 // Includes large JSON fields (input_data, output_data) and complete step execution data
 const fallbackClient = await initSupabase();
 const { data: execution, error: execError } = await fallbackClient
 .from('workflow_executions')
 .select(`
 id,
 execution_number,
 workflow_id,
 user_id,
 status,
 started_at,
 completed_at,
 duration_seconds,
 error_message,
 error_step_id,
 error_category,
 triggered_by,
 trigger_data,
 input_data,
 output_data,
 steps_executed,
 steps_total,
 created_at,
 updated_at,
 metadata,
 step_executions(
 id,
 step_id,
 workflow_execution_id,
 execution_order,
 status,
 started_at,
 completed_at,
 duration_ms,
 input_data,
 output_data,
 result,
 error_message,
 retry_count,
 workflow_steps(
 id,
 step_key,
 name,
 step_type,
 action_type,
 workflow_id
 )
 )
 `)
 .eq('id', executionId)
 .single();
 
 if (execError) throw execError;
 return execution;
 } catch (err) {
 console.error('[getExecutionDetails] Error loading execution details:', err);
 throw err;
 }
 };

 // Start a new workflow execution
 const startExecution = async (inputData = {}, retryCount = 0, executionMode = null) => {
 if (!workflowId || !isValidWorkflowId(workflowId)) {
 throw new Error(`Invalid workflow ID: "${workflowId}"`);
 }
 
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 const response = await api.post(buildApiUrl('/api/workflows/execute'), {
 workflowId,
 inputData,
 triggeredBy: 'manual',
 executionMode // ✅ EXECUTION MODES: Pass execution mode to backend
 });
 
 const result = response.data || response;
 
 // ✅ UX: Parse and enhance error messages for better user experience
 if (result.error) {
 const errorMessage = result.error;
 const errorCode = result.code || '';
 
 // ✅ UX: Auto-retry for Firebase token blocking errors (backend safety check)
 // This happens when workflow execution is triggered too soon after Firebase token request
 // We automatically retry once after a short delay to improve UX
 if ((errorMessage.includes('Firebase token request') || errorCode === 'INVALID_TRIGGER_SOURCE') && retryCount === 0) {
 const timeSinceFirebaseToken = result.time_since_firebase_token_ms || 0;
 // Backend blocks for 500ms, so wait until 600ms total have passed to ensure we're past the blocking window
 // Add 100ms buffer to account for timing variations
 const waitTime = Math.max(100, 600 - timeSinceFirebaseToken); // Wait at least 100ms, or until 600ms total has passed
 
 console.log(`⏳ Workflow execution blocked by Firebase token check (${timeSinceFirebaseToken}ms since token). Auto-retrying in ${waitTime}ms...`);
 
 // Wait and retry once
 await new Promise(resolve => setTimeout(resolve, waitTime));
 return startExecution(inputData, retryCount + 1);
 }
 
 let enhancedError = new Error(errorMessage);
 
 // Map common backend errors to user-friendly messages
 if (errorMessage.includes('No start step') || errorMessage.includes('start step')) {
 enhancedError = new Error('🚀 Your workflow needs a Start step!\n\n👉 Click the "🎬 Start" button in the Actions toolbar, then connect it to your first action step.');
 } else if (errorMessage.includes('Automation service is not configured')) {
 enhancedError = new Error('⚠️ Automation service is not available. Please contact support.');
 } else if (errorMessage.includes('Workflow not found')) {
 enhancedError = new Error('💡 Save your workflow first, then you can run it!');
 } else if (errorMessage.includes('not active') || errorMessage.includes('paused')) {
 enhancedError = new Error('⏸️ Activate your workflow before running it.');
 } else if (errorMessage.includes('Firebase token request') || errorCode === 'INVALID_TRIGGER_SOURCE') {
 // ✅ UX: If retry failed, show user-friendly message
 enhancedError = new Error('⏳ System is initializing. Please try again in a moment.');
 }
 
 enhancedError.status = response.status || 500;
 throw enhancedError;
 }
 
 // Refresh executions to include the new one
 await loadExecutions();
 
 return result;
 } catch (err) {
 // ✅ UX: Check if this is the Firebase token blocking error from axios
 if (err?.response?.data?.code === 'INVALID_TRIGGER_SOURCE' && retryCount === 0) {
 const timeSinceFirebaseToken = err.response.data.time_since_firebase_token_ms || 0;
 // Backend blocks for 7 seconds, so wait until 8 seconds total have passed to ensure we're past the blocking window
 // Add 500ms buffer to account for timing variations
 const waitTime = Math.max(2000, 8500 - timeSinceFirebaseToken); // Wait at least 2s, or until 8.5s total has passed
 
 console.log(`⏳ Workflow execution blocked by Firebase token check (${timeSinceFirebaseToken}ms since token). Auto-retrying in ${waitTime}ms...`);
 
 // Wait and retry once
 await new Promise(resolve => setTimeout(resolve, waitTime));
 return startExecution(inputData, retryCount + 1);
 }
 
 console.error('Error starting execution:', err);
 // ✅ UX: Preserve enhanced error messages
 throw err;
 }
 };

 // Cancel a running execution
 const cancelExecution = async (executionId) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 if (!session?.session?.access_token) {
 throw new Error('Not authenticated');
 }

 await api.post(buildApiUrl(`/api/executions/${executionId}/cancel`));

 // Update the execution status locally
 setExecutions(prev => 
 prev.map(execution =>
 execution.id === executionId
 ? { ...execution, status: 'cancelled' }
 : execution
 )
 );

 // Update stats
 setStats(prev => ({
 ...prev,
 running: Math.max(0, prev.running - 1),
 cancelled: prev.cancelled + 1
 }));

 return true;
 } catch (err) {
 console.error('Error cancelling execution:', err);
 throw err;
 }
 };

 // Retry a failed execution
 const retryExecution = async (executionId) => {
 try {
 // ✅ PERFORMANCE: Fetch full execution details to get input_data
 // List view no longer includes input_data, so we fetch it on-demand for retry
 const originalExecution = await getExecutionDetails(executionId);
 if (!originalExecution) {
 throw new Error('Execution not found');
 }

 // Start a new execution with the same input data
 return await startExecution(originalExecution.input_data || {});
 } catch (err) {
 console.error('Error retrying execution:', err);
 throw err;
 }
 };

 // Get execution logs
 const getExecutionLogs = async (executionId) => {
 try {
 const client = await initSupabase();
 const { data: session } = await client.auth.getSession();
 const token = session?.session?.access_token;
 if (token) {
 const { data: stepsData } = await api.get(buildApiUrl(`/api/executions/${executionId}/steps`));
 if (stepsData) return stepsData.steps || stepsData || [];
 }
 // Fallback to direct Supabase if REST fails - prefer concrete client
 const client2 = await initSupabase();
 const { data, error } = await client2
 .from('step_executions')
 .select(`
 id,
 execution_order,
 status,
 started_at,
 completed_at,
 duration_ms,
 retry_count,
 error_message,
 result,
 workflow_steps(
 step_key,
 name,
 step_type,
 action_type
 )
 `)
 .eq('workflow_execution_id', executionId)
 .order('execution_order', { ascending: true });
 if (error) throw error;
 return data || [];
 } catch (err) {
 console.error('Error loading execution logs:', err);
 throw err;
 }
 };

 // Export executions data
 const exportExecutions = async (format = 'json', filters = {}) => {
 try {
 let filteredExecutions = executions;

 // Apply filters
 if (filters.status && filters.status !== 'all') {
 filteredExecutions = filteredExecutions.filter(e => e.status === filters.status);
 }

 if (filters.dateFrom) {
 filteredExecutions = filteredExecutions.filter(
 e => new Date(e.started_at) >= new Date(filters.dateFrom)
 );
 }

 if (filters.dateTo) {
 filteredExecutions = filteredExecutions.filter(
 e => new Date(e.started_at) <= new Date(filters.dateTo)
 );
 }

 if (format === 'json') {
 const dataStr = JSON.stringify(filteredExecutions, null, 2);
 const dataBlob = new Blob([dataStr], { type: 'application/json' });
 const url = URL.createObjectURL(dataBlob);
 
 const link = document.createElement('a');
 link.href = url;
 link.download = `workflow-executions-${workflowId}-${new Date().toISOString().split('T')[0]}.json`;
 link.click();
 
 URL.revokeObjectURL(url);
 } else if (format === 'csv') {
 const csvHeader = [
 'Execution Number',
 'Status',
 'Started At',
 'Completed At',
 'Duration (seconds)',
 'Steps Executed',
 'Steps Total',
 'Triggered By',
 'Error Message'
 ].join(',');

 const csvRows = filteredExecutions.map(execution => [
 execution.execution_number,
 execution.status,
 execution.started_at,
 execution.completed_at || '',
 execution.duration_seconds || '',
 execution.steps_executed || 0,
 execution.steps_total || 0,
 execution.triggered_by || '',
 execution.error_message ? `"${execution.error_message.replace(/"/g, '""')}"` : ''
 ].join(','));

 const csvContent = [csvHeader, ...csvRows].join('\n');
 const dataBlob = new Blob([csvContent], { type: 'text/csv' });
 const url = URL.createObjectURL(dataBlob);
 
 const link = document.createElement('a');
 link.href = url;
 link.download = `workflow-executions-${workflowId}-${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 
 URL.revokeObjectURL(url);
 }

 return true;
 } catch (err) {
 console.error('Error exporting executions:', err);
 throw err;
 }
 };

 // Refresh executions
 const refreshExecutions = useCallback(() => {
 loadExecutions();
 }, [loadExecutions]);

 // Load executions on mount or when workflowId changes
 useEffect(() => {
 loadExecutions();
 }, [loadExecutions]);

 // Set up real-time subscription for execution updates
 useEffect(() => {
 if (!workflowId || !isValidWorkflowId(workflowId)) return;

 let subscription = null;
 (async () => {
 try {
 const client = await initSupabase();
 subscription = client
 .channel('workflow_executions')
 .on(
 'postgres_changes',
 {
 event: '*',
 schema: 'public',
 table: 'workflow_executions',
 filter: `workflow_id=eq.${workflowId}`
 },
 (payload) => {
 console.log('Execution change detected:', payload);
 
 switch (payload.eventType) {
 case 'INSERT':
 setExecutions(prev => [payload.new, ...prev]);
 setStats(prev => ({
 ...prev,
 total: prev.total + 1,
 [payload.new.status]: (prev[payload.new.status] || 0) + 1
 }));
 break;
 
 case 'UPDATE':
 setExecutions(prev =>
 prev.map(execution =>
 execution.id === payload.new.id ? payload.new : execution
 )
 );
 
 // Recalculate stats when status changes
 if (payload.old.status !== payload.new.status) {
 setStats(prev => ({
 ...prev,
 [payload.old.status]: Math.max(0, (prev[payload.old.status] || 0) - 1),
 [payload.new.status]: (prev[payload.new.status] || 0) + 1
 }));
 }
 break;
 
 case 'DELETE':
 setExecutions(prev =>
 prev.filter(execution => execution.id !== payload.old.id)
 );
 setStats(prev => ({
 ...prev,
 total: Math.max(0, prev.total - 1),
 [payload.old.status]: Math.max(0, (prev[payload.old.status] || 0) - 1)
 }));
 break;
 
 default:
 break;
 }
 }
 )
 .subscribe();
 } catch (err) {
 console.warn('[useWorkflowExecutions] realtime init failed', err);
 }
 })();

 return () => {
 try { if (subscription && subscription.unsubscribe) subscription.unsubscribe(); } catch (e) {}
 };
 }, [workflowId]);

 return {
 executions,
 stats,
 loading,
 error,
 refreshExecutions,
 getExecutionDetails,
 startExecution,
 cancelExecution,
 retryExecution,
 getExecutionLogs,
 exportExecutions,
 loadExecutions
 };
};