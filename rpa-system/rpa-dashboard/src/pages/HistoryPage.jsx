import React, { useEffect, useState, useRef } from 'react';
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
  const [viewingTask, setViewingTask] = useState(null);
  const runsRef = useRef([]); // Store runs in ref to avoid dependency issues

  useEffect(() => {
    const fetchRuns = async () => {
      if (!user) return;
      setLoading(true);
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
          query_duration_ms: queryDuration
        });
        setRuns(runsDataFinal);
        runsRef.current = runsDataFinal; // Update ref
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
        setLoading(false);
      }
    };
    fetchRuns();
    
    // ✅ UX: Smart auto-refresh - only refresh if there are active tasks, and pause when user is interacting
    let refreshInterval;
    let isUserInteracting = false;
    let interactionTimeout;
    
    const handleUserInteraction = () => {
      isUserInteracting = true;
      clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        isUserInteracting = false;
      }, 5000); // Pause refresh for 5 seconds after user interaction
    };
    
    // Track user interactions (mouse, keyboard, text selection)
    document.addEventListener('mousedown', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('selectionchange', handleUserInteraction);
    
    const smartRefresh = () => {
      // Don't refresh if user is actively interacting
      if (isUserInteracting) return;
      
      // Only auto-refresh if there are queued/running tasks that need updates
      const hasActiveTasks = runsRef.current.some(run => 
        run.status === 'queued' || run.status === 'running' || run.status === 'pending'
      );
      
      if (hasActiveTasks) {
        fetchRuns();
      }
    };
    
    // Refresh every 10 seconds (increased from 5), but only if there are active tasks
    refreshInterval = setInterval(smartRefresh, 10000);
    
    return () => {
      clearInterval(refreshInterval);
      clearTimeout(interactionTimeout);
      document.removeEventListener('mousedown', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('selectionchange', handleUserInteraction);
    };
  }, [user]);

  const handleViewTask = (task) => {
    setViewingTask(task);
  };

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

  const handleDeleteTask = async (runId) => {
    const runToDelete = runs.find(r => r.id === runId);
    if (!runToDelete) return; // Should not happen, but good practice

    const taskName = runToDelete.automation_tasks?.name || 'the selected run';

    if (window.confirm(`Are you sure you want to delete the run for "${taskName}"? This action cannot be undone.`)) {
      try {
        const client = await initSupabase();
        const { error: deleteError } = await client.from('automation_runs').delete().eq('id', runId);
        if (deleteError) throw deleteError;
        setRuns(prev => prev.filter(r => r.id !== runId));
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
          onClose={() => setViewingTask(null)}
        />
      )}
    </div>
  );
};

export default HistoryPage;
