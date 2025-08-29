import React, { useEffect, useState } from 'react';
import TaskList from '../components/TaskList/TaskList';
import { api } from '../utils/api';
import { supabase } from '../utils/supabaseClient';
import styles from './HistoryPage.module.css';

const HistoryPage = () => {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await api.get('/api/logs?limit=100');
        if (canceled) return;
        const mapped = (res.data || []).map((row, idx) => ({
          id: row.id || idx,
          type: row.task || 'custom',
          url: row.url || '',
          status: row.status || 'completed',
          created_at: row.created_at || new Date().toISOString(),
          username: row.username || '',
          artifact_url: row.artifact_url || null,
          result: row.result || null,
        }));
        setTasks(mapped);
      } catch (e) {
        console.error('Failed to load logs', e);
      }
    })();

    // Optional realtime updates (requires Supabase Realtime enabled for this table)
    const enableRealtime = (process.env.REACT_APP_ENABLE_REALTIME || 'true').toLowerCase() !== 'false';
    let channel;
    if (enableRealtime) {
      channel = supabase
        .channel('automation_logs_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, (payload) => {
          const row = payload.new || {};
          const mapped = {
            id: row.id,
            type: row.task || 'custom',
            url: row.url || '',
            status: row.status || 'completed',
            created_at: row.created_at || new Date().toISOString(),
            username: row.username || '',
            artifact_url: row.artifact_url || null,
            result: row.result || null,
          };
          setTasks(prev => [mapped, ...prev].slice(0, 100));
        })
        .subscribe();
    }

    return () => {
      canceled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
  const handleEdit = (task) => {
    console.log('Edit task:', task);
    // Implement edit functionality
  };

  const handleDelete = (taskId) => {
    console.log('Delete task:', taskId);
    // Implement delete functionality
  };

  const handleView = (task) => {
    console.log('View task:', task);
    // Implement view functionality
  };

  return (
    <div className={styles.container}>
      <TaskList
        tasks={tasks}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
};

export default HistoryPage;