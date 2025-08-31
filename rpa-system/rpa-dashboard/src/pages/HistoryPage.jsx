import React, { useEffect, useState } from 'react';
import TaskList from '../components/TaskList/TaskList';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import styles from './HistoryPage.module.css';

// Demo fallback
const fallbackRuns = [
  { id: 1, automation_tasks: { name: 'Demo Task', url: '#' }, status: 'completed', started_at: new Date().toISOString(), result: { summary: 'Demo result' } }
];

const HistoryPage = () => {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const fetchRuns = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase.from('automation_runs')
          .select(`id,status,started_at,result,automation_tasks(name,url)`)
          .eq('user_id', user.id)
          .order('started_at', { ascending: false });
        if (error) throw error;
        setRuns(data || []);
        setIsUsingFallback(false);
      } catch (err) {
        console.warn('Using fallback:', err.message);
        setRuns(fallbackRuns);
        setIsUsingFallback(true);
      } finally { setLoading(false); }
    };
    fetchRuns();
  }, [user]);


  const handleViewTask = (task) => {
    if (task.result) alert(`Task Result:\n\n${JSON.stringify(task.result, null, 2)}`);
    else alert('No result data available for this task.');
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setEditName(task.type);
    setEditUrl(task.url);
    setEditError('');
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editName || !editUrl) { setEditError('Task Name and URL are required.'); return; }
    setRuns(prev => prev.map(t => t.id === editingTask.id ? { ...t, type: editName, url: editUrl } : t));
    setEditingTask(null);
    alert('✏️ Task edited in demo mode!');
  };

  const handleDeleteTask = (task) => {
    if (window.confirm(`Delete "${task.type}"?`)) {
      setRuns(prev => prev.filter(t => t.id !== task.id));
      alert('🗑️ Task deleted in demo mode!');
    }
  };

  if (loading) return <div className={styles.container}><p>Loading automation history...</p></div>;

  return (
    <div className={styles.container}>
      {isUsingFallback && (
        <div style={{ background: '#FFF4E5', border: '1px solid #FFD380', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
          📡 Backend unavailable: Showing fallback data
        </div>
      )}

      {runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888', border: '1px solid #EEE', borderRadius: '12px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
          <h3>No Automation History</h3>
          <p>Your automation runs will appear here once you start executing tasks.</p>
        </div>
      ) : (
        <TaskList tasks={runs} onView={handleViewTask} onEdit={handleEditTask} onDelete={handleDeleteTask} />
      )}

      {editingTask && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3>Edit Task</h3>
            <form onSubmit={handleEditSubmit}>
              {editError && <p className={styles.formError}>{editError}</p>}
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={styles.input} required />
              <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} className={styles.input} required />
              <button type="submit" className={styles.submitButton}>Save</button>
              <button type="button" className={styles.cancelButton} onClick={() => setEditingTask(null)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
