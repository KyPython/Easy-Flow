import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export function useAnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get('/api/roi-analytics/dashboard')
      .then((res) => {
        if (mounted) {
          setData(res.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { data, loading, error };
}
