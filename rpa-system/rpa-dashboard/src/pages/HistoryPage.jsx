import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePlan } from '../hooks/usePlan';
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import TaskList from '../components/TaskList/TaskList';
import { useAuth } from '../utils/AuthContext';
import { supabase, initSupabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { fetchWithAuth } from '../utils/devNetLogger';
import { ApiErrorHandler } from '../utils/errorHandler';
import styles from './HistoryPage.module.css';
import ErrorMessage from '../components/ErrorMessage';
// Note: Chatbot removed - AI Agent is now available globally via toggle button
import TaskResultModal from '../components/TaskResultModal/TaskResultModal';
import { createLogger } from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';

// ✅ DYNAMIC CONFIGURATION: All values from dynamicConfig (environment-aware, non-hardcoded)
import { getConfig } from '../utils/dynamicConfig';

const HISTORY_CONFIG = {
 // API Request Timeout (from dynamic config)
 apiTimeout: getConfig('timeouts.api', 30000),
 
 // Loading Timeout (from dynamic config)
 loadingTimeout: getConfig('timeouts.loading', 60000),
 
 // Polling Interval (from dynamic config)
 pollingInterval: getConfig('intervals.polling', 10000),
 
 // Stuck Task Threshold (from dynamic config, converted from hours to ms)
 stuckTaskThresholdMs: getConfig('thresholds.stuckTaskHours', 24) * 60 * 60 * 1000,
 
 // Error Messages (environment-aware via getEnvMessage)
 errorMessages: {
 timeout: getEnvMessage({
 dev: `API request timeout after ${getConfig('timeouts.api', 30000) / 1000} seconds`,
 prod: 'The request is taking longer than expected. Please try refreshing the page.'
 }),
 loadingTimeout: getEnvMessage({
 dev: `Loading timeout after ${getConfig('timeouts.loading', 60000) / 1000} seconds`,
 prod: 'Loading is taking longer than expected. Please refresh the page or contact support if the issue persists.'
 }),
 fetchError: getEnvMessage({
 dev: 'Could not load automation history. The backend may be unavailable.',
 prod: 'Unable to load automation history. Please refresh the page or try again later.'
 })
 }
};

const HistoryPage = () => {
 const { user } = useAuth();
 const { theme } = useTheme() || { theme: 'light' };
 const logger = createLogger('HistoryPage');
 const isDevelopment = process.env.NODE_ENV === 'development';
 const isProduction = process.env.NODE_ENV === 'production';
 const loadingTimeoutRef = useRef(null);
 const [runs, setRuns] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [editingTask, setEditingTask] = useState(null);
 const [editName, setEditName] = useState('');
 const [editUrl, setEditUrl] = useState('');
 const [editError, setEditError] = useState('');
 const [viewingTaskId, setViewingTaskId] = useState(null); // Store ID instead of full object
 const [isRefreshing, setIsRefreshing] = useState(false); // Track manual refresh state
 const runsRef = useRef([]); // Store runs in ref to avoid dependency issues
 const isInitialLoad = useRef(true); // Track if this is the first load
 const fetchInProgressRef = useRef(false); // Prevent concurrent requests
 const errorHandlerRef = useRef(new ApiErrorHandler()); // Circuit breaker for API calls

 // ✅ Move fetchRuns to useCallback so it can be called from anywhere
 const fetchRuns = useCallback(async (isBackgroundRefresh = false) => {
 if (!user) return;
 
 // ✅ REQUEST DEDUPLICATION: Prevent concurrent requests
 if (fetchInProgressRef.current) {
 logger.debug('Fetch already in progress, skipping duplicate request', { user_id: user.id });
 return;
 }
 
 fetchInProgressRef.current = true;
 
 // Only show loading state on initial load, not background refreshes
 if (!isBackgroundRefresh) {
 setLoading(true);
 }
 setError('');

 // ✅ DYNAMIC: Set timeout based on environment (consumer-friendly in prod, dev-friendly in dev)
 if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
 loadingTimeoutRef.current = setTimeout(() => {
 logger.error('History fetch timeout', {
 user_id: user.id,
 timeout: HISTORY_CONFIG.loadingTimeout,
 environment: process.env.NODE_ENV
 });
 setError(HISTORY_CONFIG.errorMessages.loadingTimeout);
 setLoading(false);
 fetchInProgressRef.current = false;
 }, HISTORY_CONFIG.loadingTimeout);

 try {
 logger.info('Fetching automation runs via backend API', { user_id: user.id });
 
 // ✅ PERFORMANCE: Use backend API instead of direct Supabase query
 // Backend has better connection pooling and optimized queries
 const queryStartTime = Date.now();
 
 // Use full URL or relative path depending on environment
 const apiUrl = process.env.REACT_APP_API_BASE 
 ? `${process.env.REACT_APP_API_BASE}/api/runs`
 : '/api/runs';
 
 logger.info('Calling backend API', { 
 url: apiUrl,
 user_id: user.id 
 });
 
 // ✅ DYNAMIC: Timeout based on environment (consumer-friendly in prod, dev-friendly in dev)
 const response = await Promise.race([
 fetchWithAuth(apiUrl),
 new Promise((_, reject) => 
 setTimeout(() => reject(new Error(HISTORY_CONFIG.errorMessages.timeout)), HISTORY_CONFIG.apiTimeout)
 )
 ]);
 
 if (!response.ok) {
 const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
 throw new Error(errorData.error || `HTTP ${response.status}`);
 }
 
 const runsData = await response.json();
 const queryDuration = Date.now() - queryStartTime;
 
 logger.info('Query completed via backend API', { 
 duration_ms: queryDuration,
 runs_count: runsData?.length || 0,
 user_id: user.id 
 });
 
 // ✅ DYNAMIC: Only warn about slow responses in dev (more lenient threshold in prod)
 const slowThreshold = isProduction ? 10000 : 5000; // 10s prod, 5s dev
 if (queryDuration > slowThreshold) {
 const logLevel = isProduction ? 'warn' : 'error'; // Error in dev, warn in prod
 logger[logLevel]('Slow API response detected', {
 duration_ms: queryDuration,
 user_id: user.id,
 environment: process.env.NODE_ENV,
 message: isProduction 
 ? 'Backend API is slower than expected'
 : 'Backend API took longer than 5 seconds - check database indexes'
 });
 }
 
 const runsDataFinal = Array.isArray(runsData) ? runsData : [];
 logger.info('Automation runs fetched successfully', {
 user_id: user.id,
 count: runsDataFinal.length,
 query_duration_ms: queryDuration,
 is_background_refresh: isBackgroundRefresh
 });
 setRuns(runsDataFinal);
 runsRef.current = runsDataFinal; // Update ref
 
 // Mark initial load as complete
 if (isInitialLoad.current) {
 isInitialLoad.current = false;
 }
 } catch (err) {
 // ✅ DYNAMIC: Handle errors based on type and environment
 const isAuthError = err.message?.includes('401') || err.message?.includes('Unauthorized');
 const isNetworkError = err.message?.includes('ERR_NETWORK_IO_SUSPENDED') || err.message?.includes('Network');
 const isTimeoutError = err.message?.includes('timeout');
 
 // In development: Log all errors with details
 // In production: Only log unexpected errors (suppress expected ones)
 if (isDevelopment || (!isAuthError && !isNetworkError)) {
 logger.error('Failed to fetch automation runs', {
 error: err.message,
 error_code: err.code,
 user_id: user.id,
 error_type: isAuthError ? 'auth' : isNetworkError ? 'network' : isTimeoutError ? 'timeout' : 'unknown',
 environment: process.env.NODE_ENV,
 stack: isDevelopment ? err.stack : undefined // Only include stack in dev
 });
 } else if (isAuthError && isDevelopment) {
 // Auth errors in dev: debug level (less noisy)
 logger.debug('Authentication error (expected during session refresh)', {
 user_id: user.id,
 message: 'Will retry after token refresh'
 });
 }
 
 // ✅ DYNAMIC: User-friendly error in prod, technical error in dev
 // Don't show error for expected network issues (tab suspended, etc.)
 if (!isNetworkError || isProduction) {
 const errorMessage = getEnvMessage({
 dev: err.message || HISTORY_CONFIG.errorMessages.fetchError,
 prod: HISTORY_CONFIG.errorMessages.fetchError
 });
 setError(sanitizeErrorMessage(errorMessage));
 }
 } finally {
 if (loadingTimeoutRef.current) {
 clearTimeout(loadingTimeoutRef.current);
 loadingTimeoutRef.current = null;
 }
 // Only set loading to false if this was the initial load
 if (!isBackgroundRefresh) {
 setLoading(false);
 }
 setIsRefreshing(false);
 fetchInProgressRef.current = false; // ✅ Release lock
 }
 }, [user, logger]);

 // ✅ Real-time updates with Supabase Realtime (replaces polling)
 // Uses WebSocket subscriptions for instant updates when runs change
 const setupInProgressRef = useRef(false); // Prevent concurrent setup attempts
 useEffect(() => {
 if (!user?.id) return;
 
 // ✅ Prevent concurrent setup attempts
 if (setupInProgressRef.current) {
 logger.debug('Realtime setup already in progress, skipping', { user_id: user.id });
 return;
 }

 let channel = null;
 let client = null;
 let fallbackPollInterval = null;

 const setupRealtime = async () => {
 setupInProgressRef.current = true;
 try {
 // ✅ FAIL LOUDLY: Check if Supabase is configured before attempting real-time
 if (!isSupabaseConfigured()) {
 const configMsg = '🔥 FATAL: Supabase not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.';
 const errorDetails = {
 missing: 'REACT_APP_SUPABASE_URL and/or REACT_APP_SUPABASE_ANON_KEY',
 impact: 'Real-time updates unavailable, causing silent fallback to polling that floods the backend',
 fix: 'Set Supabase environment variables in .env.local (local) or Vercel (production)'
 };
 
 if (isDevelopment) {
 // ✅ DEVELOPMENT: Fail loudly to prevent silent fallback
 logger.error(configMsg, { user_id: user.id, ...errorDetails });
 setError(`🔥 Configuration Error: ${errorDetails.missing} is missing. Real-time features will not work. Please configure Supabase in .env.local and restart the dev server.`);
 // Don't fetch or poll - force user to fix configuration
 setupInProgressRef.current = false;
 return;
 } else {
 // Production: Show user-friendly error but still allow data fetching
 logger.error(configMsg, { user_id: user.id, ...errorDetails });
 setError('Real-time updates unavailable. Please configure Supabase environment variables.');
 await fetchRuns(false);
 setupInProgressRef.current = false;
 return; // Don't attempt real-time or polling if Supabase isn't configured
 }
 }

 // Initial load
 await fetchRuns(false);

 // Initialize Supabase client for Realtime
 client = await initSupabase();
 if (!client || typeof client.channel !== 'function') {
 logger.warn('Supabase Realtime not available, falling back to polling', { user_id: user.id });
 // Fallback: Use polling if Realtime is unavailable
 // ✅ SMART POLLING: Only poll if backend is reachable (check circuit breaker)
 const setupPolling = () => {
 fallbackPollInterval = setInterval(() => {
 // ✅ Check circuit breaker before polling - don't poll if backend is unreachable
 const circuitBreaker = errorHandlerRef.current.getCircuitBreaker('/api/runs');
 const breakerStatus = circuitBreaker.getStatus();
 
 if (breakerStatus.state === 'OPEN') {
 // Circuit breaker is open - backend is unreachable, don't poll
 logger.debug('Skipping poll - circuit breaker is OPEN (backend unreachable)', {
 user_id: user.id,
 nextAttempt: breakerStatus.nextAttempt ? new Date(breakerStatus.nextAttempt).toISOString() : null
 });
 return;
 }

 const now = Date.now();
 const hasActiveTasks = runsRef.current.some(run => {
 if (run.status !== 'queued' && run.status !== 'running' && run.status !== 'pending') {
 return false;
 }
 // ✅ DYNAMIC: Skip tasks that have been "running" longer than threshold (likely stuck)
 const startedAt = run.started_at ? new Date(run.started_at).getTime() : 0;
 const ageMs = now - startedAt;
 return ageMs < HISTORY_CONFIG.stuckTaskThresholdMs;
 });
 if (hasActiveTasks && !fetchInProgressRef.current) {
 fetchRuns(true); // Background refresh only for active tasks
 }
 }, HISTORY_CONFIG.pollingInterval);
 };
 setupPolling();
 return;
 }

 // Set auth token for Realtime connection
 try {
 const sessionRes = await client.auth.getSession();
 const session = sessionRes?.data?.session || sessionRes?.session || null;
 if (session?.access_token && client.realtime && typeof client.realtime.setAuth === 'function') {
 client.realtime.setAuth(session.access_token);
 }
 } catch (authErr) {
 logger.warn('Failed to set Realtime auth token', { error: authErr?.message });
 }

 // Subscribe to changes in automation_runs table for this user
 channel = client
 .channel(`automation_runs:user_id=eq.${user.id}`, {
 config: {
 // Enable presence for better connection management
 presence: {
 key: user.id
 }
 }
 })
 .on(
 'postgres_changes',
 {
 event: '*', // Listen to INSERT, UPDATE, DELETE
 schema: 'public',
 table: 'automation_runs',
 filter: `user_id=eq.${user.id}`
 },
 (payload) => {
 logger.info('Realtime update received', {
 event_type: payload.eventType,
 run_id: payload.new?.id || payload.old?.id,
 user_id: user.id
 });

 // Handle different event types
 if (payload.eventType === 'INSERT') {
 // New run created - fetch full data to get task details
 fetchRuns(true); // Background refresh
 
 // ✅ AUTO-SCROLL: Scroll to top when new run is added (new runs appear at top)
 setTimeout(() => {
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }, 500); // Wait for data to load
 } else if (payload.eventType === 'UPDATE') {
 // Run status or data changed - update local state efficiently
 setRuns(prev => {
 const existingIndex = prev.findIndex(r => r.id === (payload.new?.id || payload.old?.id));
 if (existingIndex >= 0) {
 // Update existing run
 const updated = [...prev];
 // Merge new data, preserving automation_tasks if not in payload
 updated[existingIndex] = {
 ...updated[existingIndex],
 ...payload.new,
 // Preserve nested task data if not in payload
 automation_tasks: payload.new?.automation_tasks || updated[existingIndex].automation_tasks
 };
 return updated;
 } else {
 // New run not in list yet - fetch full data
 fetchRuns(true);
 return prev;
 }
 });
 // Also update ref for consistency
 runsRef.current = runsRef.current.map(run => {
 if (run.id === (payload.new?.id || payload.old?.id)) {
 return { ...run, ...payload.new, automation_tasks: payload.new?.automation_tasks || run.automation_tasks };
 }
 return run;
 });
 } else if (payload.eventType === 'DELETE') {
 // Run deleted - remove from local state
 const deletedId = payload.old?.id;
 if (deletedId) {
 setRuns(prev => prev.filter(r => r.id !== deletedId));
 runsRef.current = runsRef.current.filter(r => r.id !== deletedId);
 // Close modal if viewing deleted run
 setViewingTaskId(prev => prev === deletedId ? null : prev);
 }
 }
 }
 )
 .subscribe((status) => {
 logger.info('Realtime subscription status', {
 status,
 user_id: user.id
 });
 if (status === 'SUBSCRIBED') {
 logger.info('Successfully subscribed to automation_runs changes via WebSocket', { user_id: user.id });
 } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
 // ✅ FAIL LOUDLY: Check if this is a configuration error before falling back
 const isConfigError = status === 'CHANNEL_ERROR' && (
 !isSupabaseConfigured() || 
 (typeof window !== 'undefined' && !window._supabase?.auth?.getSession)
 );
 
 if (isConfigError && isDevelopment) {
 // ✅ DEVELOPMENT: Fail loudly for configuration errors
 const errorMsg = '🔥 FATAL: Real-time connection failed due to configuration error. Check Supabase configuration.';
 logger.error(errorMsg, {
 status,
 user_id: user.id,
 supabase_configured: isSupabaseConfigured(),
 note: 'This prevents silent fallback to polling. Fix configuration to resolve.'
 });
 setError('🔥 Real-time connection failed. Please check Supabase configuration in .env.local and restart the dev server.');
 // Don't fall back to polling - force configuration fix
 return;
 }
 
 // ✅ DYNAMIC: Less noisy in dev (expected behavior), more visible in prod
 if (isProduction) {
 logger.warn('Realtime subscription error, falling back to polling', {
 status,
 user_id: user.id
 });
 } else {
 // In dev: warn level for non-config errors (transient disconnects are expected)
 logger.warn('Realtime subscription temporarily disconnected', {
 status,
 user_id: user.id,
 note: 'Will reconnect automatically. If this persists, check Supabase configuration.'
 });
 }
 // Fallback to polling if Realtime fails (only for non-config errors)
 // ✅ Ensure only one polling interval exists
 if (fallbackPollInterval) {
 clearInterval(fallbackPollInterval);
 }
 // ✅ SMART POLLING: Only poll if backend is reachable (check circuit breaker)
 const setupPolling = () => {
 fallbackPollInterval = setInterval(() => {
 // ✅ Check circuit breaker before polling - don't poll if backend is unreachable
 const circuitBreaker = errorHandlerRef.current.getCircuitBreaker('/api/runs');
 const breakerStatus = circuitBreaker.getStatus();
 
 if (breakerStatus.state === 'OPEN') {
 // Circuit breaker is open - backend is unreachable, don't poll
 logger.debug('Skipping poll - circuit breaker is OPEN (backend unreachable)', {
 user_id: user.id,
 nextAttempt: breakerStatus.nextAttempt ? new Date(breakerStatus.nextAttempt).toISOString() : null
 });
 return;
 }

 const now = Date.now();
 const hasActiveTasks = runsRef.current.some(run => {
 if (run.status !== 'queued' && run.status !== 'running' && run.status !== 'pending') {
 return false;
 }
 // ✅ DYNAMIC: Skip tasks that have been "running" longer than threshold (likely stuck)
 const startedAt = run.started_at ? new Date(run.started_at).getTime() : 0;
 const ageMs = now - startedAt;
 return ageMs < HISTORY_CONFIG.stuckTaskThresholdMs;
 });
 if (hasActiveTasks && !fetchInProgressRef.current) {
 fetchRuns(true);
 }
 }, HISTORY_CONFIG.pollingInterval);
 };
 setupPolling();
 }
 });
 } catch (err) {
 // ✅ DYNAMIC: Error level in prod, warn in dev (Realtime failures are common in dev)
 const logLevel = isProduction ? 'error' : 'warn';
 logger[logLevel]('Failed to setup Realtime subscription', {
 error: err.message,
 user_id: user.id,
 environment: process.env.NODE_ENV,
 note: isDevelopment ? 'Falling back to polling (expected in dev)' : 'Falling back to polling',
 stack: isDevelopment ? err.stack : undefined // Only include stack in dev
 });
 // Fallback: only fetch initial data if we haven't already loaded it
 // (Prevent repeated initial loads when real-time fails)
 if (runsRef.current.length === 0) {
 fetchRuns(false);
 } else {
 logger.debug('Skipping initial fetch - data already loaded', { user_id: user.id });
 }
 // Also set up polling as fallback (only if Supabase is configured)
 if (isSupabaseConfigured()) {
 // ✅ Ensure only one polling interval exists
 if (fallbackPollInterval) {
 clearInterval(fallbackPollInterval);
 }
 // ✅ SMART POLLING: Only poll if backend is reachable (check circuit breaker)
 const setupPolling = () => {
 fallbackPollInterval = setInterval(() => {
 // ✅ Check circuit breaker before polling - don't poll if backend is unreachable
 const circuitBreaker = errorHandlerRef.current.getCircuitBreaker('/api/runs');
 const breakerStatus = circuitBreaker.getStatus();
 
 if (breakerStatus.state === 'OPEN') {
 // Circuit breaker is open - backend is unreachable, don't poll
 logger.debug('Skipping poll - circuit breaker is OPEN (backend unreachable)', {
 user_id: user.id,
 nextAttempt: breakerStatus.nextAttempt ? new Date(breakerStatus.nextAttempt).toISOString() : null
 });
 return;
 }

 const now = Date.now();
 const hasActiveTasks = runsRef.current.some(run => {
 if (run.status !== 'queued' && run.status !== 'running' && run.status !== 'pending') {
 return false;
 }
 // ✅ DYNAMIC: Skip tasks that have been "running" longer than threshold (likely stuck)
 const startedAt = run.started_at ? new Date(run.started_at).getTime() : 0;
 const ageMs = now - startedAt;
 return ageMs < HISTORY_CONFIG.stuckTaskThresholdMs;
 });
 if (hasActiveTasks && !fetchInProgressRef.current) {
 fetchRuns(true);
 }
 }, HISTORY_CONFIG.pollingInterval);
 };
 setupPolling();
 } else {
 // Supabase not configured - don't poll, just show error
 if (isProduction) {
 setError('Real-time updates unavailable. Please configure Supabase environment variables.');
 }
 }
 }
 };

 setupRealtime();

 // Cleanup: unsubscribe from Realtime channel and clear polling
 return () => {
 setupInProgressRef.current = false; // Reset setup flag on cleanup
 if (fallbackPollInterval) {
 clearInterval(fallbackPollInterval);
 }
 if (channel && client) {
 try {
 client.removeChannel(channel);
 logger.info('Realtime channel unsubscribed', { user_id: user.id });
 } catch (err) {
 logger.warn('Error removing Realtime channel', { error: err?.message });
 }
 }
 };
 }, [user?.id]); // ✅ Removed fetchRuns from deps to prevent re-initialization loops

 // ✅ Manual refresh handler
 const handleManualRefresh = useCallback(() => {
 setIsRefreshing(true);
 fetchRuns(false); // Force refresh with loading state
 }, [fetchRuns]);

 const handleViewTask = (task) => {
 // Store task ID instead of full object to ensure modal gets latest data
 setViewingTaskId(task.id);
 };

 // ✅ Handle modal close with refresh
 const handleModalClose = useCallback(() => {
 setViewingTaskId(null);
 // Trigger refresh when modal closes to ensure list is up-to-date
 fetchRuns(true); // Background refresh - no loading state
 }, [fetchRuns]);
 
 // Get the latest task data from runs when modal is open
 const viewingTask = viewingTaskId 
 ? runs.find(run => run.id === viewingTaskId) || null
 : null;
 
 // Update viewingTaskId if the task is deleted or no longer exists
 useEffect(() => {
 if (viewingTaskId && !viewingTask) {
 // Task was deleted or no longer exists, close modal
 setViewingTaskId(null);
 }
 }, [viewingTaskId, viewingTask]);

 const handleEditTask = (task) => {
 setEditingTask(task);
 // Correctly access nested properties from the Supabase query
 setEditName(task.automation_tasks?.name || 'Unnamed Task');
 setEditUrl(task.automation_tasks?.url || '#');
 setEditError('');
 };

 const handleEditSubmit = async (e) => {
 e.preventDefault();
 if (!editName || !editUrl) { setEditError('Task Name and URL are required.'); return; }

 const taskId = editingTask.automation_tasks?.id;
 if (!taskId) {
 setEditError('Could not find the associated task to update.');
 return;
 }

 try {
 const client = await initSupabase();
 const { data, error: updateError } = await client
 .from('automation_tasks')
 .update({ name: editName, url: editUrl })
 .eq('id', taskId)
 .select()
 .single();

 if (updateError) throw updateError;

 // Update the local state to reflect the change across all runs for this task
 setRuns(prev => prev.map(run => {
 if (run.automation_tasks?.id === taskId) {
 return { ...run, automation_tasks: data };
 }
 return run;
 }));
 setEditingTask(null);
 } catch (err) {
 logger.error('Error updating task', {
 error: err.message,
 task_id: editingTask.id,
 user_id: user.id,
 stack: err.stack
 });
 setEditError('Failed to update the task. Please try again.');
 }
 };

 // ✅ Use backend API for delete (better security and consistency)
 const handleDeleteTask = async (runId) => {
 const runToDelete = runs.find(r => r.id === runId);
 if (!runToDelete) return; // Should not happen, but good practice

 const taskName = runToDelete.automation_tasks?.name || 'the selected run';

 if (window.confirm(`Are you sure you want to delete the run for "${taskName}"? This action cannot be undone.`)) {
 try {
 // Use backend API endpoint for delete
 const apiUrl = process.env.REACT_APP_API_BASE 
 ? `${process.env.REACT_APP_API_BASE}/api/runs/${runId}`
 : `/api/runs/${runId}`;
 
 const response = await fetchWithAuth(apiUrl, {
 method: 'DELETE'
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
 throw new Error(errorData.error || `HTTP ${response.status}`);
 }

 // Optimistically remove from local state (Realtime will also update, but this is faster)
 setRuns(prev => prev.filter(r => r.id !== runId));
 runsRef.current = runsRef.current.filter(r => r.id !== runId);
 
 // Close modal if viewing deleted run
 if (viewingTaskId === runId) {
 setViewingTaskId(null);
 }

 logger.info('Run deleted successfully', {
 run_id: runId,
 user_id: user.id
 });
 } catch (err) {
 logger.error('Error deleting run', {
 error: err.message || err,
 run_id: runId,
 user_id: user.id,
 stack: err.stack
 });
 setError(sanitizeErrorMessage(err) || getEnvMessage({
 dev: 'Failed to delete the run: ' + (err.message || 'Unknown error'),
 prod: 'Failed to delete the run. Please try again.'
 }));
 }
 }
 };

 const { t } = useI18n();

 if (loading) return <div className={styles.container} data-theme={theme}><p>{t('history.loading','Loading automation history...')}</p></div>;


 return (
 <div className={styles.container} data-theme={theme}>
 <ErrorMessage message={error} />

 {/* ✅ Refresh button and header */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginBottom: '24px',
 gap: '16px'
 }}>
 <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
 {t('history.title', 'Automation History')}
 </h1>
 <button
 onClick={handleManualRefresh}
 disabled={isRefreshing || loading}
 className={styles.refreshButton}
 title="Refresh automation history"
 >
 {isRefreshing ? '⟳' : '↻'} {isRefreshing ? 'Refreshing...' : 'Refresh'}
 </button>
 </div>

 {/* Step-by-step guidance banner */}
 <div style={{
 marginBottom: '24px',
 padding: '16px',
 background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
 borderRadius: '8px',
 color: 'white'
 }}>
 <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
 📍 Your Automation Journey
 </h3>
 <div style={{ fontSize: '14px', lineHeight: '1.6', opacity: 0.95 }}>
 <strong>Step 1:</strong> Submit tasks from <strong>Task Management</strong> -> 
 <strong>Step 2:</strong> Track progress here in <strong>Automation History</strong> -> 
 <strong>Step 3:</strong> View results by clicking 👁️ -> 
 <strong>Step 4:</strong> Download files or find them in <strong>Files</strong> page
 </div>
 </div>

 {runs.length === 0 && !error ? (
 <div className={styles.emptyState}>
 <div className={styles.emptyIcon}>📊</div>
 <h3>{t('history.empty_title','No Automation History')}</h3>
 <p>{t('history.empty_message','Your automation runs will appear here once you start executing tasks.')}</p>
 <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
 💡 <strong>Get started:</strong> Go to <strong>Task Management</strong> to create your first automation task.
 </p>
 </div>
 ) : (
 <TaskList tasks={runs} onView={handleViewTask} onEdit={handleEditTask} onDelete={handleDeleteTask} />
 )}

 {editingTask && (
 <div 
 className={styles.modalBackdrop}
 onClick={(e) => {
 // Close modal when clicking backdrop
 if (e.target === e.currentTarget) {
 setEditingTask(null);
 }
 }}
 >
 <div className={styles.modal}>
 <div className={styles.modalHeader}>
 <h3>{t('history.edit_task','Edit Task')}</h3>
 <button 
 className={styles.modalCloseButton}
 onClick={() => setEditingTask(null)}
 aria-label="Close"
 >
 ×
 </button>
 </div>
 <form onSubmit={handleEditSubmit} className={styles.modalForm}>
 {editError && <div className={styles.formError}>{editError}</div>}
 <div className={styles.formGroup}>
 <label htmlFor="edit-task-name" className={styles.formLabel}>
 {t('history.task_name','Task Name')}
 </label>
 <input
 id="edit-task-name"
 name="task_name"
 type="text"
 value={editName}
 onChange={e => setEditName(e.target.value)}
 className={styles.input}
 required
 autoComplete="off"
 placeholder={t('history.task_name_placeholder','Enter task name')}
 />
 </div>
 <div className={styles.formGroup}>
 <label htmlFor="edit-task-url" className={styles.formLabel}>
 {t('history.task_url','Task URL')}
 </label>
 <input
 id="edit-task-url"
 name="task_url"
 type="url"
 value={editUrl}
 onChange={e => setEditUrl(e.target.value)}
 className={styles.input}
 required
 autoComplete="url"
 placeholder={t('history.task_url_placeholder','https://example.com')}
 />
 </div>
 <div className={styles.modalActions}>
 <button type="submit" className={styles.submitButton}>
 {t('action.save','Save')}
 </button>
 <button 
 type="button" 
 className={styles.cancelButton} 
 onClick={() => setEditingTask(null)}
 >
 {t('action.cancel','Cancel')}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {viewingTask && (
 <TaskResultModal
 task={viewingTask}
 onClose={handleModalClose}
 />
 )}
 </div>
 );
};

export default HistoryPage;
