/**
 * Trace Context Middleware for EasyFlow
 *
 * Implements OpenTelemetry-compatible trace context propagation:
 * - Extracts existing traceparent from incoming requests
 * - Generates new trace IDs when none exist
 * - Makes context globally available via AsyncLocalStorage
 * - Injects correlation IDs into response headers
 */

const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

// Import OpenTelemetry API safely
let otelTrace, otelContext;
try {
  otelTrace = require('@opentelemetry/api').trace;
  otelContext = require('@opentelemetry/api').context;
} catch (err) {
  // OpenTelemetry not available, will use manual trace IDs only
  otelTrace = null;
  otelContext = null;
}

// Global context storage for the current request
const traceContextStorage = new AsyncLocalStorage();

/**
 * Generate a new trace ID in W3C format
 * Format: version-trace_id-parent_id-trace_flags
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
function generateTraceParent() {
  const version = '00';
  const traceId = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 16); // 32 chars
  const spanId = uuidv4().replace(/-/g, '').substring(0, 16); // 16 chars
  const flags = '01'; // sampled

  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Parse traceparent header into components
 */
function parseTraceParent(traceparent) {
  if (!traceparent || typeof traceparent !== 'string') return null;

  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts;

  // Basic validation
  if (version !== '00' || traceId.length !== 32 || spanId.length !== 16) {
    return null;
  }

  return { version, traceId, spanId, flags };
}

/**
 * Generate a child span ID for the current service
 */
function generateChildSpanId() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

/**
 * Create trace context object with all necessary correlation IDs
 */
function createTraceContext(req, existingTraceParent = null) {
  let traceId, spanId, parentSpanId = null;

  // Try to get OpenTelemetry active span context first (if OTel is initialized)
  if (otelTrace && otelContext) {
    try {
      const activeSpan = otelTrace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        if (spanContext && spanContext.traceId && spanContext.spanId) {
          traceId = spanContext.traceId;
          spanId = spanContext.spanId;
          // Already have valid OTel context, no need to parse headers
        }
      }
    } catch (err) {
      // OTel span not available, continue with manual generation
    }
  }

  // If no OTel context, try to extract from headers
  if (!traceId && existingTraceParent) {
    const parsed = parseTraceParent(existingTraceParent);
    if (parsed) {
      traceId = parsed.traceId;
      parentSpanId = parsed.spanId;
      spanId = generateChildSpanId(); // New span for this service
    }
  }

  // Generate new trace if no valid existing one
  if (!traceId) {
    const newTraceParent = generateTraceParent();
    const parsed = parseTraceParent(newTraceParent);
    if (parsed) {
      traceId = parsed.traceId;
      spanId = parsed.spanId;
    } else {
      // Fallback: generate directly if parsing fails
      traceId = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 16);
      spanId = generateChildSpanId();
    }
  }

  // Ensure traceId exists before creating requestId
  if (!traceId || traceId.length < 12) {
    traceId = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 16);
  }
  if (!spanId) {
    spanId = generateChildSpanId();
  }

  // Create simplified request_id for logging
  const requestId = `req_${traceId.substring(0, 12)}`;

  return {
    traceId,
    spanId,
    parentSpanId,
    requestId,
    traceparent: `00-${traceId}-${spanId}-01`,
    userId: req.user?.id || null,
    userTier: req.user?.subscription_tier || req.user?.plan || 'unknown',
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent') || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    timestamp: new Date().toISOString()
  };
}

/**
 * Main trace context middleware
 */
function traceContextMiddleware(req, res, next) {
  // Extract existing traceparent from headers (W3C standard)
  const incomingTraceParent = req.get('traceparent') || req.get('x-trace-id') || req.get('x-request-id');

  // Create comprehensive trace context
  const traceContext = createTraceContext(req, incomingTraceParent);

  // Store context for this request
  traceContextStorage.run(traceContext, () => {
    // Add context to request object for easy access
    req.traceContext = traceContext;
    req.requestId = traceContext.requestId;
    req.traceId = traceContext.traceId;

    // Inject trace headers into response
    res.set({
      'x-trace-id': traceContext.traceId,
      'x-request-id': traceContext.requestId,
      'x-span-id': traceContext.spanId
    });

    // Continue with request processing
    next();
  });
}

/**
 * Get current trace context from anywhere in the request
 */
function getCurrentTraceContext() {
  return traceContextStorage.getStore() || null;
}

/**
 * Create a context-aware logger for any service
 * @deprecated Use createLogger from structuredLogging.js instead
 */
function createContextLogger(namespace = 'app') {
  // Import here to avoid circular dependency
  const { createLogger } = require('./structuredLogging');
  return createLogger(namespace);
}

/**
 * Get headers for outbound HTTP requests to propagate context
 */
function getTraceHeaders() {
  const context = getCurrentTraceContext();
  if (!context) return {};

  return {
    'traceparent': context.traceparent,
    'x-trace-id': context.traceId,
    'x-request-id': context.requestId,
    'x-span-id': context.spanId
  };
}

/**
 * Get Kafka message headers for context propagation
 */
function getKafkaTraceHeaders() {
  const context = getCurrentTraceContext();
  if (!context) return {};

  return {
    'traceparent': context.traceparent,
    'x-trace-id': context.traceId,
    'x-request-id': context.requestId,
    'x-span-id': context.spanId,
    'x-user-id': context.userId || '',
    'x-user-tier': context.userTier || ''
  };
}

/**
 * Extract trace context from Kafka message headers
 */
function extractKafkaTraceContext(messageHeaders) {
  const headers = messageHeaders || {};

  // Convert Buffer values to strings if needed
  const getHeader = (key) => {
    const value = headers[key];
    return value ? (Buffer.isBuffer(value) ? value.toString() : value) : null;
  };

  const traceparent = getHeader('traceparent');
  const traceId = getHeader('x-trace-id');
  const requestId = getHeader('x-request-id');
  const userId = getHeader('x-user-id');
  const userTier = getHeader('x-user-tier');

  if (!traceparent && !traceId) return null;

  return {
    traceparent,
    traceId,
    requestId,
    userId: userId || null,
    userTier: userTier || 'unknown',
    extractedFrom: 'kafka'
  };
}

module.exports = {
  traceContextMiddleware,
  getCurrentTraceContext,
  createContextLogger,
  getTraceHeaders,
  getKafkaTraceHeaders,
  extractKafkaTraceContext,
  traceContextStorage
};
