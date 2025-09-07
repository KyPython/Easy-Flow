import React, { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import Dashboard from '../components/Dashboard/Dashboard';
import { supabase } from '../utils/supabaseClient';
import ErrorMessage from '../components/ErrorMessage';
import Chatbot from '../components/Chatbot/Chatbot';

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
  const [error, setError] = useState('');

  // Fetch dashboard data directly from automation_runs table
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('automation_runs')
        .select(`id,status,started_at,result,artifact_url,automation_tasks(id,name,url,task_type)`)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Calculate metrics from the data
      const runs = data || [];
      const totalTasks = runs.length;
      const completedTasks = runs.filter(run => run.status === 'completed').length;
      const timeSavedHours = Math.floor(completedTasks * 2.5); // Estimate 2.5h saved per completed task
      const documentsProcessed = runs.filter(run => 
        run.automation_tasks?.task_type?.includes('invoice') || 
        run.automation_tasks?.task_type?.includes('document')
      ).length;

      setMetrics({
        totalTasks,
        completedTasks,
        timeSavedHours,
        documentsProcessed
      });

      setRecentTasks(runs.slice(0, 5).map(run => ({
        id: run.id,
        type: run.automation_tasks?.name || 'Unknown Task',
        url: run.automation_tasks?.url || 'N/A',
        status: run.status || 'pending',
        created_at: run.started_at || new Date().toISOString(),
        result: run.result || null
      })));

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err.message || err);
      
      // More user-friendly error messages
      let userMessage = 'Unable to load dashboard data';
      
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CSP') || err.message?.includes('Content Security Policy')) {
        userMessage = 'Dashboard temporarily unavailable. Please refresh the page or try again in a moment.';
      } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        userMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (err.message?.includes('not authenticated') || err.message?.includes('unauthorized')) {
        userMessage = 'Please sign in again to access your dashboard.';
      }
      
      setError(userMessage);
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
            console.log('Dashboard real-time update:', payload);
            // Refresh all data when anything changes
            fetchDashboardData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, authLoading, fetchDashboardData]);

  const { t } = useI18n();

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>{t('dashboard.loading','Loading dashboard...')}</p>
      </div>
    );
  }

  return (
    <>
      <ErrorMessage message={error} />

      <Dashboard metrics={metrics} recentTasks={recentTasks} user={user} />
      
      <Chatbot />
    </>
  );
};

export default DashboardPage;
