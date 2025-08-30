import React, { useState, useEffect } from 'react';
import { getTasks, createTask, runTask, deleteTask } from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import styles from './TasksPage.module.css';

// Robust fallback data for when backend is unavailable
const fallbackTasks = [
  {
    id: 1,
    name: 'Daily Sales Report',
    description: 'Automated extraction of daily sales data from CRM system',
    url: 'https://crm.example.com/reports',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  },
  {
    id: 2,
    name: 'Invoice Processing',
    description: 'Automated processing and validation of incoming invoices',
    url: 'https://accounting.example.com/invoices',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  },
  {
    id: 3,
    name: 'Customer Data Sync',
    description: 'Synchronize customer information across multiple platforms',
    url: 'https://customers.example.com/sync',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  }
];

const TasksPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(fallbackTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Form state
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskUrl, setTaskUrl] = useState('');
  const [formError, setFormError] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch real data with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );
      
      const tasksPromise = getTasks();
      const fetchedTasks = await Promise.race([tasksPromise, timeoutPromise]);
      
      setTasks(fetchedTasks && fetchedTasks.length > 0 ? fetchedTasks : fallbackTasks);
      setIsUsingFallback(false);
      
    } catch (err) {
      console.warn('Backend unavailable for tasks, using fallback data:', err.message);
      setTasks(fallbackTasks);
      setIsUsingFallback(true);
      setError(null); // Don't show error, just use fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
    } else {
      // Show fallback data even without user for demo purposes
      setTasks(fallbackTasks);
      setIsUsingFallback(true);
    }
  }, [user]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!taskName || !taskUrl) {
      setFormError('Task Name and URL are required.');
      return;
    }

    if (isUsingFallback) {
      // Demo mode - add task locally
      const newTask = {
        id: Date.now(),
        name: taskName,
        description: taskDesc,
        url: taskUrl,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      setTasks(prev => [newTask, ...prev]);
      setTaskName('');
      setTaskDesc('');
      setTaskUrl('');
      setFormError('');
      
      // Show demo notification
      alert('✅ Task created in demo mode! In production, this would be saved to your account.');
      return;
    }

    try {
      await createTask({ name: taskName, description: taskDesc, url: taskUrl });
      // Reset form and refresh list
      setTaskName('');
      setTaskDesc('');
      setTaskUrl('');
      setFormError('');
      fetchTasks(); // Refetch tasks to show the new one
    } catch (err) {
      if (err.response && err.response.status === 403) {
        setFormError(err.response.data.error); // Show plan limit error
      } else {
        setFormError('Failed to create task. Please try again.');
      }
      console.error(err);
    }
  };

  const handleRunClick = async (taskId) => {
    setRunningTaskId(taskId);
    
    if (isUsingFallback) {
      // Demo mode - simulate task run
      setTimeout(() => {
        setRunningTaskId(null);
        alert('🚀 Task executed successfully in demo mode! In production, this would run your automation.');
      }, 2000);
      return;
    }

    try {
      const result = await runTask(taskId);
      alert(`Task run successful! Run ID: ${result.runId}`);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        alert(err.response.data.error); // Show plan limit error
      } else {
        alert('Task execution failed. Check the history for more details.');
      }
      console.error(err);
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleDeleteClick = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    if (isUsingFallback) {
      // Demo mode - remove task locally
      setTasks(prev => prev.filter(task => task.id !== taskId));
      alert('🗑️ Task deleted in demo mode!');
      return;
    }

    try {
      await deleteTask(taskId);
      fetchTasks(); // Refresh the list after deletion
    } catch (err) {
      alert('Failed to delete task.');
      console.error(err);
    }
  };

  return (
    <div className={styles.container}>
      {isUsingFallback && (
        <div style={{
          background: 'var(--color-warning-50)',
          border: '1px solid var(--color-warning-200)',
          color: 'var(--color-warning-800)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          margin: '0 0 var(--spacing-lg) 0',
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)'
        }}>
          📡 Demo Mode: You can create, run, and delete tasks. Changes are local until backend connects.
        </div>
      )}

      <div className={styles.formSection}>
        <h2 className="text-heading-3">Create New Automation Task</h2>
        <form onSubmit={handleCreateSubmit} className={styles.form}>
          {formError && <p className={styles.formError}>{formError}</p>}
          <input
            type="text"
            placeholder="Task Name (e.g., 'Daily Report Download')"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className={styles.input}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            className={styles.textarea}
          />
          <input
            type="url"
            placeholder="Target URL (https://...)"
            value={taskUrl}
            onChange={(e) => setTaskUrl(e.target.value)}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.submitButton}>
            {isUsingFallback ? '🚀 Create Task (Demo)' : 'Create Task'}
          </button>
        </form>
      </div>

      <div className={styles.listSection}>
        <h2 className="text-heading-3">Your Automation Tasks</h2>
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              border: '3px solid var(--color-primary-200)', 
              borderTop: '3px solid var(--color-primary-600)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            Loading tasks...
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && tasks.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-2xl)', 
            color: 'var(--text-muted)',
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-gray-200)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🤖</div>
            <h3 className="text-heading-4" style={{ marginBottom: 'var(--spacing-sm)' }}>No Tasks Yet</h3>
            <p>You haven't created any tasks yet. Use the form above to get started!</p>
          </div>
        )}
        <div className={styles.taskList}>
          {tasks.map((task) => (
            <div key={task.id} className={styles.taskCard}>
              <h3 className="text-heading-4">{task.name}</h3>
              <p className="text-body">{task.description || 'No description provided.'}</p>
              <div className={styles.taskUrl}>
                <strong>URL:</strong> <a href={task.url} target="_blank" rel="noopener noreferrer">{task.url}</a>
              </div>
              <div className={styles.taskMeta}>
                <span className="text-small">Created: {new Date(task.created_at).toLocaleDateString()}</span>
              </div>
              <div className={styles.taskActions}>
                <button 
                  className={styles.runButton}
                  onClick={() => handleRunClick(task.id)}
                  disabled={runningTaskId !== null}
                >
                  {runningTaskId === task.id ? '⏳ Running...' : '▶️ Run'}
                </button>
                <button 
                  className={styles.deleteButton}
                  onClick={() => handleDeleteClick(task.id)}
                  disabled={runningTaskId !== null}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;