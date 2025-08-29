import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import Dashboard from '../components/Dashboard/Dashboard';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState({ totalTasks: 0, completedTasks: 0, timeSavedHours: 0, documentsProcessed: 0 });
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
  const res = await api.get('/api/logs?limit=100');
        const rows = Array.isArray(res.data) ? res.data : [];
        if (!mounted) return;
        const total = rows.length;
        const completed = rows.filter(r => r.status === 'completed').length;
        const docs = rows.filter(r => r.artifact_url).length;
        // naive time-saved estimate: 2 min per task
        const timeSavedHours = Math.round(((completed * 2) / 60) * 10) / 10;
        setMetrics({ totalTasks: total, completedTasks: completed, timeSavedHours, documentsProcessed: docs });
        const mapped = rows.map((r, i) => ({
          id: r.id || i,
          type: r.task || 'custom',
          url: r.url || '',
          status: r.status || 'completed',
          created_at: r.created_at || new Date().toISOString(),
        }));
        setRecentTasks(mapped);
      } catch (e) {
        // leave defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  return <Dashboard metrics={metrics} recentTasks={recentTasks} />;
};

export default DashboardPage;