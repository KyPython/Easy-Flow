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

// Example: Axios interceptor
// (Removed duplicate import and api definition)

// --- Task Management ---
export const getTasks = async () => {
  const { data } = await api.get('/api/tasks');
  return data;
};

export const createTask = async (taskData) => {
  const { data } = await api.post('/api/tasks', taskData);
  return data;
};

export const runTask = async (taskId) => {
  const { data } = await api.post(`/api/tasks/${taskId}/run`);
  return data;
};

export const getRuns = async () => {
  const { data } = await api.get('/api/runs');
  return data;
};

export const getDashboardData = async () => {
  const { data } = await api.get('/api/dashboard');
  return data;
};

export const editTask = async (taskId, taskData) => {
  const { data } = await api.put(`/api/tasks/${taskId}`, taskData);
  return data;
};

export const deleteTask = async (taskId) => {
  await api.delete(`/api/tasks/${taskId}`);
};

export const getPlans = async () => {
  const { data } = await api.get('/api/plans');
  return data;
};

export const getSubscription = async () => {
  const { data } = await api.get('/api/subscription');
  return data;
};


// Convenience helpers used by the app for marketing/engagement
export async function trackEvent(payload) {
  try {
    await api.post('/api/track-event', payload);
  } catch (e) {
    // non-fatal; surface to console for debugging
    console.warn('trackEvent failed', e?.message || e);
  }
}

export async function generateReferral() {
  try {
    const resp = await api.post('/api/generate-referral');
    return resp.data;
  } catch (e) {
    console.warn('generateReferral failed', e?.message || e);
    return null;
  }
}

export async function triggerCampaign(payload) {
  try {
    const resp = await api.post('/api/trigger-campaign', payload || {});
    return resp.data;
  } catch (e) {
    console.warn('triggerCampaign failed', e?.message || e);
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
    return null;
  }
}
