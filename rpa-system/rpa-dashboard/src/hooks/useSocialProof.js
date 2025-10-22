import { useState, useEffect, useCallback } from 'react';

// Custom hook for social proof data with caching and error handling
export function useSocialProof(refreshInterval = 5 * 60 * 1000) { // 5 minutes default
  const [data, setData] = useState({
    totalUsers: 127,
    activeWorkflows: 89,
    recentEvents: 342,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch('/api/social-proof-metrics', {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newData = await response.json();
      
      // Validate data structure
      const validatedData = {
        totalUsers: Number(newData.totalUsers) || 127,
        activeWorkflows: Number(newData.activeWorkflows) || 89,
        recentEvents: Number(newData.recentEvents) || 342,
        lastUpdated: newData.lastUpdated || new Date().toISOString()
      };

      setData(validatedData);

      // Track successful fetch
      if (window.gtag) {
        window.gtag('event', 'social_proof_data_loaded', {
          total_users: validatedData.totalUsers,
          active_workflows: validatedData.activeWorkflows,
          recent_events: validatedData.recentEvents
        });
      }

      console.log('📊 Social proof data updated:', validatedData);

    } catch (err) {
      console.warn('Failed to fetch social proof metrics:', err.message);
      setError(err.message);
      
      // Keep existing data on error, don't reset to fallbacks
      // This provides better UX - stale data is better than no data
      
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchMetrics();

    // Set up refresh interval if specified
    if (refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, refreshInterval]);

  // Manually trigger refresh
  const refresh = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated: data.lastUpdated
  };
}