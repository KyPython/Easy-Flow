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

 // Always use JSON format for reliable log capture
 // pino-pretty causes issues with nohup/file redirection
 //
 // ✅ DOCKER LOGGING: Pino writes to stdout/stderr by default (no destination specified)
 // This allows Docker to capture logs via its logging driver, which Promtail then collects
 // Logs are automatically shipped to Loki for observability and trace discovery
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
 },

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
 *
 * Sampling rates (1 in N logs):
 * - trace: 0.1% (1 in 1000) - Very verbose tracing
 * - debug: 1% (1 in 100) - Detailed debugging
 * - info: 100% (1 in 1) - General information (ALWAYS LOG - critical for observability)
 * - warn: 100% (1 in 1) - Warnings (ALWAYS LOG - important for debugging)
 * - error/fatal: 100% (always logged) - Critical issues
 *
 * ✅ OBSERVABILITY: Info and warn logs are now always logged to ensure complete visibility
 * into automation task execution, completion, and artifact generation.
 *
 * Override via environment variables:
 * - TRACE_LOG_SAMPLE_RATE (default: 1000)
 * - DEBUG_LOG_SAMPLE_RATE (default: 100)
 * - INFO_LOG_SAMPLE_RATE (default: 1 - always log)
 * - WARN_LOG_SAMPLE_RATE (default: 1 - always log)
 */
const SAMPLING_CONFIG = {
 // Sample 1 in N logs for each level
 trace: parseInt(process.env.TRACE_LOG_SAMPLE_RATE || '1000', 10), // 0.1% of trace logs
 debug: parseInt(process.env.DEBUG_LOG_SAMPLE_RATE || '100', 10), // 1% of debug logs
 info: parseInt(process.env.INFO_LOG_SAMPLE_RATE || '1', 10), // 100% of info logs (ALWAYS LOG for observability)
 warn: parseInt(process.env.WARN_LOG_SAMPLE_RATE || '1', 10), // 100% of warn logs (ALWAYS LOG for debugging)
 // Never sample error/fatal - always log critical issues
 error: 1,
 fatal: 1
};

// Sampling counter per namespace
const samplingCounters = new Map();

function shouldSample(namespace, level) {
 const sampleRate = SAMPLING_CONFIG[level] || 1;
 if (sampleRate === 1) return true; // Always log error/fatal (no sampling)

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
 // Sample warn logs to reduce noise (but still catch issues)
 if (!shouldSample(this.namespace, 'warn')) return;
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

// NOTE: Previously this module had a `deprecatedConsole` helper for migration.
// It's been removed as it's no longer used. All code should use the structured logger directly.

/**
 * Express middleware for structured request logging
 * ✅ PRODUCTION EXCELLENCE: Logs EVERY request as structured JSON for P99 latency analysis
 *
 * Required fields for observability:
 * - request_method: HTTP method (GET, POST, etc.)
 * - path: Request path
 * - status_code: HTTP status code
 * - duration_ms: Request duration in milliseconds
 *
 * This enables calculation of P99 latency (99th percentile) to identify bottlenecks
 * that affect 1 in 100 users.
 */
function requestLoggingMiddleware() {
 return (req, res, next) => {
 const startTime = Date.now();
 const logger = createLogger('http.request');

 // ✅ PRODUCTION EXCELLENCE: Log EVERY request (no sampling) for complete observability
 // This ensures we can calculate P99 latency accurately
 // Health endpoints are still logged but marked for easy filtering
 const isHealthEndpoint = req.path === '/health' || req.path === '/metrics' || req.path === '/api/health' || req.path === '/api/health/supabase' || req.path === '/api/health/databases' || req.path === '/api/kafka/health';

 // Capture response end with proper cleanup
 const originalSend = res.send;
 const originalEnd = res.end;

 // Override both send and end to ensure we capture all response completions
 const logResponse = () => {
   const duration = Date.now() - startTime;
   const durationMs = duration; // Explicitly name for clarity

   // ✅ PRODUCTION EXCELLENCE: Always log every request with required fields
   // Structured JSON format for easy querying and P99 latency calculation
   logger.info('HTTP request', {
     // Required fields for observability and P99 latency calculation
     request_method: req.method,
     path: req.path,
     status_code: res.statusCode,
     duration_ms: durationMs,

     // Additional context for debugging and correlation
     http: {
       method: req.method,
       url: req.url,
       path: req.path,
       status_code: res.statusCode,
       duration_ms: durationMs,
       user_agent: req.get('User-Agent'),
       ip: req.ip || req.connection?.remoteAddress,
       content_length: req.get('content-length'),
       content_type: req.get('content-type')
     },

     // Performance metrics for latency analysis
     performance: {
       duration_ms: durationMs,
       duration_seconds: (durationMs / 1000).toFixed(3)
     },

     // Categorization for filtering
     endpoint_type: isHealthEndpoint ? 'health' : 'api',

     // Request context
     request_id: req.requestId || req.traceId || req.headers['x-request-id'],
     trace_id: req.traceId || req.headers['x-trace-id'],

     // User context (if available)
     user_id: req.user?.id || null
   });

   // Mark as logged to prevent double logging
   res._requestLogged = true;
 };

 // Override res.send
 res.send = function(data) {
   if (!res._requestLogged) {
     logResponse();
   }
   return originalSend.call(this, data);
 };

 // Override res.end (for cases where send isn't called)
 res.end = function(chunk, encoding) {
   if (!res._requestLogged) {
     logResponse();
   }
   return originalEnd.call(this, chunk, encoding);
 };

 // Ensure we log even if connection closes
 res.on('finish', () => {
   if (!res._requestLogged) {
     logResponse();
   }
 });

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
