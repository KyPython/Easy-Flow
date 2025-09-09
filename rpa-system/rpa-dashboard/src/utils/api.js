import axios from 'axios';
import { supabase } from './supabaseClient';

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
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session?.access_token && !error) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Basic 401 retry logic: attempt a refresh once, then retry original request.
let isRefreshing = false;
let queued = [];
let lastRefreshAttempt = 0; // epoch ms timestamp to throttle refresh attempts

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status;
    if (status !== 401) return Promise.reject(error);

    // Surface backend diagnostic header if present
    const reason = error?.response?.headers?.['x-auth-reason'];
    if (reason) {
      // eslint-disable-next-line no-console
      console.warn('[api] 401 x-auth-reason:', reason, 'url:', error.config?.url);
    }

    const original = error.config || {};

    // If the request already had an auth header and the endpoint is user/preferences, don't spam refresh.
    if (original?.url?.includes('/api/user/preferences')) {
      // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
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

// --- Task Management ---
export const getTasks = async () => {
  try {
    const { data } = await api.get('/api/tasks');
    return data;
  } catch (e) {
    console.error('getTasks failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load tasks. Please try again later.'));
  }
};

// taskData should include { url, title, notes, type }
export const createTask = async (taskData) => {
  try {
    const { data } = await api.post('/api/tasks', taskData);
    return data;
  } catch (e) {
    console.error('createTask failed:', e);
    throw new Error(getErrorMessage(e, 'Could not create task. Please check your input and try again.'));
  }
};

export const runTask = async (taskId) => {
  try {
    const { data } = await api.post(`/api/tasks/${taskId}/run`);
    return data;
  } catch (e) {
    console.error('runTask failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to run the task. Please try again.'));
  }
};

export const getRuns = async () => {
  try {
    const { data } = await api.get('/api/runs');
    return data;
  } catch (e) {
    console.error('getRuns failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load runs. Please try again later.'));
  }
};

export const getDashboardData = async () => {
  try {
    const { data } = await api.get('/api/dashboard');
    return data;
  } catch (e) {
    console.error('getDashboardData failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load dashboard data. Please refresh or try again later.'));
  }
};

export const editTask = async (taskId, taskData) => {
  try {
    const { data } = await api.put(`/api/tasks/${taskId}`, taskData);
    return data;
  } catch (e) {
    console.error('editTask failed:', e);
    throw new Error(getErrorMessage(e, 'Could not update the task. Please check your changes and try again.'));
  }
};

export const deleteTask = async (taskId) => {
  try {
    await api.delete(`/api/tasks/${taskId}`);
  } catch (e) {
    console.error('deleteTask failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to delete the task. Please try again.'));
  }
};

export const getPlans = async () => {
  try {
    const { data } = await api.get('/api/plans');
    return data;
  } catch (e) {
    console.error('getPlans failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load plans. Please try again later.'));
  }
};

export const getSubscription = async () => {
  try {
    const { data } = await api.get('/api/subscription');
    return data;
  } catch (e) {
    console.error('getSubscription failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load subscription details. Please try again later.'));
  }
};

// Convenience helpers used by the app for marketing/engagement
export async function trackEvent(payload) {
  try {
    await api.post('/api/track-event', payload);
  } catch (e) {
    // non-fatal; surface to console for debugging
    console.warn('trackEvent failed', e?.message || e);
    // No alert: tracking is non-critical for user
  }
}

export async function generateReferral(referrerEmail, referredEmail) {
  try {
    const resp = await api.post('/api/generate-referral', { referrerEmail, referredEmail });
    return resp.data;
  } catch (e) {
    console.error('generateReferral failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to send referral. Please try again later.'));
  }
}

export async function triggerCampaign(payload) {
  try {
    const resp = await api.post('/api/trigger-campaign', payload || {});
    return resp.data;
  } catch (e) {
    console.warn('triggerCampaign failed', e?.message || e);
    // Note: Replaced alert() with a console log.
    console.error('Unable to trigger campaign. Please try again later.');
    return null;
  }
}

// --- File Management Functions ---
export const uploadFile = async (file, options = {}) => {
  try {
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
    });
    return data;
  } catch (e) {
    console.error('uploadFile failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to upload file. Please try again.'));
  }
};

export const getFiles = async (options = {}) => {
  try {
    const params = new URLSearchParams();
    if (options.folder) params.append('folder', options.folder);
    if (options.search) params.append('search', options.search);
    if (options.tags) params.append('tags', Array.isArray(options.tags) ? options.tags.join(',') : options.tags);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    const { data } = await api.get(`/api/files?${params.toString()}`);
    return data;
  } catch (e) {
    console.error('getFiles failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to load files. Please refresh or try again later.'));
  }
};

export const getFileDownloadUrl = async (fileId) => {
  try {
    const { data } = await api.get(`/api/files/${fileId}/download`);
    return data;
  } catch (e) {
    console.error('getFileDownloadUrl failed:', e);
    throw new Error(getErrorMessage(e, 'Unable to generate download link. Please try again.'));
  }
};

export const deleteFile = async (fileId) => {
  try {
    const { data } = await api.delete(`/api/files/${fileId}`);
    return data;
  } catch (e) {
    console.error('deleteFile failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to delete file. Please try again.'));
  }
};

export const updateFileMetadata = async (fileId, metadata) => {
  try {
    const { data } = await api.put(`/api/files/${fileId}`, metadata);
    return data;
  } catch (e) {
    console.error('updateFileMetadata failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to update file. Please try again.'));
  }
};

// --- File Sharing Functions ---
export const createFileShare = async (shareData) => {
  try {
    const { data } = await api.post('/api/files/shares', shareData);
    return data;
  } catch (e) {
    console.error('createFileShare failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to create share link. Please try again.'));
  }
};

export const getFileShares = async (fileId) => {
  try {
    const { data } = await api.get(`/api/files/${fileId}/shares`);
    return data;
  } catch (e) {
    console.error('getFileShares failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to load share links. Please try again.'));
  }
};

export const updateFileShare = async (shareId, updates) => {
  try {
    const { data } = await api.put(`/api/files/shares/${shareId}`, updates);
    return data;
  } catch (e) {
    console.error('updateFileShare failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to update share link. Please try again.'));
  }
};

export const deleteFileShare = async (shareId) => {
  try {
    const { data } = await api.delete(`/api/files/shares/${shareId}`);
    return data;
  } catch (e) {
    console.error('deleteFileShare failed:', e);
    throw new Error(getErrorMessage(e, 'Failed to delete share link. Please try again.'));
  }
};

export const getSharedFile = async (token, password = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/shared/access`, {
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
  } catch (error) {
    console.error('Error accessing shared file:', error);
    throw error;
  }
};

// Helper function to get share URL
export const getShareUrl = (token) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/shared/${token}`;
};
