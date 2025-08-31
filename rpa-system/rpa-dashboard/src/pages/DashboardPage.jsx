import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../utils/AuthContext';
import Dashboard from '../components/Dashboard/Dashboard';
import { supabase } from '../utils/supabaseClient';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    timeSavedHours: 0,
    documentsProcessed: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Fetch dashboard data from Supabase RPC
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('user_dashboard_report', { p_user_id: user.id })
        .single();

      if (error) throw error;

      setMetrics({
        totalTasks: data.total_tasks ?? 0,
        completedTasks: data.completed_tasks ?? 0,
        timeSavedHours: data.time_saved_hours ?? 0,
        documentsProcessed: data.documents_processed ?? 0
      });

      setRecentTasks((data.recent_runs ?? []).map(run => ({
        id: run.id,
        type: run.task_name || 'Unknown Task',
        url: run.url || 'N/A',
        status: run.status || 'pending',
        created_at: run.started_at || new Date().toISOString(),
        result: run.result || null
      })));

      setIsUsingFallback(false);
    } catch (err) {
      console.warn('Backend unavailable, using fallback data:', err.message);
      setIsUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboardData();

      // Supabase v2 Realtime subscription
      const channel = supabase
        .channel(`realtime:automation_runs:user_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'automation_runs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newTask = payload.new;

            setRecentTasks(prev => [
              {
                id: newTask.id,
                type: newTask.task_name || 'Unknown Task',
                url: newTask.url || 'N/A',
                status: newTask.status || 'pending',
                created_at: newTask.started_at || new Date().toISOString(),
                result: newTask.result || null
              },
              ...prev
            ]);

            setMetrics(prev => ({
              ...prev,
              totalTasks: prev.totalTasks + 1,
              completedTasks: newTask.status === 'completed' ? prev.completedTasks + 1 : prev.completedTasks,
              documentsProcessed: prev.documentsProcessed + (newTask.result?.documentsProcessed || 0),
              timeSavedHours: prev.timeSavedHours + (newTask.result?.timeSavedHours || 0)
            }));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, authLoading, fetchDashboardData]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {isUsingFallback && (
        <div style={{
          background: 'var(--color-warning-50)',
          border: '1px solid var(--color-warning-200)',
          color: 'var(--color-warning-800)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--spacing-lg)',
          textAlign: 'center',
          fontSize: 'var(--font-size-sm)'
        }}>
          📡 Demo Mode: Showing sample data while backend is connecting...
        </div>
      )}

      <Dashboard metrics={metrics} recentTasks={recentTasks} />
    </>
  );
};

export default DashboardPage;
