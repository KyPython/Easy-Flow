import axios from 'axios';
import { supabase } from './supabaseClient';

// Use absolute backend URL in production via REACT_APP_API_BASE.
// In local dev (CRA), keep it relative to leverage the proxy.
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || '',
  timeout: 15000,
});

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

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status;
    if (status !== 401) return Promise.reject(error);

    // If request already retried once, give up
    if (error.config.__isRetry) return Promise.reject(error);

    try {
      if (!isRefreshing) {
        isRefreshing = true;
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
