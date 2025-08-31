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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${session.access_token}`,
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Task Management ---
export const getTasks = async () => {
  try {
    const { data } = await api.get('/api/tasks');
    return data;
  } catch (e) {
    console.error('getTasks failed:', e?.message || e);
    alert('Unable to load tasks. Please try again later.');
    throw e;
  }
};

export const createTask = async (taskData) => {
  try {
    const { data } = await api.post('/api/tasks', taskData);
    return data;
  } catch (e) {
    console.error('createTask failed:', e?.message || e);
    alert('Could not create task. Please check your input and try again.');
    throw e;
  }
};

export const runTask = async (taskId) => {
  try {
    const { data } = await api.post(`/api/tasks/${taskId}/run`);
    return data;
  } catch (e) {
    console.error('runTask failed:', e?.message || e);
    alert('Failed to run the task. Please try again.');
    throw e;
  }
};

export const getRuns = async () => {
  try {
    const { data } = await api.get('/api/runs');
    return data;
  } catch (e) {
    console.error('getRuns failed:', e?.message || e);
    alert('Unable to load runs. Please try again later.');
    throw e;
  }
};

export const getDashboardData = async () => {
  try {
    const { data } = await api.get('/api/dashboard');
    return data;
  } catch (e) {
    console.error('getDashboardData failed:', e?.message || e);
    alert('Unable to load dashboard data. Please refresh or try again later.');
    throw e;
  }
};

export const editTask = async (taskId, taskData) => {
  try {
    const { data } = await api.put(`/api/tasks/${taskId}`, taskData);
    return data;
  } catch (e) {
    console.error('editTask failed:', e?.message || e);
    alert('Could not update the task. Please check your changes and try again.');
    throw e;
  }
};

export const deleteTask = async (taskId) => {
  try {
    await api.delete(`/api/tasks/${taskId}`);
  } catch (e) {
    console.error('deleteTask failed:', e?.message || e);
    alert('Failed to delete the task. Please try again.');
    throw e;
  }
};

export const getPlans = async () => {
  try {
    const { data } = await api.get('/api/plans');
    return data;
  } catch (e) {
    console.error('getPlans failed:', e?.message || e);
    alert('Unable to load plans. Please try again later.');
    throw e;
  }
};

export const getSubscription = async () => {
  try {
    const { data } = await api.get('/api/subscription');
    return data;
  } catch (e) {
    console.error('getSubscription failed:', e?.message || e);
    alert('Unable to load subscription details. Please try again later.');
    throw e;
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

export async function generateReferral() {
  try {
    const resp = await api.post('/api/generate-referral');
    return resp.data;
  } catch (e) {
    console.warn('generateReferral failed', e?.message || e);
    alert('Unable to generate referral link. Please try again later.');
    return null;
  }
}

export async function triggerCampaign(payload) {
  try {
    const resp = await api.post('/api/trigger-campaign', payload || {});
    return resp.data;
  } catch (e) {
    console.warn('triggerCampaign failed', e?.message || e);
    alert('Unable to trigger campaign. Please try again later.');
    return null;
  }
}


// --- Payments & Subscriptions -------------------------------------------------
export async function createCheckoutSession(planId) {
  try {
    const resp = await api.post('/api/create-checkout-session', { planId });
    return resp.data;
  } catch (e) {
    console.error('createCheckoutSession failed', e?.message || e);
    alert('Unable to start checkout. Please try again later.');
    return null;
  }
}
