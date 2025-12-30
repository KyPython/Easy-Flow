import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { getConfig } from '../utils/dynamicConfig';

export function useAnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/roi-analytics/dashboard');
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Initial load
    setLoading(true);
    fetchData();

    // Auto-refresh every 30 seconds (configurable)
    const refreshInterval = getConfig('intervals.analyticsRefresh', 30000);
    const interval = setInterval(() => {
      if (mounted) {
        fetchData();
      }
    }, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
