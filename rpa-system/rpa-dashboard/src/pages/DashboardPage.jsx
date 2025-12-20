import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import Dashboard from '../components/Dashboard/Dashboard';
import { initSupabase } from '../utils/supabaseClient';
import ErrorMessage from '../components/ErrorMessage';
import { createLogger } from '../utils/logger';

// Note: Chatbot removed - AI Agent is now available globally via toggle button


const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme() || { theme: 'light' };
  const logger = createLogger('DashboardPage');
  const loadingTimeoutRef = useRef(null);
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    timeSavedHours: 0,
    documentsProcessed: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [workflowsCount, setWorkflowsCount] = useState(0);
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

  // Fetch dashboard data via optimized backend API
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    const queryStartTime = Date.now();
    setLoading(true);
    setError('');

    // Set timeout to prevent infinite loading (15 seconds - reduced from 30)
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      const duration = Date.now() - queryStartTime;
      logger.error('Dashboard data fetch timeout', {
        user_id: user.id,
        timeout: 15000,
        duration_ms: duration
      });
      setError('Loading is taking longer than expected. Please refresh the page.');
      setLoading(false);
    }, 15000);

    try {
      logger.info('📊 [Dashboard] Fetching dashboard data', { 
        user_id: user.id,
        method: 'backend_api'
      });
      
      // ✅ PERFORMANCE: Use optimized backend API instead of direct Supabase query
      // Backend has better connection pooling, query optimization, and parallel queries
      const { fetchWithAuth } = await import('../utils/devNetLogger');
      const apiUrl = '/api/dashboard';
      
      const response = await Promise.race([
        fetchWithAuth(apiUrl),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API request timeout after 10 seconds')), 10000)
        )
      ]);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const dashboardData = await response.json();
      const queryDuration = Date.now() - queryStartTime;
      
      // Calculate metrics from backend response
      const totalTasks = dashboardData.totalTasks || 0;
      const totalRuns = dashboardData.totalRuns || 0;
      const completedTasks = dashboardData.recentRuns?.filter(run => run.status === 'completed').length || 0;
      const timeSavedHours = Math.floor(completedTasks * 2.5); // Estimate 2.5h saved per completed task
      const documentsProcessed = dashboardData.recentRuns?.filter(run => 
        run.automation_tasks?.task_type?.includes('invoice') || 
        run.automation_tasks?.task_type?.includes('document')
      ).length || 0;

      logger.info('✅ [Dashboard] Data fetched successfully', {
        user_id: user.id,
        duration_ms: queryDuration,
        totalTasks,
        totalRuns,
        completedTasks,
        timeSavedHours,
        documentsProcessed,
        recentRuns_count: dashboardData.recentRuns?.length || 0
      });
      
      // Log performance warning if query is slow
      if (queryDuration > 3000) {
        logger.warn('⚠️ [Dashboard] Slow query detected', {
          user_id: user.id,
          duration_ms: queryDuration,
          threshold_ms: 3000
        });
      }

      setMetrics({
        totalTasks,
        completedTasks,
        timeSavedHours,
        documentsProcessed
      });

      // Map recent runs to the format expected by the Dashboard component
      setRecentTasks((dashboardData.recentRuns || []).map(run => ({
        id: run.id,
        type: run.automation_tasks?.name || 'Unknown Task',
        url: run.automation_tasks?.url || 'N/A',
        status: run.status || 'pending',
        created_at: run.started_at || new Date().toISOString(),
        result: run.result || null
      })));

      // Fetch workflows count for workflow creation prompt
      try {
        const workflowsResponse = await fetchWithAuth('/api/workflows?limit=1');
        if (workflowsResponse.ok) {
          const workflowsData = await workflowsResponse.json();
          setWorkflowsCount(Array.isArray(workflowsData) ? workflowsData.length : 0);
        }
      } catch (e) {
        // Silently fail - workflows count is optional
        console.debug('Failed to fetch workflows count:', e);
      }

    } catch (err) {
      const queryDuration = Date.now() - queryStartTime;
      logger.error('❌ [Dashboard] Failed to fetch dashboard data', {
        error: err.message,
        error_code: err.code,
        error_details: err.details,
        user_id: user.id,
        duration_ms: queryDuration,
        stack: err.stack
      });
      
      // More user-friendly error messages
      let userMessage = 'Unable to load dashboard data';
      
      if (err.message?.includes('timeout')) {
        userMessage = 'Request timed out. The server may be slow. Please try again.';
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        userMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (err.message?.includes('CSP') || err.message?.includes('Content Security Policy')) {
        userMessage = 'Dashboard temporarily unavailable. Please refresh the page or try again in a moment.';
      } else if (err.message?.includes('CORS')) {
        userMessage = 'Connection error. Please check your internet connection and try again.';
      } else if (err.message?.includes('not authenticated') || err.message?.includes('unauthorized') || err.message?.includes('401')) {
        userMessage = 'Please sign in again to access your dashboard.';
      } else if (err.message?.includes('500') || err.message?.includes('Database')) {
        userMessage = 'Database connection issue. Please try again in a moment.';
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
    <div data-theme={theme}>
      <ErrorMessage message={error} />
      <Dashboard metrics={metrics} recentTasks={recentTasks} workflowsCount={workflowsCount} user={user} />
    </div>
  );
};

export default DashboardPage;
