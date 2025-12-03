/**
 * Frontend Structured Logger
 * Integrates with the observability pipeline:
 * - Structured JSON logging with trace context
 * - Sends logs to backend /internal/front-logs endpoint
 * - Batches logs for efficiency
 * - Falls back to console in case of network issues
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3030';
const CONFIG = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  endpoint: `${API_BASE}/internal/front-logs`,
  enableRemote: true
};

// Log buffer for batching
let logBuffer = [];
let flushTimer = null;

/**
 * Get current trace context from window if available
 */
function getTraceContext() {
  try {
    // Try to get from api.js traceContext if available
    if (window._currentTraceContext) {
      return window._currentTraceContext;
    }
    return {
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  } catch (e) {
    return {};
  }
}

/**
 * Get user context from localStorage
 */
function getUserContext() {
  try {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    return userId ? { userId, userEmail } : {};
  } catch (e) {
    return {};
  }
}

/**
 * Flush logs to backend
 */
async function flushLogs() {
  if (logBuffer.length === 0) return;
  
  const logsToSend = [...logBuffer];
  logBuffer = [];
  
  if (!CONFIG.enableRemote) return;
  
  try {
    await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: logsToSend }),
      keepalive: true
    });
  } catch (err) {
    // Best effort - logs are already in console
    // Re-add failed logs to buffer (up to a limit)
    if (logBuffer.length < 100) {
      logBuffer.push(...logsToSend.slice(0, 50));
    }
  }
}

/**
 * Schedule flush
 */
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, CONFIG.flushInterval);
}

/**
 * Create a log entry
 */
function createLogEntry(level, component, message, data = {}) {
  return {
    level,
    component,
    message,
    data,
    trace: getTraceContext(),
    user: getUserContext(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Log a message
 */
function log(level, component, message, data = {}) {
  if (LOG_LEVELS[level] < LOG_LEVELS[CONFIG.minLevel]) return;
  
  const entry = createLogEntry(level, component, message, data);
  
  // Always log to console with structured format
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[consoleMethod](`[${component}] ${message}`, data);
  
  // Buffer for remote sending
  logBuffer.push(entry);
  
  if (logBuffer.length >= CONFIG.batchSize) {
    flushLogs();
  } else {
    scheduleFlush();
  }
}

/**
 * Create a component-scoped logger
 */
export function createLogger(component) {
  return {
    debug: (message, data) => log('debug', component, message, data),
    info: (message, data) => log('info', component, message, data),
    warn: (message, data) => log('warn', component, message, data),
    error: (message, data) => log('error', component, message, data)
  };
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushLogs);
  window.addEventListener('pagehide', flushLogs);
}

export default { createLogger, flushLogs };

