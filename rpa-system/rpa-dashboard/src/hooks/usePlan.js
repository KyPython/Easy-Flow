import { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { useAuth } from '../utils/AuthContext';
import { supabase, initSupabase } from '../utils/supabaseClient';
import { useRealtimeSync } from './useRealtimeSync';
import { api, requestWithRetry } from '../utils/api';
import { classifyErrorType } from '../utils/errorHandler';

// Try to import useSession - will be null if SessionProvider not available
let useSession = null;
try {
  const SessionContext = require('../contexts/SessionContext');
  useSession = SessionContext.useSession;
} catch (e) {
  // SessionContext not available - that's okay, we'll fall back to API calls
}

/**
 * Helper: Detect if an error is due to backend being unreachable (ECONNREFUSED/Proxy error)
 */
function isBackendUnreachable(error) {
  const errorType = classifyErrorType(error);
  return errorType === 'BACKEND_UNREACHABLE';
}

/**
 * Helper: Create a user-friendly error message for plan fetch failures
 */
function createPlanFetchErrorMessage(error) {
  if (isBackendUnreachable(error)) {
    // Extract port from error response if available
    const responseData = error?.response?.data || '';
    const portMatch = typeof responseData === 'string' 
      ? responseData.match(/localhost:(\d+)/) 
      : null;
    const port = portMatch ? portMatch[1] : '3030';
    
    return `Plan service is offline (connection refused to :${port}). Please start the backend server or check your API configuration.`;
  }
  
  if (error?.response?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  
  if (error?.response?.status >= 500) {
    return 'Server error while fetching plan data. Please try again later.';
  }
  
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return 'Request timed out while fetching plan data. Please try again.';
  }
  
  // Default message
  return error?.message || 'Failed to fetch plan data. Please try again.';
}

export const usePlan = () => {
  const { user } = useAuth();
  // Try to use session context if available (reduces API calls)
  // Always call hook if available (hooks must be called unconditionally)
  const sessionContext = useSession ? useSession() : null;
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  // NEW: Track if backend is unreachable to avoid spam
  const [backendStatus, setBackendStatus] = useState('unknown'); // 'unknown' | 'reachable' | 'unreachable'

  // ✅ FIX: Global fetch lock to prevent multiple components from fetching simultaneously
  if (!window.__planFetchLock) {
    window.__planFetchLock = { inFlight: false, lastAttempt: 0 };
  }
  const globalLock = window.__planFetchLock;

  const fetchPlanData = useCallback(async () => {
    // Prevent concurrent in-flight fetches which can overload backend (global lock)
    if (globalLock.inFlight) return;
    // Prevent rapid repeat attempts (debounce) - skip if last attempt was very recent
    const nowMs = Date.now();
    const MIN_ATTEMPT_INTERVAL_MS = 3000; // 3s
    if (nowMs - globalLock.lastAttempt < MIN_ATTEMPT_INTERVAL_MS) return;
    globalLock.lastAttempt = nowMs;
    globalLock.inFlight = true;
    
    if (!user?.id) {
      setLoading(false);
      globalLock.inFlight = false;
      return;
    }

    try {
      setLoading(true);
      // Don't clear error immediately if backend is known to be unreachable
      if (backendStatus !== 'unreachable') {
        setError(null);
      }

      // ✅ OPTIMIZATION: Use session context data if available (reduces API calls)
      if (sessionContext?.plan && !sessionContext.isLoading) {
        setPlanData(sessionContext.plan);
        setLoading(false);
        setBackendStatus('reachable');
        globalLock.inFlight = false;
        return;
      }

      // Call the backend API endpoint to get complete plan details
      // Use requestWithRetry to handle transient network/5xx errors and support abort/timeouts.
      const resp = await requestWithRetry(
        { method: 'get', url: '/api/user/plan' }, 
        { retries: 2, backoffMs: 500, timeout: 30000 }
      );
      const response = resp;

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch plan data');
      }

      if (!response.data.planData) {
        console.warn('No plan data returned from API');
        setPlanData(null);
        return;
      }

      // Backend is reachable - clear any previous error state
      setBackendStatus('reachable');
      setError(null);

      // Avoid unnecessary state updates by checking identity
      setPlanData(prev => {
        try {
          // Small shallow check: if the plan id and usage timestamp match, skip
          if (prev && prev.plan?.id && response.data.planData.plan?.id && prev.plan.id === response.data.planData.plan.id) {
            // If usage object is deeply similar, skip; fall back to setting in ambiguous cases
            return response.data.planData;
          }
        } catch (e) {
          // ignore and set
        }
        return response.data.planData;
      });
    } catch (err) {
      // IMPROVED: Better error handling with specific detection for backend unreachable
      const friendlyMessage = createPlanFetchErrorMessage(err);
      
      if (isBackendUnreachable(err)) {
        // Only log once when backend becomes unreachable
        if (backendStatus !== 'unreachable') {
          console.error('❌ Plan service backend unreachable:', friendlyMessage);
          setBackendStatus('unreachable');
        }
        // Set a user-friendly error that can be displayed in the UI
        setError({
          message: friendlyMessage,
          type: 'BACKEND_UNREACHABLE',
          recoverable: true,
          hint: 'Make sure your backend server is running and the dev proxy is configured correctly.'
        });
      } else {
        // Throttle error logging - only log once per 10 seconds for same error
        const errorKey = `plan_fetch_error:${err.code || 'UNKNOWN'}`;
        const now = Date.now();
        if (!fetchPlanData._lastErrorLog || now - fetchPlanData._lastErrorLog > 10000) {
          console.error('Error fetching plan data:', err);
          fetchPlanData._lastErrorLog = now;
        }
        setBackendStatus('unknown');
        setError({
          message: friendlyMessage,
          type: 'FETCH_ERROR',
          recoverable: true
        });
      }
      
      // Keep existing plan data if we have it (graceful degradation)
      // Only clear if we never had data
      if (!planData) {
        setPlanData(null);
      }
    } finally {
      setLoading(false);
      // Duration logged to backend telemetry if enabled
      globalLock.inFlight = false;
    }
  }, [user?.id, backendStatus, sessionContext?.plan, sessionContext?.isLoading]);

  useEffect(() => {
    // Fetch plan data on mount and when the user id changes
    fetchPlanData();
  }, [fetchPlanData]);

  // Helper functions
  const isPro = () => {
    if (!planData?.plan?.name) return false;
    // Dynamic check: any plan that's not the first/lowest tier is considered "pro"
    // This avoids hardcoding plan names
    const planName = planData.plan.name.toLowerCase();
    // Hobbyist/Free are typically tier 0, so anything above is "pro"
    // But we check status to ensure it's active
    return planData.plan.status === 'active' && 
           planName !== 'hobbyist' && 
           planName !== 'free';
  };

  const hasFeature = (feature) => {
    if (!planData) return false;
    return planData.limits?.[feature] === true;
  };

  const isAtLimit = (limitType) => {
    if (!planData) return false;
    
    const limit = planData.limits?.[limitType];
    const usage = planData.usage;
    
    if (limit === -1) return false; // Unlimited
    
    switch (limitType) {
      case 'monthly_runs':
        return usage?.monthly_runs >= limit;
      case 'storage_gb':
        return usage?.storage_gb >= limit;
      case 'workflows':
        return usage?.workflows >= limit;
      default:
        return false;
    }
  };

  const getUsagePercent = (limitType) => {
    if (!planData) return 0;
    
    const limit = planData.limits?.[limitType];
    const usage = planData.usage;
    
    if (limit === -1) return 0; // Unlimited
    
    switch (limitType) {
      case 'monthly_runs':
        return Math.round((usage?.monthly_runs / limit) * 100);
      case 'storage_gb':
        return Math.round((usage?.storage_gb / limit) * 100);
      case 'workflows':
        return Math.round((usage?.workflows / limit) * 100);
      default:
        return 0;
    }
  };

  const canCreateWorkflow = () => {
    // For Hobbyist plans, workflows are not available at all
    if (planData?.limits?.has_workflows === false) {
      return false;
    }
    
    // For plans with workflows, check if they're at the limit
    const currentWorkflows = planData?.usage?.workflows || 0;
    const workflowLimit = planData?.limits?.workflows || 0;
    
    return workflowLimit > 0 && currentWorkflows < workflowLimit;
  };

  const canRunAutomation = () => {
    // If still loading, allow action (don't block during load)
    if (loading && !planData) {
      return true;
    }

    // If we have plan data, use the backend's calculation
    if (planData?.can_run_automation !== undefined) {
      return planData.can_run_automation;
    }

    // Fallback: calculate locally if backend didn't provide the flag
    const currentRuns = planData?.usage?.monthly_runs || 0;
    const runLimit = planData?.limits?.monthly_runs || 50;

    // Only block if actually at or over limit (not when usage is 0)
    return currentRuns < runLimit;
  };

  const refresh = useCallback(() => {
    setLastRefresh(Date.now());
    // Reset backend status to allow retry
    setBackendStatus('unknown');
    fetchPlanData();
  }, [fetchPlanData]);

  const updateUserPlan = async (newPlanId) => {
    if (!user?.id) return false;
    
    try {
      const client = await initSupabase();
      const { error } = await client
        .from('profiles')
        .update({ 
          plan_id: newPlanId,
          plan_changed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating plan:', error);
        return false;
      }

      // Refresh plan data after update
      await fetchPlanData();
      return true;
    } catch (err) {
      console.error('Error updating user plan:', err);
      return false;
    }
  };

  // Realtime sync callbacks
  const handlePlanChange = useCallback((planChangeData) => {
    console.log('Plan changed in realtime:', planChangeData);
    // Immediately refresh plan data when plan changes
    fetchPlanData();
  }, [fetchPlanData]);

  // Poll for plan updates when returning from external payment pages
  // IMPROVED: Respects backendStatus to avoid spamming when backend is down
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && backendStatus !== 'unreachable') {
        // Page became visible, checking for plan updates
        // Delay slightly to allow any webhooks to process
        setTimeout(() => {
          fetchPlanData();
        }, 2000);
      }
    };

    const handleFocus = () => {
      if (backendStatus !== 'unreachable') {
        // Window focused, checking for plan updates
        setTimeout(() => {
          fetchPlanData();
        }, 1000);
      }
    };

    // Listen for storage events (cross-tab communication)
    const handleStorageChange = (e) => {
      if (e.key === 'polar_checkout_complete' && e.newValue) {
        // Polar checkout completed in another tab, refreshing plan
        setTimeout(() => {
          fetchPlanData();
          localStorage.removeItem('polar_checkout_complete'); // Clean up
        }, 1000);
      }
    };

    // Aggressive polling when page is visible (for checkout returns)
    // IMPROVED: Skip aggressive polling if backend is known to be unreachable
    let visibilityPollInterval = null;
    let consecutiveFailures = 0;
    const startVisibilityPolling = () => {
      // Don't start polling if backend is already known to be down
      if (backendStatus === 'unreachable') {
        // Skipping aggressive polling - backend is unreachable
        return;
      }
      
      if (document.visibilityState === 'visible' && !visibilityPollInterval) {
        // Starting aggressive plan polling for 30 seconds
        visibilityPollInterval = setInterval(async () => {
          // Circuit breaker: stop polling after 3 consecutive failures
          if (consecutiveFailures >= 3) {
            console.error('❌ Stopping aggressive polling - backend appears down');
            if (visibilityPollInterval) {
              clearInterval(visibilityPollInterval);
              visibilityPollInterval = null;
            }
            return;
          }

          try {
            await fetchPlanData();
            consecutiveFailures = 0; // Reset on success
          } catch (err) {
            consecutiveFailures++;
            console.warn(`⚠️ Poll attempt failed (${consecutiveFailures}/3)`);
          }
        }, 5000); // Poll every 5 seconds

        // Stop aggressive polling after 30 seconds
        setTimeout(() => {
          if (visibilityPollInterval) {
            clearInterval(visibilityPollInterval);
            visibilityPollInterval = null;
            consecutiveFailures = 0;
            // Stopped aggressive plan polling
          }
        }, 30000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('visibilitychange', startVisibilityPolling);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', startVisibilityPolling);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      if (visibilityPollInterval) {
        clearInterval(visibilityPollInterval);
      }
    };
  }, [backendStatus, fetchPlanData]);

  const handleUsageUpdate = useCallback((usageData) => {
    // Usage update handled silently to reduce log noise
    // Update the plan data with new usage information
    setPlanData(prevData => {
      if (!prevData) return prevData;
      
      // If it's just an execution event, refresh after a short delay
      if (usageData.type === 'execution_started' || usageData.type === 'execution_updated') {
        setTimeout(() => fetchPlanData(), 1000);
        return prevData;
      }
      
      // For direct usage updates, merge the new data
      if (usageData.monthlyRuns !== undefined) {
        return {
          ...prevData,
          usage: {
            ...prevData.usage,
            monthly_runs: usageData.monthlyRuns,
            storage_bytes: usageData.storageBytes,
            storage_gb: Math.round((usageData.storageBytes || 0) / (1024 * 1024 * 1024) * 100) / 100,
            workflows: usageData.workflows
          }
        };
      }
      
      return prevData;
    });
  }, [fetchPlanData]);

  const handleWorkflowUpdate = useCallback((workflowData) => {
    // Workflow update handled silently to reduce log noise
    // Refresh usage data when workflows change
    setTimeout(() => fetchPlanData(), 500);
  }, [fetchPlanData]);

  // Handle realtime errors - if realtime fails, we still have polling as fallback
  const handleRealtimeError = useCallback((errorInfo) => {
    console.warn('[usePlan] Realtime error:', errorInfo);
    // Could trigger a UI notification here if needed
  }, []);

  // Initialize realtime sync
  const { 
    realtimeStatus, 
    shouldFallbackToPolling 
  } = useRealtimeSync({
    onPlanChange: handlePlanChange,
    onUsageUpdate: handleUsageUpdate,
    onWorkflowUpdate: handleWorkflowUpdate,
    onError: handleRealtimeError
  });

  const trialDaysLeft = () => {
    const expires = planData?.plan?.expires_at;
    const isTrial = !!planData?.plan?.is_trial;
    if (!isTrial || !expires) return 0;
    const end = new Date(expires).getTime();
    const now = Date.now();
    if (end <= now) return 0;
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  // NEW: Expose error details for UI components to display friendly messages
  const getErrorDisplay = () => {
    if (!error) return null;
    return {
      message: error.message,
      type: error.type,
      isBackendDown: error.type === 'BACKEND_UNREACHABLE',
      hint: error.hint,
      canRetry: error.recoverable
    };
  };

  return {
    planData,
    loading,
    error: error?.message || null, // Keep backward compatibility
    errorDetails: getErrorDisplay(), // NEW: Detailed error info for UI
    isPro,
    hasFeature,
    isAtLimit,
    getUsagePercent,
    canCreateWorkflow,
    canRunAutomation,
    refresh,
    updateUserPlan,
    trialDaysLeft,
    isRealtimeConnected: realtimeStatus === 'connected',
    realtimeStatus, // Expose full status
    shouldFallbackToPolling,
    backendStatus, // NEW: Expose backend reachability status
    lastRefresh
  };
};