import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import Dashboard from '../components/Dashboard/Dashboard';
import supabase, { initSupabase } from '../utils/supabaseClient';
import ErrorMessage from '../components/ErrorMessage';
import { createLogger } from '../utils/logger';

// Lazy load Chatbot component for better performance
const Chatbot = lazy(() => import('../components/Chatbot/Chatbot'));


const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const logger = createLogger('DashboardPage');
  const loadingTimeoutRef = useRef(null);
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    timeSavedHours: 0,
    documentsProcessed: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Track trial signup conversion
  useEffect(() => {
    const justSignedUp = sessionStorage.getItem('just_signed_up');
    
    if (justSignedUp === 'true') {
      if (window.gtag) {
        window.gtag('event', 'trial_signup', {
          'method': 'website'
        });
        if (process.env.NODE_ENV === 'development') {
          console.info('[Analytics] New signup tracked');
        }
      }
      sessionStorage.removeItem('just_signed_up');
    }
  }, []);

  // Fetch dashboard data directly from automation_runs table
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    // Set timeout to prevent infinite loading (30 seconds)
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      logger.error('Dashboard data fetch timeout - taking longer than 30 seconds', {
        user_id: user.id,
        timeout: 30000
      });
      setError('Loading is taking longer than expected. Please refresh the page.');
      setLoading(false);
    }, 30000);

    try {
      logger.info('Fetching dashboard data', { user_id: user.id });
      
      // Ensure Supabase is initialized before querying
      const client = await initSupabase();
      
      const { data, error } = await client
        .from('automation_runs')
        .select(`id,status,started_at,result,artifact_url,automation_tasks(id,name,url,task_type)`)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (error) {
        logger.error('Supabase query error', { error: error.message, code: error.code, user_id: user.id });
        throw error;
      }

      // Calculate metrics from the data
      const runs = data || [];
      const totalTasks = runs.length;
      const completedTasks = runs.filter(run => run.status === 'completed').length;
      const timeSavedHours = Math.floor(completedTasks * 2.5); // Estimate 2.5h saved per completed task
      const documentsProcessed = runs.filter(run => 
        run.automation_tasks?.task_type?.includes('invoice') || 
        run.automation_tasks?.task_type?.includes('document')
      ).length;

      logger.info('Dashboard data fetched successfully', {
        user_id: user.id,
        totalTasks,
        completedTasks,
        timeSavedHours,
        documentsProcessed
      });

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
      logger.error('Failed to fetch dashboard data', {
        error: err.message,
        error_code: err.code,
        error_details: err.details,
        user_id: user.id,
        stack: err.stack
      });
      
      // More user-friendly error messages
      let userMessage = 'Unable to load dashboard data';
      
      if (err.message?.includes('Supabase not initialized') || err.message?.includes('not configured')) {
        userMessage = 'Database connection not configured. Please contact support or check your environment configuration.';
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('CSP') || err.message?.includes('Content Security Policy')) {
        userMessage = 'Dashboard temporarily unavailable. Please refresh the page or try again in a moment.';
      } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        userMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (err.message?.includes('not authenticated') || err.message?.includes('unauthorized')) {
        userMessage = 'Please sign in again to access your dashboard.';
      }
      
      setError(userMessage);
    } finally {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
    }
  }, [user, logger]);

  useEffect(() => {
    if (!authLoading && user) {
      // Schedule initial fetch and subscription during idle time so we don't
      // block first paint or the React commit phase. This reduces main-thread
      // contention during startup and improves Time To Interactive.
      let idleId = null;
      let timerId = null;
      let updateTimeout = null;
      let channel = null;
      let client = null;

      const startRealtime = () => {
        // Keep the effect sync entrypoint stable — run async work inside.
        (async () => {
          try {
            // Start by fetching dashboard data once
            fetchDashboardData();

            // Ensure the real Supabase client is initialized before creating channels
            client = await initSupabase();

            // Then subscribe to realtime events and throttle updates
            try {
              if (process.env.NODE_ENV === 'development') {
                console.info('[Dashboard] creating realtime channel for user', user.id);
              }
              channel = client
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
                    if (process.env.NODE_ENV === 'development') {
                      console.info('[Dashboard] realtime payload received', payload);
                    }
                    if (updateTimeout) clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                      fetchDashboardData();
                    }, 2000);
                  }
                );

              // Attempt to subscribe and log lifecycle status
              try {
                const sub = channel.subscribe((status) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.info('[Dashboard] realtime channel status', status);
                  }
                });
                logger.debug('Subscribe() called for automation_runs channel', {
                  channel: sub || channel,
                  user_id: user.id
                });
              } catch (sErr) {
                if (process.env.NODE_ENV === 'development') {
                  logger.warn('Subscribe call failed', {
                    error: sErr?.message || sErr,
                    user_id: user.id
                  });
                }
              }
            } catch (e) {
              if (process.env.NODE_ENV === 'development') {
                logger.warn('Realtime subscription setup failed', {
                  error: e?.message || e,
                  user_id: user.id
                });
              }
            }
          } catch (e) {
            // Don't crash the app if realtime setup fails — log and continue
            logger.warn('Realtime init failed', {
              error: e?.message || e,
              user_id: user.id,
              stack: e?.stack
            });
          }
        })();
      };

      // Use requestIdleCallback when available to avoid impacting first paint
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        try {
          idleId = window.requestIdleCallback(startRealtime, { timeout: 2000 });
        } catch (e) {
          timerId = setTimeout(startRealtime, 1000);
        }
      } else {
        timerId = setTimeout(startRealtime, 1000);
      }

      return () => {
        if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
        if (timerId) clearTimeout(timerId);
        if (updateTimeout) clearTimeout(updateTimeout);
        try {
          if (channel && channel.unsubscribe) channel.unsubscribe();
        } catch (e) {}
        try { if (channel && client && typeof client.removeChannel === 'function') client.removeChannel(channel); } catch (e) {}
      };
    }
  }, [user?.id, authLoading]); // ✅ FIXED: Removed fetchDashboardData from dependencies

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
      <Suspense fallback={null}>
        <Chatbot />
      </Suspense>
    </>
  );
};

export default DashboardPage;
