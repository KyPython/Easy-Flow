import React, { useEffect, useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import { useI18n } from '../i18n';
import TaskList from '../components/TaskList/TaskList';
import { useAuth } from '../utils/AuthContext';
import { supabase, initSupabase } from '../utils/supabaseClient';
import styles from './HistoryPage.module.css';
import ErrorMessage from '../components/ErrorMessage';
import Chatbot from '../components/Chatbot/Chatbot';
import TaskResultModal from '../components/TaskResultModal/TaskResultModal';
const HistoryPage = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [viewingTask, setViewingTask] = useState(null);

  useEffect(() => {
    const fetchRuns = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const client = await initSupabase();
        const { data, error } = await client.from('automation_runs')
          .select(`id,status,started_at,result,artifact_url,automation_tasks(id,name,url,task_type)`)
          .eq('user_id', user.id)
          .order('started_at', { ascending: false });
        if (error) throw error;
        setRuns(data || []);
      } catch (err) {
        console.error('Failed to fetch automation runs:', err.message || err);
        setError(err.message || 'Could not load automation history. The backend may be unavailable.');
      } finally {
        setLoading(false);
      }
    };
    fetchRuns();
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
      console.error('Error updating task:', err.message);
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
        console.error('Error deleting run:', err.message || err);
        setError(err.message || 'Failed to delete the run. Please try again.');
      }
    }
  };

  const { t } = useI18n();

  if (loading) return <div className={styles.container}><p>{t('history.loading','Loading automation history...')}</p></div>;


  return (
    <div className={styles.container}>
      <ErrorMessage message={error} />


      {runs.length === 0 && !error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <h3>{t('history.empty_title','No Automation History')}</h3>
          <p>{t('history.empty_message','Your automation runs will appear here once you start executing tasks.')}</p>
        </div>
      ) : (
        <TaskList tasks={runs} onView={handleViewTask} onEdit={handleEditTask} onDelete={handleDeleteTask} />
      )}

      {editingTask && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3>{t('history.edit_task','Edit Task')}</h3>
            <form onSubmit={handleEditSubmit}>
              {editError && <p className={styles.formError}>{editError}</p>}
              <input
                id="edit-task-name"
                name="task_name"
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className={styles.input}
                required
                autoComplete="off"
              />
              <input
                id="edit-task-url"
                name="task_url"
                type="url"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                className={styles.input}
                required
                autoComplete="url"
              />
              <button type="submit" className={styles.submitButton}>{t('action.save','Save')}</button>
              <button type="button" className={styles.cancelButton} onClick={() => setEditingTask(null)}>{t('action.cancel','Cancel')}</button>
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
      
      <Chatbot />
    </div>
  );
};

export default HistoryPage;
