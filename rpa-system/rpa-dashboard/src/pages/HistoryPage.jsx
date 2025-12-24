import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePlan } from '../hooks/usePlan';
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import TaskList from '../components/TaskList/TaskList';
import { useAuth } from '../utils/AuthContext';
import { supabase, initSupabase } from '../utils/supabaseClient';
import { fetchWithAuth } from '../utils/devNetLogger';
import styles from './HistoryPage.module.css';
import ErrorMessage from '../components/ErrorMessage';
// Note: Chatbot removed - AI Agent is now available globally via toggle button
import TaskResultModal from '../components/TaskResultModal/TaskResultModal';
import { createLogger } from '../utils/logger';
const HistoryPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme() || { theme: 'light' };
  const logger = createLogger('HistoryPage');
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

  // ✅ Move fetchRuns to useCallback so it can be called from anywhere
  const fetchRuns = useCallback(async (isBackgroundRefresh = false) => {
    if (!user) return;
    
    // Only show loading state on initial load, not background refreshes
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError('');

      // Set timeout to prevent infinite loading (30 seconds)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        logger.error('History fetch timeout - taking longer than 30 seconds', {
          user_id: user.id,
          timeout: 30000
        });
        setError('Loading is taking longer than expected. Please refresh the page.');
        setLoading(false);
      }, 30000);

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
        
        const response = await Promise.race([
          fetchWithAuth(apiUrl),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API request timeout after 15 seconds')), 15000)
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
        
        if (queryDuration > 5000) {
          logger.warn('Slow API response detected', {
            duration_ms: queryDuration,
            user_id: user.id,
            message: 'Backend API took longer than 5 seconds - check database indexes'
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
        logger.error('Failed to fetch automation runs', {
          error: err.message,
          error_code: err.code,
          user_id: user.id,
          stack: err.stack
        });
        setError(err.message || 'Could not load automation history. The backend may be unavailable.');
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
      }
  }, [user, logger]);

  // ✅ Real-time updates with Supabase Realtime (replaces polling)
  useEffect(() => {
    if (!user?.id) return;

    let channel = null;
    let client = null;

    const setupRealtime = async () => {
      try {
        // Initial load
        await fetchRuns(false);

        // Initialize Supabase client for Realtime
        client = await initSupabase();
        if (!client || typeof client.channel !== 'function') {
          logger.warn('Supabase Realtime not available, falling back to manual refresh only');
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
          .channel(`automation_runs:user_id=eq.${user.id}`)
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
              } else if (payload.eventType === 'UPDATE') {
                // Run status or data changed - update local state
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
                  // Close modal if viewing deleted run (check current state)
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
              logger.info('Successfully subscribed to automation_runs changes', { user_id: user.id });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              logger.warn('Realtime subscription error, falling back to manual refresh', {
                status,
                user_id: user.id
              });
            }
          });
      } catch (err) {
        logger.error('Failed to setup Realtime subscription', {
          error: err.message,
          user_id: user.id,
          stack: err.stack
        });
        // Fallback: still fetch initial data even if Realtime fails
        fetchRuns(false);
      }
    };

    setupRealtime();

    // Cleanup: unsubscribe from Realtime channel
    return () => {
      if (channel) {
        try {
          client?.removeChannel(channel);
        } catch (err) {
          logger.warn('Error removing Realtime channel', { error: err?.message });
        }
      }
    };
  }, [user?.id, fetchRuns, viewingTaskId]);

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
        setError(err.message || 'Failed to delete the run. Please try again.');
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
          <strong>Step 1:</strong> Submit tasks from <strong>Task Management</strong> → 
          <strong>Step 2:</strong> Track progress here in <strong>Automation History</strong> → 
          <strong>Step 3:</strong> View results by clicking 👁️ → 
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
