import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import TaskList from '../components/TaskList/TaskList';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import styles from './HistoryPage.module.css';
import ErrorMessage from '../components/ErrorMessage';
import Chatbot from '../components/Chatbot/Chatbot';
const HistoryPage = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const fetchRuns = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('automation_runs')
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
    if (task.result) alert(`Task Result:\n\n${JSON.stringify(task.result, null, 2)}`);
    else alert('No result data available for this task.');
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
      const { data, error: updateError } = await supabase
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
        const { error: deleteError } = await supabase.from('automation_runs').delete().eq('id', runId);
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
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--surface)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
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
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={styles.input} required />
              <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} className={styles.input} required />
              <button type="submit" className={styles.submitButton}>{t('action.save','Save')}</button>
              <button type="button" className={styles.cancelButton} onClick={() => setEditingTask(null)}>{t('action.cancel','Cancel')}</button>
            </form>
          </div>
        </div>
      )}
      
      <Chatbot />
    </div>
  );
};

export default HistoryPage;
