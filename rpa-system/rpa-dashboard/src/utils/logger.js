/**
 * Frontend Observability Logger
 * Integrates console logging with backend telemetry via trackEvent API
 * Provides structured logging with trace context correlation
 */

import { trackEvent, getCurrentTraceInfo } from './api';

// Log levels with priorities
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// Current environment log level
const CURRENT_LOG_LEVEL = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

// Log sampling configuration - reduce log volume
// Sample rate: 1 = log everything, 10 = log 10% (every 10th log), 100 = log 1%
const getLogSampleRate = () => {
  try {
    const stored = localStorage.getItem('LOG_SAMPLE_RATE');
    if (stored) {
      const rate = parseInt(stored, 10);
      if (rate > 0) return rate;
    }
  } catch (e) {
    // localStorage may not be available
  }
  // Default: sample 1% of logs (1 in 100) for DEBUG/INFO, always log WARN/ERROR
  // More aggressive sampling to prevent log flooding
  return 100;
};

const LOG_SAMPLE_RATE = getLogSampleRate();
// Per-namespace sampling counters to prevent one namespace from affecting others
const namespaceCounters = new Map();

// Rate limiting for repeated log messages
const messageCache = new Map(); // key -> { count, firstSeen, lastSeen, lastLogged }
const THROTTLE_WINDOW_MS = 10000; // Throttle identical messages within 10 seconds
const MAX_LOGS_PER_WINDOW = 1; // Max 1 identical message per window (more aggressive)

// Telemetry-specific throttling to prevent API flooding
const telemetryThrottleMap = new Map(); // key -> timestamp of last telemetry send

/**
 * Structured Logger for Frontend
 * Automatically integrates with backend observability system
 */
class FrontendLogger {
  constructor(namespace = 'app', context = {}) {
    this.namespace = namespace;
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext = {}) {
    return new FrontendLogger(this.namespace, {
      ...this.context,
      ...additionalContext
    });
  }

  /**
   * Internal log method that handles both console and telemetry
   */
  _log(level, message, extra = {}, sendToBackend = false) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) {
      return;
    }

    // Log sampling: Always log WARN/ERROR/FATAL, sample DEBUG/INFO
    const shouldSample = LOG_LEVELS[level] < LOG_LEVELS.WARN;
    let isSampled = false;
    if (shouldSample) {
      // Use per-namespace counter to prevent one namespace from affecting others
      const namespaceCounter = (namespaceCounters.get(this.namespace) || 0) + 1;
      namespaceCounters.set(this.namespace, namespaceCounter);
      
      // Only log every Nth message based on sample rate
      if (namespaceCounter % LOG_SAMPLE_RATE !== 0) {
        isSampled = true;
        // Still send sampled logs to backend telemetry for observability
        // This ensures observability system gets representative sample of all logs
        const traceInfo = getCurrentTraceInfo();
        const logEntry = {
          level,
          namespace: this.namespace,
          message,
          timestamp: new Date().toISOString(),
          trace: traceInfo || {},
          context: this.context,
          sampled: true,
          sampleRate: LOG_SAMPLE_RATE,
          ...extra
        };
        this._sendTelemetry(logEntry);
        return; // Skip console output for sampled logs
      }
    }

    // Rate limiting: create a cache key from namespace + message + level
    const cacheKey = `${this.namespace}:${level}:${message}`;
    const now = Date.now();
    const cached = messageCache.get(cacheKey);

    if (cached) {
      const timeSinceFirst = now - cached.firstSeen;
      const timeSinceLast = now - cached.lastLogged;
      
      // Reset count if outside throttle window
      if (timeSinceFirst > THROTTLE_WINDOW_MS) {
        cached.count = 1;
        cached.firstSeen = now;
        cached.lastSeen = now;
        cached.lastLogged = now;
      } else {
        cached.count++;
        cached.lastSeen = now;
        
        // Throttle if too many logs in window
        if (cached.count > MAX_LOGS_PER_WINDOW && timeSinceLast < THROTTLE_WINDOW_MS) {
          // Silently drop this log
          return;
        }
        
        cached.lastLogged = now;
      }
    } else {
      // First time seeing this message
      messageCache.set(cacheKey, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        lastLogged: now
      });
    }

    // Get trace context for correlation
    const traceInfo = getCurrentTraceInfo();

    // Build structured log entry
    const logEntry = {
      level,
      namespace: this.namespace,
      message,
      timestamp: new Date().toISOString(),
      trace: traceInfo || {},
      context: this.context,
      sampled: false,
      ...extra
    };

    // Add throttle warning if this message has been throttled
    if (cached && cached.count > MAX_LOGS_PER_WINDOW) {
      logEntry.throttled = true;
      logEntry.throttledCount = cached.count - MAX_LOGS_PER_WINDOW;
    }

    // Console output (with appropriate level)
    // Use original console methods to avoid double-sampling (logger already samples)
    const originalConsole = typeof window !== 'undefined' && window.__originalConsole 
      ? window.__originalConsole 
      : console;
    
    const consoleMethod = level === 'DEBUG' ? 'debug' : 
                         level === 'INFO' ? 'info' : 
                         level === 'WARN' ? 'warn' : 
                         level === 'ERROR' || level === 'FATAL' ? 'error' : 'log';

    // Format console message
    const prefix = `[${this.namespace}]`;
    const throttleNote = (cached && cached.count > MAX_LOGS_PER_WINDOW) ? 
      ` (repeated ${cached.count - MAX_LOGS_PER_WINDOW} times)` : '';
    const sampleNote = (shouldSample && LOG_SAMPLE_RATE > 1) ? 
      ` [sampled: 1/${LOG_SAMPLE_RATE}]` : '';
    originalConsole[consoleMethod](prefix, message + throttleNote + sampleNote, extra);

    // Send to backend telemetry if requested or if it's a warning/error (but also throttled)
    if ((sendToBackend || LOG_LEVELS[level] >= LOG_LEVELS.WARN) && (!cached || cached.count <= MAX_LOGS_PER_WINDOW * 2)) {
      this._sendTelemetry(logEntry);
    }
  }

  /**
   * Send log entry to backend telemetry system with throttling
   */
  async _sendTelemetry(logEntry) {
    try {
      // Throttle telemetry sends to prevent API flooding
      // Only send telemetry logs at most once per 5 seconds per namespace
      const telemetryKey = `telemetry:${this.namespace}:${logEntry.level}`;
      const now = Date.now();
      const lastTelemetrySend = telemetryThrottleMap.get(telemetryKey) || 0;
      const TELEMETRY_THROTTLE_MS = 5000; // 5 seconds between telemetry sends per namespace/level
      
      // Skip if too soon since last send (unless it's an error/fatal)
      if (now - lastTelemetrySend < TELEMETRY_THROTTLE_MS && 
          LOG_LEVELS[logEntry.level] < LOG_LEVELS.ERROR) {
        return; // Silently skip - telemetry is not critical
      }
      
      // Update throttle timestamp
      telemetryThrottleMap.set(telemetryKey, now);
      
      // Clean up old throttle entries periodically
      if (telemetryThrottleMap.size > 100) {
        const cutoff = now - (TELEMETRY_THROTTLE_MS * 10);
        for (const [key, timestamp] of telemetryThrottleMap.entries()) {
          if (timestamp < cutoff) {
            telemetryThrottleMap.delete(key);
          }
        }
      }
      
      // Don't await - fire and forget
      trackEvent({
        event: 'frontend_log',
        category: 'observability',
        level: logEntry.level,
        namespace: logEntry.namespace,
        message: logEntry.message,
        trace: logEntry.trace,
        context: logEntry.context,
        timestamp: logEntry.timestamp,
        ...logEntry
      }).catch(() => {
        // Silently fail - never let telemetry break the app
      });
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Debug level logging (development only)
   */
  debug(message, extra = {}) {
    this._log('DEBUG', message, extra, false);
  }

  /**
   * Info level logging
   */
  info(message, extra = {}) {
    this._log('INFO', message, extra, false);
  }

  /**
   * Warning level logging (sent to backend)
   */
  warn(message, extra = {}) {
    this._log('WARN', message, extra, true);
  }

  /**
   * Error level logging (sent to backend)
   */
  error(message, error = null, extra = {}) {
    const errorData = error instanceof Error ? {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    } : error ? { error } : {};

    this._log('ERROR', message, { ...extra, ...errorData }, true);
  }

  /**
   * Fatal level logging (sent to backend)
   */
  fatal(message, error = null, extra = {}) {
    const errorData = error instanceof Error ? {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      }
    } : error ? { error } : {};

    this._log('FATAL', message, { ...errorData, ...extra }, true);
  }

  /**
   * Log Realtime channel events with proper categorization
   */
  realtimeEvent(channelKey, eventType, details = {}) {
    const message = `Realtime: ${channelKey} ${eventType}`;
    
    // Map event types to log levels
    const eventTypeMapping = {
      'subscribed': 'INFO',
      'disconnected': 'WARN',
      'reconnecting': 'WARN',
      'error': 'ERROR',
      'permanent_error': 'ERROR',
      'fallback_polling': 'WARN',
      'closed': 'WARN'
    };

    const level = eventTypeMapping[eventType] || 'INFO';
    
    this._log(level, message, {
      channelKey,
      eventType,
      ...details
    }, level !== 'INFO'); // Send non-info events to backend
  }

  /**
   * Log performance metrics
   */
  performance(operation, duration, extra = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      category: 'performance',
      ...extra
    });
  }

  /**
   * Log business metrics
   */
  metric(name, value, unit = 'count', extra = {}) {
    this.info(`Metric: ${name} = ${value} ${unit}`, {
      metric: {
        name,
        value,
        unit
      },
      ...extra
    });
  }
}

/**
 * Create a logger instance
 */
export function createLogger(namespace = 'app', context = {}) {
  return new FrontendLogger(namespace, context);
}

/**
 * Default logger instance
 */
export const logger = createLogger('app');

/**
 * Specialized loggers for common use cases
 */
export const realtimeLogger = createLogger('realtime');
export const apiLogger = createLogger('api');
export const authLogger = createLogger('auth');

// Log sampling info on initialization
if (LOG_SAMPLE_RATE > 1) {
  console.info(`[logger] Log sampling active: 1/${LOG_SAMPLE_RATE} DEBUG/INFO logs will be shown. Set localStorage.setItem('LOG_SAMPLE_RATE', '1') to disable.`);
}

export default logger;
