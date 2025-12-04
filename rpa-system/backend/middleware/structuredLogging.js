/**
 * Centralized Structured Logging Utility for EasyFlow
 * Enforces JSON output, automatic trace context injection, and structured error handling
 * Replaces all console.log usage across the application
 */

const pino = require('pino');
const { getCurrentTraceContext } = require('./traceContext');

// Create base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  
  // Production JSON format, development pretty format
  ...(process.env.NODE_ENV === 'production' 
    ? {
        formatters: {
          level(label) {
            return { level: label };
          },
          log(object) {
            // Automatically inject trace context into every log entry
            const traceContext = getCurrentTraceContext();
            return {
              ...object,
              trace: traceContext || {},
              timestamp: new Date().toISOString()
            };
          }
        }
      }
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      }
  ),

  // Base fields for all log entries
  base: {
    service: 'rpa-system-backend',
    version: process.env.npm_package_version || '0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Custom serializers for complex objects
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    
    // Custom serializer for user objects (remove sensitive data)
    user: (user) => {
      if (!user) return user;
      const { password, secrets, ...safeUser } = user;
      return safeUser;
    },
    
    // Custom serializer for database operations
    database: (db) => {
      if (!db) return db;
      return {
        operation: db.operation,
        table: db.table,
        duration: db.duration,
        rowsAffected: db.rowsAffected,
        // Don't log actual query values for security
        hasFilters: !!(db.filters && db.filters.length > 0)
      };
    }
  }
};

// Create root logger
const rootLogger = pino(loggerConfig);

/**
 * Log Sampling Configuration
 * Reduces volume of debug/info logs by sampling
 */
const SAMPLING_CONFIG = {
  // Sample 1 in N logs for each level
  debug: parseInt(process.env.DEBUG_LOG_SAMPLE_RATE || '100', 10), // 1% of debug logs
  trace: parseInt(process.env.TRACE_LOG_SAMPLE_RATE || '1000', 10), // 0.1% of trace logs
  info: parseInt(process.env.INFO_LOG_SAMPLE_RATE || '10', 10), // 10% of info logs
  // Never sample warn/error/fatal
  warn: 1,
  error: 1,
  fatal: 1
};

// Sampling counter per namespace
const samplingCounters = new Map();

function shouldSample(namespace, level) {
  const sampleRate = SAMPLING_CONFIG[level] || 1;
  if (sampleRate === 1) return true; // Always log warn/error/fatal
  
  const key = `${namespace}:${level}`;
  const counter = (samplingCounters.get(key) || 0) + 1;
  samplingCounters.set(key, counter);
  
  // Sample every Nth log
  return counter % sampleRate === 0;
}

/**
 * Enhanced Logger Class with Business Context Support
 */
class StructuredLogger {
  constructor(namespace = 'default', baseContext = {}) {
    this.namespace = namespace;
    this.baseContext = baseContext;
    this.logger = rootLogger.child({ 
      logger: namespace,
      ...baseContext 
    });
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    return new StructuredLogger(
      this.namespace, 
      { ...this.baseContext, ...context }
    );
  }

  /**
   * Add business context to current logger instance
   */
  withContext(context = {}) {
    return this.child(context);
  }

  /**
   * Add user context for business correlation
   */
  withUser(user) {
    const userContext = {
      user_id: user?.id || user?.userId,
      user_tier: user?.tier || user?.plan?.name,
      user_email: user?.email
    };
    return this.child({ business: { user: userContext } });
  }

  /**
   * Add workflow/operation context
   */
  withOperation(operation, metadata = {}) {
    const operationContext = {
      operation_name: operation,
      workflow_id: metadata.workflowId,
      task_id: metadata.taskId,
      batch_id: metadata.batchId,
      ...metadata
    };
    return this.child({ business: { operation: operationContext } });
  }

  /**
   * Standard logging methods with automatic trace context injection and sampling
   */
  trace(message, extra = {}) {
    if (!shouldSample(this.namespace, 'trace')) return;
    this.logger.trace(this._enrichLog(extra), message);
  }

  debug(message, extra = {}) {
    if (!shouldSample(this.namespace, 'debug')) return;
    this.logger.debug(this._enrichLog(extra), message);
  }

  info(message, extra = {}) {
    if (!shouldSample(this.namespace, 'info')) return;
    this.logger.info(this._enrichLog(extra), message);
  }

  warn(message, extra = {}) {
    this.logger.warn(this._enrichLog(extra), message);
  }

  error(message, error = null, extra = {}) {
    const errorLog = this._enrichLog(extra);
    
    if (error instanceof Error) {
      // Structured error logging with full stack trace and metadata
      errorLog.error = {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        code: error.code,
        status: error.status,
        // Custom error properties
        ...this._extractErrorMetadata(error)
      };
    } else if (error && typeof error === 'object') {
      errorLog.error = error;
    }

    this.logger.error(errorLog, message);
  }

  fatal(message, error = null, extra = {}) {
    const fatalLog = this._enrichLog(extra);
    
    if (error instanceof Error) {
      fatalLog.error = {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        code: error.code,
        status: error.status,
        ...this._extractErrorMetadata(error)
      };
    }

    this.logger.fatal(fatalLog, message);
  }

  /**
   * Performance logging for spans and operations
   */
  performance(operation, duration, extra = {}) {
    this.logger.info(this._enrichLog({
      ...extra,
      performance: {
        operation,
        duration,
        category: extra.category || 'operation'
      }
    }), `Performance: ${operation} completed in ${duration}ms`);
  }

  /**
   * Business metrics logging
   */
  metric(name, value, unit = 'count', extra = {}) {
    this.logger.info(this._enrichLog({
      ...extra,
      metric: {
        name,
        value,
        unit,
        timestamp: new Date().toISOString()
      }
    }), `Metric: ${name} = ${value} ${unit}`);
  }

  /**
   * Security/audit logging
   */
  security(event, outcome, extra = {}) {
    this.logger.warn(this._enrichLog({
      ...extra,
      security: {
        event,
        outcome,
        timestamp: new Date().toISOString()
      }
    }), `Security: ${event} - ${outcome}`);
  }

  /**
   * Enrich log entry with trace context and business data
   */
  _enrichLog(extra = {}) {
    const traceContext = getCurrentTraceContext();
    
    return {
      ...extra,
      // Always include trace correlation
      trace: traceContext || {},
      // Include business context if available
      business: {
        ...this.baseContext.business,
        ...extra.business
      },
      // Timestamp for log ordering
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract additional metadata from error objects
   */
  _extractErrorMetadata(error) {
    const metadata = {};
    
    // Database errors
    if (error.code && typeof error.code === 'string') {
      metadata.database_error_code = error.code;
    }
    
    // HTTP errors
    if (error.response) {
      metadata.http_status = error.response.status;
      metadata.http_statusText = error.response.statusText;
      metadata.http_url = error.response.config?.url;
    }
    
    // Validation errors
    if (error.errors && Array.isArray(error.errors)) {
      metadata.validation_errors = error.errors.map(e => ({
        field: e.field || e.path,
        message: e.message
      }));
    }
    
    return metadata;
  }
}

/**
 * Logger factory function - main interface for the application
 */
function createLogger(namespace = 'app', context = {}) {
  return new StructuredLogger(namespace, context);
}

/**
 * Migration helper: Replace console.log across the application
 */
const deprecatedConsole = {
  log: (...args) => {
    const logger = createLogger('deprecated');
    logger.warn('DEPRECATED: console.log usage detected, use structured logger instead', {
      legacy_args: args,
      stack: new Error().stack
    });
  },
  
  error: (...args) => {
    const logger = createLogger('deprecated');
    logger.error('DEPRECATED: console.error usage detected, use structured logger instead', null, {
      legacy_args: args,
      stack: new Error().stack
    });
  },
  
  warn: (...args) => {
    const logger = createLogger('deprecated');
    logger.warn('DEPRECATED: console.warn usage detected, use structured logger instead', {
      legacy_args: args,
      stack: new Error().stack
    });
  },
  
  info: (...args) => {
    const logger = createLogger('deprecated');
    logger.info('DEPRECATED: console.info usage detected, use structured logger instead', {
      legacy_args: args,
      stack: new Error().stack
    });
  }
};

// NOTE: previously this module monkey-patched `console` to emit deprecation
// warnings when code called `console.log`/`console.warn`/etc. That caused
// excessive noisy warnings. We no longer automatically replace `console`.
//
// Migration strategy:
// - `deprecatedConsole` is exported as a helper for a coordinated codemod
//   or temporary usage by maintainers.
// - Applications should import `../utils/logger.js` and call the
//   structured logger directly (see `utils/logger.js`).
//
// If you need to temporarily enable the old behavior for testing, set
// `ENABLE_CONSOLE_DEPRECATION_WARNINGS=true` in your environment and the
// deprecation helper may be assigned at runtime by an opt-in script.

/**
 * Express middleware for request logging with sampling
 */
function requestLoggingMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const logger = createLogger('http.request');
    
    // Sample info logs (only log every Nth request start)
    const shouldLogStart = shouldSample('http.request', 'info');
    
    // Always log API requests, sample health/metrics endpoints
    const isHealthEndpoint = req.path === '/health' || req.path === '/metrics' || req.path === '/api/health';
    
    if (shouldLogStart && !isHealthEndpoint) {
      logger.info('HTTP request started', {
        http: {
          method: req.method,
          url: req.url,
          path: req.path,
          user_agent: req.get('User-Agent'),
          ip: req.ip,
          content_length: req.get('content-length')
        }
      });
    }

    // Capture response end
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      
      // Always log errors, sample successful responses
      const shouldLogEnd = res.statusCode >= 400 || shouldSample('http.request', 'info');
      
      if (shouldLogEnd && !isHealthEndpoint) {
        logger.info('HTTP request completed', {
          http: {
            method: req.method,
            url: req.url,
            status_code: res.statusCode,
            duration,
            response_size: data ? Buffer.byteLength(data, 'utf8') : 0
          },
          performance: { duration }
        });
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
}

// Provide a default logger instance when the module is required directly
const defaultLogger = createLogger('app');

// Export the default logger as the module export, but keep named exports
module.exports = defaultLogger;
module.exports.createLogger = createLogger;
module.exports.StructuredLogger = StructuredLogger;
module.exports.requestLoggingMiddleware = requestLoggingMiddleware;
module.exports.rootLogger = rootLogger;