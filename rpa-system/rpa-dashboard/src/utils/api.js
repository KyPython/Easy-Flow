import axios from 'axios';
import { supabase } from './supabaseClient';
import { apiErrorHandler } from './errorHandler';

// Use absolute backend URL in production via REACT_APP_API_BASE.
// In local dev (CRA), keep it relative to leverage the proxy.
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || '',
  timeout: 15000,
});

// Expose api globally for debugging in all environments (harmless; same-origin only)
if (typeof window !== 'undefined') {
  if (!window._api) {
    Object.defineProperty(window, '_api', { value: api, writable: false, configurable: false });
    // eslint-disable-next-line no-console
    console.info('[api] baseURL (init)', api.defaults.baseURL || '(empty)');
  }
}

// Interceptor to add the Supabase auth token to every request
api.interceptors.request.use(
  async (config) => {
    // Asynchronously get the latest session.
    // supabase-js handles token refreshing automatically.
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session?.access_token && !error) {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.warn('[api] Failed to get session for auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with error handling
let isRefreshing = false;
let queued = [];
let lastRefreshAttempt = 0;

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status;
    
    // Development: log failing requests for debugging
    if (process.env.NODE_ENV === 'development') {
      const method = (error?.config?.method || 'get').toUpperCase();
      const url = error?.config?.url || '(unknown)';
      const code = status ?? '(no-status)';
      console.warn(`[api] ${method} ${url} failed`, { status: code, message: error?.message });
    }

    // Handle different error types
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('[api] Request timeout detected');
    }
    
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      console.warn('[api] Network error detected');
    }

    // Only handle 401s for auth refresh
    if (status !== 401) {
      return Promise.reject(error);
    }

    // Surface backend diagnostic header if present
    const reason = error?.response?.headers?.['x-auth-reason'];
    if (reason) {
      console.warn('[api] 401 x-auth-reason:', reason, 'url:', error.config?.url);
    }

    const original = error.config || {};

    // If the request already had an auth header and the endpoint is user/preferences, don't spam refresh.
    if (original?.url?.includes('/api/user/preferences')) {
      console.warn('[api] 401 on /api/user/preferences - skipping token refresh retry (likely auth mismatch or backend rejection)');
      return Promise.reject(error);
    }

    // If request already retried once, give up
    if (error.config.__isRetry) return Promise.reject(error);

    try {
      const now = Date.now();
      const throttleWindowMs = 30000; // 30s window between global refresh attempts

      if (!isRefreshing && (now - lastRefreshAttempt) > throttleWindowMs) {
        isRefreshing = true;
        lastRefreshAttempt = now;
        // Force a refresh (Supabase v2 automatically refreshes, but we request explicitly)
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
          console.warn('Token refresh failed', e?.message || e);
        } finally {
          isRefreshing = false;
          queued.forEach(fn => fn());
          queued = [];
        }
      } else {
        await new Promise(res => queued.push(res));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        error.config.headers['Authorization'] = `Bearer ${session.access_token}`;
        error.config.__isRetry = true;
        return api.request(error.config);
      }
    } catch (e) {
      // fall through
    }
    return Promise.reject(error);
  }
);

const getErrorMessage = (error, defaultMessage = 'An unexpected error occurred.') => {
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error;
  }
  return error.message || defaultMessage;
};

// --- Robust API Functions with Error Handling ---

export const getTasks = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/tasks');
      return data;
    },
    {
      endpoint: 'tasks',
      fallbackData: { tasks: [], message: 'Unable to load tasks. Using offline mode.' }
    }
  );
};

export const createTask = async (taskData) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.post('/api/tasks', taskData);
      return data;
    },
    {
      endpoint: 'tasks/create',
      retries: 1 // Only retry once for mutations
    }
  );
};

export const runTask = async (taskId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.post(`/api/tasks/${taskId}/run`);
      return data;
    },
    {
      endpoint: 'tasks/run',
      retries: 0 // Don't retry task runs to avoid duplicates
    }
  );
};

export const getRuns = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/runs');
      return data;
    },
    {
      endpoint: 'runs',
      fallbackData: { runs: [], message: 'Unable to load run history. Using offline mode.' }
    }
  );
};

export const getDashboardData = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/dashboard');
      return data;
    },
    {
      endpoint: 'dashboard',
      fallbackData: {
        stats: { total_tasks: 0, total_runs: 0, success_rate: 0 },
        recent_runs: [],
        message: 'Dashboard data unavailable. Using offline mode.'
      }
    }
  );
};

export const editTask = async (taskId, taskData) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.put(`/api/tasks/${taskId}`, taskData);
      return data;
    },
    {
      endpoint: 'tasks/edit',
      retries: 1
    }
  );
};

export const deleteTask = async (taskId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      await api.delete(`/api/tasks/${taskId}`);
    },
    {
      endpoint: 'tasks/delete',
      retries: 1
    }
  );
};

export const getPlans = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/plans');
      return data;
    },
    {
      endpoint: 'plans',
      fallbackData: {
        plans: [
          { id: 'free', name: 'Free', price: 0, features: ['Basic automation'] },
          { id: 'pro', name: 'Pro', price: 19, features: ['Advanced automation', 'Priority support'] }
        ]
      }
    }
  );
};

export const getSubscription = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/subscription');
      return data;
    },
    {
      endpoint: 'subscription',
      fallbackData: { plan: 'free', status: 'active' }
    }
  );
};

// Enhanced tracking functions that never crash the app
export async function trackEvent(payload) {
  return apiErrorHandler.safeApiCall(
    async () => {
      await api.post('/api/track-event', payload);
    },
    {
      endpoint: 'track-event',
      silentFail: true, // Never throw errors for tracking
      retries: 1
    }
  );
}

export async function generateReferral(referrerEmail, referredEmail) {
  return apiErrorHandler.safeApiCall(
    async () => {
      const resp = await api.post('/api/generate-referral', { referrerEmail, referredEmail });
      return resp.data;
    },
    {
      endpoint: 'referral',
      retries: 1
    }
  );
}

export async function triggerCampaign(payload) {
  return apiErrorHandler.safeApiCall(
    async () => {
      const resp = await api.post('/api/trigger-campaign', payload || {});
      return resp.data;
    },
    {
      endpoint: 'campaign',
      silentFail: true, // Campaign triggers shouldn't crash the app
      retries: 1,
      fallbackData: { success: false, message: 'Campaign trigger unavailable offline' }
    }
  );
}

// --- File Management Functions ---
export const uploadFile = async (file, options = {}) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.folder_path) {
        formData.append('folder_path', options.folder_path);
      }
      if (options.tags && Array.isArray(options.tags)) {
        formData.append('tags', options.tags.join(','));
      }

      const { data } = await api.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Longer timeout for file uploads
      });
      return data;
    },
    {
      endpoint: 'files/upload',
      timeout: 60000,
      retries: 1
    }
  );
};

export const getFiles = async (options = {}) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const params = new URLSearchParams();
      if (options.folder) params.append('folder', options.folder);
      if (options.search) params.append('search', options.search);
      if (options.tags) params.append('tags', Array.isArray(options.tags) ? options.tags.join(',') : options.tags);
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);

      const { data } = await api.get(`/api/files?${params.toString()}`);
      return data;
    },
    {
      endpoint: 'files',
      fallbackData: { files: [], message: 'Files unavailable offline' }
    }
  );
};

export const getFileDownloadUrl = async (fileId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get(`/api/files/${fileId}/download`);
      return data;
    },
    {
      endpoint: 'files/download',
      retries: 2
    }
  );
};

export const deleteFile = async (fileId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.delete(`/api/files/${fileId}`);
      return data;
    },
    {
      endpoint: 'files/delete',
      retries: 1
    }
  );
};

export const updateFileMetadata = async (fileId, metadata) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.put(`/api/files/${fileId}`, metadata);
      return data;
    },
    {
      endpoint: 'files/update',
      retries: 1
    }
  );
};

// --- File Sharing Functions ---
export const createFileShare = async (shareData) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.post('/api/files/shares', shareData);
      return data;
    },
    {
      endpoint: 'files/shares/create',
      retries: 1
    }
  );
};

export const getFileShares = async (fileId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get(`/api/files/${fileId}/shares`);
      return data;
    },
    {
      endpoint: 'files/shares',
      fallbackData: { shares: [] }
    }
  );
};

export const updateFileShare = async (shareId, updates) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.put(`/api/files/shares/${shareId}`, updates);
      return data;
    },
    {
      endpoint: 'files/shares/update',
      retries: 1
    }
  );
};

export const deleteFileShare = async (shareId) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.delete(`/api/files/shares/${shareId}`);
      return data;
    },
    {
      endpoint: 'files/shares/delete',
      retries: 1
    }
  );
};

export const getSharedFile = async (token, password = null) => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const response = await fetch(`${api.defaults.baseURL || ''}/shared/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to access shared file');
      }

      return await response.json();
    },
    {
      endpoint: 'shared/access',
      retries: 2
    }
  );
};

// Helper function to get share URL
export const getShareUrl = (token) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/shared/${token}`;
};

// Utility function to get user plan with robust error handling
export const getUserPlan = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/user/plan');
      return data;
    },
    {
      endpoint: 'user/plan',
      silentFail: true,
      fallbackData: {
        plan: 'free',
        features: ['basic-automation', 'limited-workflows'],
        limits: { workflows: 10, monthly_executions: 100 },
        usage: { workflows: 0, monthly_executions: 0 }
      }
    }
  );
};

// Utility function to get social proof metrics
export const getSocialProofMetrics = async () => {
  return apiErrorHandler.safeApiCall(
    async () => {
      const { data } = await api.get('/api/social-proof-metrics');
      return data;
    },
    {
      endpoint: 'social-proof-metrics',
      silentFail: true,
      fallbackData: {
        metrics: {
          totalUsers: 1250,
          activeToday: 68,
          conversions: 32,
          conversionRate: '2.6%'
        }
      }
    }
  );
};
