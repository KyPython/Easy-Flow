import axios from 'axios';

// Use absolute backend URL in production via REACT_APP_API_BASE.
// In local dev (CRA), keep it relative to leverage the proxy.
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || '',
  timeout: 15000,
});

// Attach optional x-api-key header when REACT_APP_API_KEY is set
api.interceptors.request.use((config) => {
  const key = process.env.REACT_APP_API_KEY;
  if (key) {
    config.headers = config.headers || {};
    config.headers['x-api-key'] = key;
  }
  return config;
});

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
