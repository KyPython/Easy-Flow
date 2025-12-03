import axios from 'axios';
import supabase, { initSupabase } from './supabaseClient';
import { apiErrorHandler } from './errorHandler';

// Trace context management for frontend
class TraceContext {
  constructor() {
    this.currentTraceId = null;
    this.currentRequestId = null;
    this.sessionTraceId = this.generateTraceId();
  }

  generateTraceId() {
    // Generate W3C-compatible trace ID (32 hex chars)
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  generateSpanId() {
    // Generate W3C-compatible span ID (16 hex chars)
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  generateTraceparent() {
    const version = '00';
    const traceId = this.sessionTraceId; // Use session-level trace ID
    const spanId = this.generateSpanId(); // New span for each request
    const flags = '01'; // sampled
    
    return `${version}-${traceId}-${spanId}-${flags}`;
  }

  getTraceHeaders() {
    const traceparent = this.generateTraceparent();
    const requestId = `req_${this.sessionTraceId.substring(0, 12)}_${Date.now()}`;
    
    // Store for potential correlation logging
    this.currentTraceId = this.sessionTraceId;
    this.currentRequestId = requestId;
    
    return {
      'traceparent': traceparent,
      'x-trace-id': this.sessionTraceId,
      'x-request-id': requestId
    };
  }

  // For correlating frontend events with backend traces
  getCurrentContext() {
    return {
      traceId: this.currentTraceId,
      requestId: this.currentRequestId,
      sessionTraceId: this.sessionTraceId
    };
  }
}

// Global trace context instance
const traceContext = new TraceContext();

// Use absolute backend URL in production via REACT_APP_API_BASE.
// In local dev (CRA), keep it relative to leverage the proxy.
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE || '',
  timeout: 30000,
});

// Default to not sending cookies from the SPA. We rely on PKCE + localStorage tokens
// for auth and avoid credentialed cross-origin requests which trigger CORS preflight issues.
api.defaults.withCredentials = false;
// Expose api globally for debugging in all environments (harmless; same-origin only)
if (typeof window !== 'undefined') {
  if (!window._api) {
    Object.defineProperty(window, '_api', { value: api, writable: false, configurable: false });
    // eslint-disable-next-line no-console
    console.info('[api] baseURL (init)', api.defaults.baseURL || '(empty)');
  }
}

// Interceptor to add auth token AND trace context to every request
api.interceptors.request.use(
  async (config) => {
    const startTime = Date.now();
    
    try {
      // Add trace headers for observability (CRITICAL for correlation)
      const traceHeaders = traceContext.getTraceHeaders();
      config.headers = {
        ...config.headers,
        ...traceHeaders
      };
      
      // Store timing info for UX metrics
      config.metadata = { 
        startTime,
        traceContext: traceContext.getCurrentContext()
      };

      // Get Supabase session token from localStorage
      try {
            let token = null;
            let tokenKeyFound = null;

            // Helper: try parse a JSON value and extract common token fields
            const extractFromValue = (val) => {
              if (!val) return null;
              // Raw token
              if (typeof val === 'string' && val.split && val.split('.').length === 3) return val;
              try {
                const parsed = JSON.parse(val);
                return parsed?.access_token || parsed?.token || parsed?.accessToken || parsed?.jwt || null;
              } catch (e) {
                return null;
              }
            };

            // 1. Development overrides
            token = process.env.REACT_APP_DEV_TOKEN || (typeof localStorage !== 'undefined' && localStorage.getItem('dev_token')) || null;
            if (token) tokenKeyFound = tokenKeyFound || (process.env.REACT_APP_DEV_TOKEN ? 'REACT_APP_DEV_TOKEN' : 'dev_token');

            // 2. Supabase session object (sb-auth-token) or other common keys
            if (!token && typeof localStorage !== 'undefined') {
              const candidateKeys = ['sb-auth-token', 'supabase-auth-token', 'sb_access_token', 'authToken', 'token', 'supabase.session'];
              for (const key of candidateKeys) {
                const val = localStorage.getItem(key);
                const extracted = extractFromValue(val);
                if (extracted) {
                  token = extracted;
                  tokenKeyFound = key;
                  break;
                }
              }
            }

            // 3. Defensive: if still not found, check other common localStorage entries
            if (!token && typeof localStorage !== 'undefined') {
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (!key) continue;
                  if (['sb-auth-token','supabase-auth-token','dev_token','authToken','token'].includes(key)) continue;
                  const val = localStorage.getItem(key);
                  const extracted = extractFromValue(val);
                  if (extracted) {
                    token = extracted;
                    tokenKeyFound = key;
                    break;
                  }
                }
              } catch (e) {
                // ignore storage read errors
              }
            }

            // Add token to Authorization header if found
            if (token && token !== 'null' && token !== 'undefined') {
              config.headers['Authorization'] = `Bearer ${token}`;
            }

            // DEV: show which storage key provided the token (never log the token itself)
            if (process.env.NODE_ENV === 'development') {
              if (tokenKeyFound) {
                console.debug(`[api] Using token from localStorage key: ${tokenKeyFound}`);
              } else {
                console.debug('[api] No token found in localStorage for request - Authorization header will not be set');
              }
            }
      } catch (e) {
        // localStorage may be unavailable; ignore and continue without auth header
      }

      // Log API request initiation (structured)
      if (process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify({
          level: 'debug',
          message: 'API request initiated',
          method: config.method?.toUpperCase(),
          url: config.url,
          traceId: traceHeaders['x-trace-id'],
          requestId: traceHeaders['x-request-id'],
          timestamp: new Date().toISOString()
        }));
      }

    } catch (error) {
      console.warn('[api] Failed to get auth token:', error.message);
      // Try development/local tokens as fallback (defensive)
      try {
        const fallback = [process.env.REACT_APP_DEV_TOKEN, localStorage.getItem('dev_token'), localStorage.getItem('authToken'), localStorage.getItem('token')]
          .map((t) => (typeof t === 'string' ? t.trim() : t))
          .find((t) => t && t !== 'null' && t !== 'undefined');
        if (fallback) config.headers['Authorization'] = `Bearer ${fallback}`;
      } catch (e) {
        // localStorage may be unavailable in some environments (SSR/tests)
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with UX metrics and error handling
let isRefreshing = false;
let queued = [];
let lastRefreshAttempt = 0;

api.interceptors.response.use(
  (response) => {
    // Calculate and log UX metrics (Rule 2: Granularity)
    const endTime = Date.now();
    const { startTime, traceContext: reqTraceContext } = response.config.metadata || {};
    
    if (startTime) {
      const duration = endTime - startTime;
      const traceHeaders = {
        backendTraceId: response.headers['x-trace-id'],
        backendRequestId: response.headers['x-request-id'],
        frontendTraceId: reqTraceContext?.traceId,
        frontendRequestId: reqTraceContext?.requestId
      };
      
      // Log successful API response with correlation (structured JSON)
      if (process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify({
          level: 'info',
          message: 'API response received',
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          duration_ms: duration,
          ...traceHeaders,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Track UX metrics for monitoring (could integrate with analytics)
      if (window.performance && window.performance.mark) {
        window.performance.mark(`api-response-${reqTraceContext?.requestId}`);
      }
      
      // Store metrics for potential dashboard display
      if (!window._apiMetrics) window._apiMetrics = [];
      window._apiMetrics.push({
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
        duration: duration,
        timestamp: endTime,
        ...traceHeaders
      });
      
      // Keep only last 100 entries
      if (window._apiMetrics.length > 100) {
        window._apiMetrics = window._apiMetrics.slice(-100);
      }
    }
    
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    
    // Calculate error metrics with correlation context
    const endTime = Date.now();
    const { startTime, traceContext: reqTraceContext } = error.config?.metadata || {};
    
    if (startTime) {
      const duration = endTime - startTime;
      const traceHeaders = {
        backendTraceId: error.response?.headers?.['x-trace-id'],
        backendRequestId: error.response?.headers?.['x-request-id'], 
        frontendTraceId: reqTraceContext?.traceId,
        frontendRequestId: reqTraceContext?.requestId
      };
      
      // Structured error logging with full correlation context
      console.error(JSON.stringify({
        level: 'error',
        message: 'API request failed',
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: status || 0,
        duration_ms: duration,
        error: {
          message: error.message,
          code: error.code,
          response_data: error.response?.data
        },
        ...traceHeaders,
        timestamp: new Date().toISOString()
      }));
      
      // Track error metrics
      if (!window._apiErrors) window._apiErrors = [];
      window._apiErrors.push({
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: status || 0,
        duration: duration,
        error: error.message,
        timestamp: endTime,
        ...traceHeaders
      });
      
      // Keep only last 50 error entries
      if (window._apiErrors.length > 50) {
        window._apiErrors = window._apiErrors.slice(-50);
      }
    }
    
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
          const client = await initSupabase();
          await client.auth.refreshSession();
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

      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        error.config.headers['Authorization'] = `Bearer ${session.access_token}`;
        error.config.__isRetry = true;
        return api.request(error.config);
      }
    } catch (e) {
      // fall through
    }
    // Unrecoverable 401: clear local tokens and redirect to login (browser only, skip during tests)
    try {
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
        try {
          localStorage.removeItem('dev_token');
          localStorage.removeItem('authToken');
          localStorage.removeItem('token');
        } catch (e) {
          // ignore localStorage failures (SSR/tests or restricted envs)
        }

        try {
          const client = await initSupabase();
          if (client?.auth?.signOut) await client.auth.signOut();
        } catch (e) {
          // ignore signOut failures
        }

        if (!(original?.url || '').includes('/api/auth/session')) {
          // Dispatch a global event so the app can show a UX before redirecting.
          try {
            const ev = new CustomEvent('easyflow:session-expired', {
              detail: { redirect: '/login', message: 'Your session expired. Please sign in again.', countdown: 8 }
            });
            // Clear tokens first
            window.dispatchEvent(ev);
            // Fallback: if no handler marks the session handled, redirect after 8s
            setTimeout(() => {
              if (!window.__easyflowSessionHandled) {
                window.__easyflowSessionHandled = true;
                window.location.replace('/login');
              }
            }, 8000);
          } catch (e) {
            // If events aren't supported, do best-effort redirect
            try { window.location.replace('/login'); } catch{ /* ignore */ }
          }
        }
      }
    } catch (e) {
      // defensive: swallow any redirect/clear errors
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

// Generic request helper with AbortController + retry/backoff.
// Returns the axios response object.
export async function requestWithRetry(requestConfig, options = {}) {
  const { retries = 2, backoffMs = 500, timeout = api.defaults.timeout || 30000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller && timeout ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const cfg = {
        ...requestConfig,
        timeout,
        signal: controller ? controller.signal : undefined
      };

      const resp = await api.request(cfg);
      if (timer) clearTimeout(timer);
      return resp;
    } catch (err) {
      if (timer) clearTimeout(timer);

      const status = err?.response?.status;
      const isNetwork = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout') || err.name === 'AbortError';
      const isServerError = status && status >= 500 && status < 600;

      const willRetry = attempt < retries && (isNetwork || isTimeout || isServerError);

      if (!willRetry) {
        throw err;
      }

      const wait = backoffMs * Math.pow(2, attempt);
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[api] retrying request (${attempt + 1}/${retries}) after ${wait}ms due to error:`, err.message || err.code || status);
      }
      await new Promise((res) => setTimeout(res, wait));
      // continue to next attempt
    }
  }
}

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
      const { data } = await api.post('/shared/access', { token, password });
      return data;
    },
    {
      endpoint: 'shared/access',
      retries: 2
    }
  );
};

// Export trace context for use in components/hooks that need correlation
export { traceContext };

// Helper function for components to get current trace info
export const getCurrentTraceInfo = () => traceContext.getCurrentContext();

// Helper for manual correlation logging in components
export const logWithTraceContext = (level, message, additionalData = {}) => {
  const context = traceContext.getCurrentContext();
  const logEntry = {
    level,
    message,
    ...context,
    ...additionalData,
    timestamp: new Date().toISOString()
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
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
// Small in-memory cache to avoid duplicate social-proof calls during startup bursts
let _socialProofCache = { value: null, expiresAt: 0 };
const SOCIAL_PROOF_TTL = 30 * 1000; // 30 seconds

export const getSocialProofMetrics = async () => {
  const now = Date.now();
  if (_socialProofCache.value && _socialProofCache.expiresAt > now) {
    return _socialProofCache.value;
  }

  const result = await apiErrorHandler.safeApiCall(
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

  if (result) {
    _socialProofCache.value = result;
    _socialProofCache.expiresAt = Date.now() + SOCIAL_PROOF_TTL;
  }

  return result;
};
