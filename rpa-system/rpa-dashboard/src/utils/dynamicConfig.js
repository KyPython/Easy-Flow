/**
 * Dynamic Configuration System
 * 
 * Centralizes all configuration values that should be environment-aware and non-hardcoded.
 * All timeouts, intervals, thresholds, and URLs are configurable via environment variables
 * with sensible defaults that adapt to the environment.
 */

import { isDevelopment, isProduction } from './envAwareMessages';

/**
 * Get environment variable with fallback
 */
const getEnv = (name, defaultValue = undefined) => {
  // Runtime injection (window._env)
  if (typeof window !== 'undefined' && window._env && window._env[name]) {
    return window._env[name];
  }
  
  // Build-time (process.env)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  
  return defaultValue;
};

/**
 * Parse integer from environment variable
 */
const getEnvInt = (name, defaultValue) => {
  const value = getEnv(name);
  if (value === undefined || value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parse boolean from environment variable
 */
const getEnvBool = (name, defaultValue) => {
  const value = getEnv(name);
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const dev = isDevelopment();
const prod = isProduction();

/**
 * Dynamic Configuration Object
 * All values are environment-aware and configurable
 */
export const dynamicConfig = {
  // ========== API Configuration ==========
  api: {
    baseUrl: getEnv('REACT_APP_API_BASE') || getEnv('VITE_API_BASE') || 
            (dev ? `http://localhost:${getEnvInt('REACT_APP_BACKEND_PORT', 3030)}` : ''),
    timeout: getEnvInt('REACT_APP_API_TIMEOUT', prod ? 45000 : 20000), // Longer in prod for slower networks
    retries: getEnvInt('REACT_APP_API_RETRIES', 2),
    backoffMs: getEnvInt('REACT_APP_API_BACKOFF_MS', 500),
  },

  // ========== Backend Ports ==========
  ports: {
    backend: getEnvInt('REACT_APP_BACKEND_PORT', 3030),
    frontend: getEnvInt('REACT_APP_FRONTEND_PORT', 3000),
    automation: getEnvInt('REACT_APP_AUTOMATION_PORT', 7070),
    metrics: getEnvInt('REACT_APP_METRICS_PORT', 9091),
  },

  // ========== Timeouts & Intervals ==========
  timeouts: {
    // API request timeout (consumer-friendly in prod, dev-friendly in dev)
    api: getEnvInt('REACT_APP_API_TIMEOUT', prod ? 45000 : 20000),
    
    // Loading timeout (UI feedback)
    loading: getEnvInt('REACT_APP_LOADING_TIMEOUT', prod ? 60000 : 30000),
    
    // Real-time connection timeout
    realtime: getEnvInt('REACT_APP_REALTIME_TIMEOUT', prod ? 30000 : 15000),
    
    // Circuit breaker timeout
    circuitBreaker: getEnvInt('REACT_APP_CIRCUIT_BREAKER_TIMEOUT', 60000),
  },

  intervals: {
    // Polling interval (background refresh)
    polling: getEnvInt('REACT_APP_POLLING_INTERVAL', prod ? 10000 : 5000),
    
    // Status refresh interval
    statusRefresh: getEnvInt('REACT_APP_STATUS_REFRESH_INTERVAL', 30000),
    
    // Queue status refresh
    queueStatus: getEnvInt('REACT_APP_QUEUE_STATUS_INTERVAL', 10000),
    
    // Dashboard refresh
    dashboard: getEnvInt('REACT_APP_DASHBOARD_REFRESH_INTERVAL', 30000),
  },

  // ========== Thresholds ==========
  thresholds: {
    // Stuck task threshold (hours)
    stuckTaskHours: getEnvInt('REACT_APP_STUCK_TASK_HOURS', 24),
    
    // Slow query threshold (ms)
    slowQuery: getEnvInt('REACT_APP_SLOW_QUERY_THRESHOLD', prod ? 5000 : 3000),
    
    // Queue stuck threshold (minutes)
    queueStuckMinutes: getEnvInt('REACT_APP_QUEUE_STUCK_MINUTES', 10),
    
    // Realtime retry max attempts
    realtimeMaxRetries: getEnvInt('REACT_APP_REALTIME_MAX_RETRIES', 5),
    
    // Realtime backoff max delay (ms)
    realtimeMaxBackoff: getEnvInt('REACT_APP_REALTIME_MAX_BACKOFF_MS', 30000),
  },

  // ========== Observability ==========
  observability: {
    // Log sampling rate (1 = all logs, 10 = 10%, 100 = 1%)
    logSampleRate: getEnvInt('REACT_APP_LOG_SAMPLE_RATE', prod ? 100 : 1),
    
    // Telemetry throttle (ms between sends)
    telemetryThrottle: getEnvInt('REACT_APP_TELEMETRY_THROTTLE_MS', 5000),
    
    // Enable observability integration
    enabled: getEnvBool('REACT_APP_OBSERVABILITY_ENABLED', true),
    
    // Frontend logs endpoint
    frontLogsEndpoint: getEnv('REACT_APP_FRONT_LOGS_ENDPOINT', '/api/internal/front-logs'),
  },

  // ========== Feature Flags ==========
  features: {
    realtime: getEnvBool('REACT_APP_ENABLE_REALTIME', true),
    polling: getEnvBool('REACT_APP_ENABLE_POLLING', true),
    firebase: getEnvBool('REACT_APP_ENABLE_FIREBASE', true),
    analytics: getEnvBool('REACT_APP_ENABLE_ANALYTICS', prod),
    debugging: dev,
  },

  // ========== Environment Info ==========
  environment: {
    isDevelopment: dev,
    isProduction: prod,
    nodeEnv: process.env.NODE_ENV || 'development',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
  },
};

/**
 * Get configuration value by path
 * Example: getConfig('api.timeout') or getConfig('timeouts.loading')
 */
export const getConfig = (path, defaultValue = undefined) => {
  const keys = path.split('.');
  let value = dynamicConfig;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
};

/**
 * Update configuration at runtime (for testing or dynamic updates)
 */
export const updateConfig = (path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let target = dynamicConfig;
  
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }
  
  target[lastKey] = value;
};

// Log configuration in development
if (dev) {
  console.log('🔧 Dynamic Configuration:', {
    api: dynamicConfig.api,
    timeouts: dynamicConfig.timeouts,
    intervals: dynamicConfig.intervals,
    thresholds: dynamicConfig.thresholds,
    observability: {
      enabled: dynamicConfig.observability.enabled,
      sampleRate: dynamicConfig.observability.logSampleRate,
    },
    features: dynamicConfig.features,
    environment: dynamicConfig.environment,
  });
}

export default dynamicConfig;

