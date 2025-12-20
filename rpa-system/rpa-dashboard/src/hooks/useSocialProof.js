import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocialProofMetrics } from '../utils/api';

// Custom hook for social proof data with robust error handling and offline support
export function useSocialProof(refreshInterval = 5 * 60 * 1000) { // 5 minutes default
  const [data, setData] = useState({
    totalUsers: 0, // ✅ FIX: Start at 0, will be updated from API
    activeWorkflows: 0,
    recentEvents: 0,
    lastUpdated: new Date().toISOString(),
    source: 'fallback'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Use ref to store fetch function to avoid dependency issues
  const fetchMetricsRef = useRef(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 [SocialProof] Connection restored, attempting to refresh data');
      setIsOnline(true);
      setError(null);
      // Don't call fetchMetrics directly here - let the main effect handle it
    };
    
    const handleOffline = () => {
      console.log('📡 [SocialProof] Gone offline, using cached data');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // No dependencies - this only sets up event listeners

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 [SocialProof] Fetching metrics...');
      const result = await getSocialProofMetrics();
      
      if (result && result.metrics) {
        // ✅ FIX: Validate and normalize data structure - use actual values from API, no hardcoded fallbacks
        const validatedData = {
          totalUsers: Number(result.metrics.totalUsers) || 0,
          activeWorkflows: Number(result.metrics.activeToday) || 0,
          recentEvents: Number(result.metrics.conversions) || 0,
          conversionRate: result.metrics.conversionRate || '0%',
          lastUpdated: result.metrics.lastUpdated || new Date().toISOString(),
          source: 'api'
        };

        setData(validatedData);
        setRetryCount(0);

        // Track successful fetch for analytics
        if (window.gtag) {
          window.gtag('event', 'social_proof_data_loaded', {
            total_users: validatedData.totalUsers,
            active_workflows: validatedData.activeWorkflows,
            recent_events: validatedData.recentEvents,
            source: 'api'
          });
        }

        console.log('📊 [SocialProof] Data updated successfully:', validatedData);
      } else {
        throw new Error('Invalid response structure');
      }

    } catch (err) {
      console.warn('⚠️ [SocialProof] Fetch failed:', err.message);
      setError(err.message);
      setRetryCount(prev => prev + 1);
      
      // Keep existing data on error - better UX than showing nothing
      // Only update source to indicate we're using cached data
      setData(prev => ({
        ...prev,
        source: 'cached',
        lastUpdated: prev.lastUpdated // Keep original timestamp
      }));

      // Track fetch failures for debugging
      if (window.gtag) {
        window.gtag('event', 'social_proof_fetch_failed', {
          error_message: err.message,
          retry_count: retryCount + 1
        });
      }
      
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependencies to prevent re-creation
  
  // Store the fetch function in ref for use in effects
  fetchMetricsRef.current = fetchMetrics;

  // Automatic retry with exponential backoff for failed requests
  useEffect(() => {
    if (error && retryCount > 0 && retryCount < 3 && isOnline) {
      const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Max 30s
      console.log(`🔄 [SocialProof] Retrying in ${delay}ms (attempt ${retryCount + 1})`);
      
      const timer = setTimeout(() => {
        fetchMetricsRef.current?.();
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, isOnline]);

  useEffect(() => {
    // Initial fetch - only if online or no cached data
      // Schedule initial fetch during idle time (to avoid blocking first paint)
      const shouldFetch = isOnline || data.source === 'fallback';
      let idleId = null;
      let timerId = null;

      const scheduleInitialFetch = () => {
        // Suppress if another tab/component already started the fetch recently
        if (window.__SOCIAL_PROOF_LOADING__ || (window.__SOCIAL_PROOF_LAST_FETCH__ && Date.now() - window.__SOCIAL_PROOF_LAST_FETCH__ < 30000)) {
          console.log('📊 [SocialProof] Initial fetch suppressed by global guard/cache');
          return;
        }

        // Mark global loading flag so other consumers don't duplicate work
        window.__SOCIAL_PROOF_LOADING__ = true;

        // Trigger the fetch and clear the global flag when done
        Promise.resolve(fetchMetricsRef.current?.()).finally(() => {
          window.__SOCIAL_PROOF_LOADING__ = false;
          window.__SOCIAL_PROOF_LAST_FETCH__ = Date.now();
        });
      };

      if (shouldFetch) {
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
          try {
            idleId = window.requestIdleCallback(scheduleInitialFetch, { timeout: 2000 });
          } catch (e) {
            // Some environments may throw; fallback to timeout
            timerId = setTimeout(scheduleInitialFetch, 1000);
          }
        } else {
          timerId = setTimeout(scheduleInitialFetch, 1000);
        }
      }

      // Set up refresh interval if specified and online
      if (refreshInterval > 0 && isOnline) {
        const interval = setInterval(() => {
          if (navigator.onLine) {
            fetchMetricsRef.current?.();
          }
        }, refreshInterval);
      
        return () => {
          if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(idleId);
          }
          if (timerId) clearTimeout(timerId);
          clearInterval(interval);
        };
      }

      return () => {
        if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
        if (timerId) clearTimeout(timerId);
      };
  }, [refreshInterval, isOnline, data.source]); // Remove fetchMetrics dependency

  // Manually trigger refresh
  const refresh = useCallback(() => {
    if (!isOnline) {
      console.log('📡 [SocialProof] Cannot refresh while offline');
      return;
    }
    
    setRetryCount(0);
    setError(null);
    fetchMetricsRef.current?.();
  }, [isOnline]);

  // Get status message for UI
  const getStatusMessage = useCallback(() => {
    if (!isOnline) {
      return 'Showing offline data';
    }
    if (error) {
      return `Error: ${error}`;
    }
    if (loading) {
      return 'Loading...';
    }
    if (data.source === 'cached') {
      return 'Using cached data';
    }
    return 'Live data';
  }, [isOnline, error, loading, data.source]);

  return {
    data,
    loading,
    error,
    refresh,
    retryCount,
    isOnline,
    statusMessage: getStatusMessage(),
    lastUpdated: data.lastUpdated,
    source: data.source
  };
}

export default useSocialProof;