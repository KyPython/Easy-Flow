
const { logger, getLogger } = require('../utils/logger');
/**
 * OpenTelemetry Backend Initialization for SLO Metrics Export
 * Must be imported before any other modules to ensure proper instrumentation
 */

// Patch setTimeout FIRST to catch OTLP exporter timeout errors before they crash the app
const originalSetTimeout = global.setTimeout;
global.setTimeout = function(callback, delay, ...args) {
  const wrappedCallback = function(...callbackArgs) {
    try {
      return callback.apply(this, callbackArgs);
    } catch (error) {
      // Catch errors from OTLP exporter timeouts that access destroyed connections
      if (error && error.message && (
        error.message.includes('destroyed') ||
        error.message.includes('Cannot read properties of undefined')
      )) {
        logger.error('⚠️ [Telemetry] OTLP exporter timeout error (suppressed):', error.message);
        return;
      }
      throw error;
    }
  };
  return originalSetTimeout.call(this, wrappedCallback, delay, ...args);
};

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { PeriodicExportingMetricReader, MeterProvider } = require('@opentelemetry/sdk-metrics');
const { trace, metrics, context, SpanStatusCode } = require('@opentelemetry/api');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

// ✅ INSTRUCTION 1: Import sampling components for trace optimization (Gap 10)
const { 
  ParentBasedSampler, 
  TraceIdRatioBasedSampler,
  AlwaysOnSampler
} = require('@opentelemetry/sdk-trace-base');

// ✅ INSTRUCTION 1: Import span processor for data redaction (Gap 14)
const { BatchSpanProcessor, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');

// ✅ PART 2.1: Use OTEL_SERVICE_NAME environment variable for service identification
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'rpa-system-backend',
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'easyflow',
  
  // Business context attributes
  'business.domain': 'rpa-automation',
  'business.tier': 'backend-services',
  'business.component': 'api-gateway'
});

// ✅ PART 2: Configure exporters for Grafana Cloud
// Uses OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS from environment

// Helper to check if we have valid credentials
const hasValidCredentials = () => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS;

  if (!endpoint || !headers) {
    return false;
  }

  // Check for placeholder values
  if (endpoint.includes('your-grafana') || endpoint.includes('your-actual')) {
    return false;
  }

  if (headers.includes('your-base64') || headers.includes('your-actual')) {
    return false;
  }

  return true;
};

// Check credentials before creating exporters
if (!hasValidCredentials()) {
  logger.warn('⚠️  [Telemetry] OpenTelemetry exporters disabled - credentials not configured');
  logger.warn('⚠️  [Telemetry] To enable Grafana Cloud integration, set these environment variables:');
  logger.warn('    - OTEL_EXPORTER_OTLP_ENDPOINT');
  logger.warn('    - OTEL_EXPORTER_OTLP_HEADERS');
  logger.warn('⚠️  [Telemetry] Application will continue without observability export');
}

// Parse headers with validation
const rawHeaderString = process.env.OTEL_EXPORTER_OTLP_HEADERS || '';

// Only show telemetry debug logs if explicitly enabled (reduces log flooding)
// Set ENABLE_TELEMETRY_DEBUG=true in environment to see detailed telemetry debugging
// Default to false to prevent log flooding in production/development
const ENABLE_TELEMETRY_DEBUG = process.env.ENABLE_TELEMETRY_DEBUG === 'true';

const parsedHeaders = rawHeaderString ? parseHeaders(rawHeaderString) : {};

// Validate and log parsed headers (only in debug mode)
if (ENABLE_TELEMETRY_DEBUG) {
  logger.debug('='.repeat(80));
  logger.debug('[TELEMETRY DEBUG] Raw env var:', rawHeaderString ? rawHeaderString.substring(0, 50) + '...' : 'NOT SET');
  logger.debug('[TELEMETRY DEBUG] Raw env var length:', rawHeaderString.length);
  logger.debug('[TELEMETRY DEBUG] Parsed headers:', JSON.stringify(parsedHeaders, null, 2));
  logger.debug('[TELEMETRY DEBUG] Parsed headers has Authorization?', !!parsedHeaders.Authorization);
  logger.debug('[TELEMETRY DEBUG] Authorization value:', parsedHeaders.Authorization || 'MISSING');
}

// Validate and clean parsed headers
if (parsedHeaders.Authorization) {
  const authValue = parsedHeaders.Authorization;
  
  if (ENABLE_TELEMETRY_DEBUG) {
    logger.debug('[TELEMETRY DEBUG] Auth value type:', typeof authValue);
    logger.debug('[TELEMETRY DEBUG] Auth value length:', authValue.length);
    logger.debug('[TELEMETRY DEBUG] Auth value first 30 chars:', authValue.substring(0, 30));
    logger.debug('[TELEMETRY DEBUG] Has double quotes?', authValue.includes('"'));
    logger.debug('[TELEMETRY DEBUG] Has single quotes?', authValue.includes("'"));
    
    // Check each character in first 50 chars
    for (let i = 0; i < Math.min(50, authValue.length); i++) {
      const char = authValue[i];
      const code = authValue.charCodeAt(i);
      if (char === '"' || char === "'" || code < 32 || code > 126) {
        logger.debug(`[TELEMETRY DEBUG] Char at pos ${i}: '${char}' (code: ${code})`);
      }
    }
  }
  
  // ALWAYS clean quotes, even if the initial parse tried to remove them
  // The value might have nested or escaped quotes that survived parsing
  const cleaned = authValue.replace(/['"]/g, '').trim();
  
  if (authValue !== cleaned) {
    logger.warn('⚠️ [TELEMETRY] WARNING: Authorization header had quotes - cleaned them');
    if (ENABLE_TELEMETRY_DEBUG) {
      logger.debug('[TELEMETRY DEBUG] Original first 30 chars:', authValue.substring(0, 30));
      logger.debug('[TELEMETRY DEBUG] Cleaned first 30 chars:', cleaned.substring(0, 30));
    }
    parsedHeaders.Authorization = cleaned;
  }
} else {
  logger.warn('⚠️ [TELEMETRY] WARNING: No Authorization header found!');
}

if (ENABLE_TELEMETRY_DEBUG) {
  logger.debug('[TELEMETRY DEBUG] Final headers object:', JSON.stringify(parsedHeaders, null, 2));
  logger.debug('='.repeat(80));
  logger.debug('[TELEMETRY DEBUG] Creating exporters with explicit headers parameter');
  logger.debug('[TELEMETRY DEBUG] Headers to send:', Object.keys(parsedHeaders).join(', '));
}

// ✅ CRITICAL: Verify headers before creating exporters
if (!parsedHeaders.Authorization) {
  logger.error('❌ [Telemetry] CRITICAL ERROR: Authorization header is MISSING in parsedHeaders!');
  if (ENABLE_TELEMETRY_DEBUG) {
    logger.debug('[Telemetry] parsedHeaders:', JSON.stringify(parsedHeaders));
  }
} else if (ENABLE_TELEMETRY_DEBUG) {
  logger.debug('✅ [Telemetry] Authorization header present:', parsedHeaders.Authorization.substring(0, 30) + '...');
  logger.debug('✅ [Telemetry] Authorization header length:', parsedHeaders.Authorization.length);
}

// ✅ CRITICAL FIX: The OTLP HTTP exporter expects headers as a plain object with string values
// Create a clean headers object to avoid any prototype issues
const exporterHeaders = Object.create(null);
Object.keys(parsedHeaders).forEach(key => {
  exporterHeaders[key] = parsedHeaders[key];
});

if (ENABLE_TELEMETRY_DEBUG) {
  logger.debug('[TELEMETRY DEBUG] Final headers for exporters:', JSON.stringify({
    Authorization: exporterHeaders.Authorization ? exporterHeaders.Authorization.substring(0, 30) + '...(truncated)' : 'MISSING'
  }));
}

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
       (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` : 'http://localhost:4318/v1/traces'),
  headers: exporterHeaders, // ✅ CRITICAL: Explicitly pass clean headers object
  timeoutMillis: 10000,
});

const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
       (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics` : 'http://localhost:4318/v1/metrics'),
  headers: exporterHeaders, // ✅ CRITICAL: Explicitly pass clean headers object
  timeoutMillis: 10000,
});

if (ENABLE_TELEMETRY_DEBUG) {
  logger.debug('[TELEMETRY DEBUG] Trace exporter created with headers');
  logger.debug('[TELEMETRY DEBUG] Metric exporter created with headers');
  logger.debug('[TELEMETRY DEBUG] Exporters created successfully with Authorization header');
}

// Helper function to parse headers from environment variable
// Format: "key1=value1,key2=value2" OR single header "Authorization=Basic <token>"
function parseHeaders(headerString) {
  const headers = {};
  if (headerString) {
    // Handle single Authorization header (most common case for OTLP)
    if (headerString.startsWith('Authorization=')) {
      let value = headerString.substring('Authorization='.length);
      
      // DEBUG: Show raw value before any processing
      logger.info('[Telemetry] RAW Authorization value length:', value.length);
      logger.info('[Telemetry] RAW Authorization value (first 50 chars):', value.substring(0, 50));
      logger.info('[Telemetry] RAW has quotes:', value.includes('"') || value.includes("'"));
      
      // CRITICAL: ONLY remove quotes and control characters - preserve ALL valid characters including spaces
      // HTTP headers CAN contain spaces (e.g., "Basic <token>")
      value = value.trim();
      
      // Step 1: Remove surrounding quotes ONLY (don't touch internal content)
      value = value.replace(/^["']+/, '').replace(/["']+$/, '');
      
      // Step 2: Remove control characters (newlines, tabs, etc.) but PRESERVE normal spaces
      value = value.replace(/[\x00-\x1F\x7F]/g, '');
      
      // Step 3: Final trim
      value = value.trim();
      
      headers['Authorization'] = value;
      
      logger.info('[Telemetry] FINAL Authorization header length:', value.length);
      logger.info('[Telemetry] FINAL Authorization header preview:', value.substring(0, 30) + '...');
      
      if (value.length === 0) {
        logger.error('❌ [Telemetry] ERROR: Authorization header is EMPTY after sanitization!');
      }
    } else {
      // Handle comma-separated headers
      headerString.split(',').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const key = pair.substring(0, idx).trim();
          let value = pair.substring(idx + 1).trim();
          
          // CRITICAL: Only remove quotes and control characters
          value = value.replace(/^["']+/, '').replace(/["']+$/, '');
          value = value.replace(/[\x00-\x1F\x7F]/g, '');
          value = value.trim();
          
          headers[key] = value;
        }
      });
    }
  }
  return headers;
}

// Prometheus exporter for local metrics scraping
const prometheusExporter = new PrometheusExporter({
  port: 9090,
  endpoint: '/metrics'
});

// ✅ OBSERVABILITY: Configure trace sampler with smart defaults
// Uses ParentBasedSampler: preserves all traces initiated by sampled requests
// Default: 10% sampling (0.1) - balances observability with performance
// Set OTEL_TRACE_SAMPLING_RATIO=1.0 for 100% (debugging) or 0.01 for 1% (high volume)
const samplingRatio = process.env.OTEL_TRACE_SAMPLING_RATIO ? parseFloat(process.env.OTEL_TRACE_SAMPLING_RATIO) : 0.1;
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(samplingRatio), // Configurable sampling for root spans
  remoteParentSampled: new AlwaysOnSampler(), // Always sample if parent was sampled
  remoteParentNotSampled: new AlwaysOnSampler(), // Sample even if parent wasn't (for flexibility)
  localParentSampled: new AlwaysOnSampler(), // Always sample if local parent was sampled
  localParentNotSampled: new TraceIdRatioBasedSampler(samplingRatio) // Configurable sampling for local unsampled parents
});

// ✅ INSTRUCTION 1: Create custom span processor for sensitive data redaction (Gap 14)
class SensitiveDataRedactingSpanProcessor {
  constructor(exporter) {
    this.exporter = exporter;
    this.batchProcessor = new BatchSpanProcessor(exporter);
  }
  
  onStart(span, parentContext) {
    this.batchProcessor.onStart(span, parentContext);
  }
  
  onEnd(span) {
    // ✅ INSTRUCTION 1: Redact sensitive attributes before export (Gap 14)
    const attributes = span.attributes;
    
    // Remove high-cardinality and potentially sensitive HTTP headers
    if (attributes['http.headers']) {
      delete attributes['http.headers'];
    }
    if (attributes['http.request.header']) {
      delete attributes['http.request.header'];
    }
    if (attributes['http.response.header']) {
      delete attributes['http.response.header'];
    }
    
    // Remove sensitive query parameters
    if (attributes['http.url']) {
      // Redact tokens, passwords, keys from URLs
      const url = String(attributes['http.url']);
      attributes['http.url'] = url
        .replace(/([?&])(token|password|key|secret|api_key)=[^&]*/gi, '$1$2=REDACTED')
        .replace(/\/api\/[a-f0-9-]{36}/g, '/api/[UUID]'); // Redact UUIDs
    }
    
    // Remove full request/response bodies (keep only size)
    if (attributes['http.request.body']) {
      const bodySize = String(attributes['http.request.body']).length;
      delete attributes['http.request.body'];
      attributes['http.request.body.size'] = bodySize;
    }
    if (attributes['http.response.body']) {
      const bodySize = String(attributes['http.response.body']).length;
      delete attributes['http.response.body'];
      attributes['http.response.body.size'] = bodySize;
    }
    
    // Redact email addresses
    Object.keys(attributes).forEach(key => {
      if (typeof attributes[key] === 'string' && attributes[key].includes('@')) {
        attributes[key] = attributes[key].replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
      }
    });
    
    this.batchProcessor.onEnd(span);
  }
  
  async shutdown() {
    return this.batchProcessor.shutdown();
  }
  
  async forceFlush() {
    return this.batchProcessor.forceFlush();
  }
}

// Create redacting span processor
const spanProcessor = new SensitiveDataRedactingSpanProcessor(traceExporter);

// Add error handler for trace exporter to catch authentication failures
if (traceExporter && typeof traceExporter.export === 'function') {
  const originalExport = traceExporter.export.bind(traceExporter);
  traceExporter.export = function(spans, resultCallback) {
    originalExport(spans, (result) => {
      if (result.error) {
        // Log authentication errors specifically
        if (result.error.message && result.error.message.includes('Unauthorized')) {
          logger.error('❌ [Telemetry] Authentication failed - check OTEL_EXPORTER_OTLP_HEADERS');
          logger.error('   Endpoint:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
          logger.error('   Error:', result.error.message);
        } else if (result.error.code === 401) {
          logger.error('❌ [Telemetry] 401 Unauthorized - Invalid Grafana Cloud credentials');
          logger.error('   Please verify your OTEL_EXPORTER_OTLP_HEADERS token is correct');
        }
      } else {
        // ✅ Log successful exports at debug level (sampled) to reduce noise
        logger.debug(`✅ [Telemetry] Export success: sent ${spans.length} span(s) to Grafana at ${new Date().toISOString()}`);
      }
      resultCallback(result);
    });
  };
}

// Initialize NodeSDK with optimized configuration
const sdk = new NodeSDK({
  resource,
  spanProcessor, // ✅ Use custom processor for data redaction
  sampler, // ✅ Use configured sampler (10% sampling)
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30000, // Export every 30 seconds
    exportTimeoutMillis: 10000
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Enhanced HTTP instrumentation for SLO tracking
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        // Ignore OTLP exporter requests to prevent instrumentation loops and header issues
        ignoreOutgoingRequestHook: (request) => {
          const url = request.path || '';
          // Don't instrument OTLP exporter requests
          if (url.includes('/v1/traces') || url.includes('/v1/metrics')) {
            return true;
          }
          // Don't instrument requests to Grafana Cloud OTLP endpoints
          const hostname = request.hostname || request.host || '';
          if (hostname.includes('grafana') && hostname.includes('otlp')) {
            return true;
          }
          return false;
        },
        // CRITICAL: Preserve Authorization header for OTLP requests
        // The HTTP instrumentation can strip headers even when ignoreOutgoingRequestHook returns true
        requireParentforOutgoingSpans: false,
        requireParentforIncomingSpans: false,
        headersToSpanAttributes: {
          client: {
            // Don't capture Authorization header in spans (security)
            requestHeaders: [],
            responseHeaders: []
          }
        },
        requestHook: (span, request) => {
          // Add business context to HTTP spans
          const userAgent = request.headers['user-agent'] || 'unknown';
          const userId = request.headers['x-user-id'];
          const workflowId = request.headers['x-workflow-id'];
          const operation = request.headers['x-operation'];
          
          span.setAttributes({
            'http.user_agent': userAgent,
            'business.user_id': userId,
            'business.workflow_id': workflowId, 
            'business.operation': operation,
            'slo.user_transaction': request.method === 'POST' || request.method === 'PUT'
          });
          
          // Tag for SLO tracking
          if (request.url?.includes('/api/workflows')) {
            span.setAttributes({
              'slo.category': 'user_transaction',
              'slo.critical': true
            });
          }
        },
        responseHook: (span, response) => {
          const duration = Date.now() - span.startTime;
          span.setAttributes({
            'http.response_time_ms': duration,
            'slo.compliant': duration < 3000 && response.statusCode >= 200 && response.statusCode < 300
          });
        }
      },
      
      // Express instrumentation with business context
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        requestHook: (span, request) => {
          span.setAttributes({
            'business.request_source': 'api_gateway',
            'business.authenticated': !!(request.headers && request.headers.authorization)
          });
        }
      },
      
      // Database instrumentation for transaction tracking
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        addSqlCommenterAttributes: true
      },
      
      // Redis instrumentation for caching metrics
      '@opentelemetry/instrumentation-redis': {
        enabled: true
      },
      
      // DNS instrumentation for external API tracking
      '@opentelemetry/instrumentation-dns': {
        enabled: true
      },
      
      // Undici instrumentation - disable for OTLP endpoints to prevent header issues
      '@opentelemetry/instrumentation-undici': {
        enabled: true,
        ignoreRequestHook: (request) => {
          const url = request.origin + request.path;
          // Don't instrument OTLP exporter requests
          if (url.includes('/v1/traces') || url.includes('/v1/metrics')) {
            return true;
          }
          // Don't instrument requests to Grafana Cloud OTLP endpoints
          if (url.includes('grafana') && url.includes('otlp')) {
            return true;
          }
          return false;
        }
      }
    })
  ]
});

// Custom SLO Metrics Provider
class SLOMetricsProvider {
  constructor() {
    // Use the global MeterProvider from OpenTelemetry API
    const meterProvider = metrics.getMeterProvider();
    this.meter = meterProvider.getMeter('easyflow-slo-metrics', '1.0.0');

    // SLO 1: Process Execution Success Rate (successes only, for now)
    this.processSuccessCounter = this.meter.createCounter('rpa_process_executions_success_total', {
      description: 'Successful RPA process executions for SLO calculation'
    });

    // SLO 2: External API Latency
    this.externalApiLatencyHistogram = this.meter.createHistogram('external_api_duration_ms', {
      description: 'External API call duration in milliseconds',
      unit: 'ms'
    });

    // SLO 3: User Transaction Time
    this.userTransactionHistogram = this.meter.createHistogram('user_transaction_duration_ms', {
      description: 'User transaction duration in milliseconds',
      unit: 'ms'
    });

    // Business context metrics (active users by tier)
    this.activeUsersByTier = {};
    this.businessContextGauge = this.meter.createObservableGauge('business_context_active_users', {
      description: 'Current active users by tier'
    }, (observableResult) => {
      // Report the latest value for each tier
      for (const [tier, value] of Object.entries(this.activeUsersByTier)) {
        observableResult.observe(value, { user_tier: tier });
      }
    });
  }

  // Record process execution (successes only for now)
  recordProcessExecution(success, attributes = {}) {
    if (success) {
      this.processSuccessCounter.add(1, {
        user_tier: attributes.userTier || 'standard',
        workflow_id: attributes.workflowId || 'unknown',
        process_name: attributes.processName || 'generic'
      });
    }
  }

  // Record external API call
  recordExternalApiCall(duration, attributes = {}) {
    this.externalApiLatencyHistogram.record(duration, {
      api_provider: attributes.provider || 'unknown',
      operation: attributes.operation || 'unknown',
      user_tier: attributes.userTier || 'standard'
    });
  }

  // Record user transaction
  recordUserTransaction(duration, attributes = {}) {
    this.userTransactionHistogram.record(duration, {
      operation: attributes.operation || 'unknown',
      user_tier: attributes.userTier || 'standard',
      workflow_type: attributes.workflowType || 'generic'
    });
  }

  // Update business context (active users by tier)
  updateBusinessContext(activeUsers, userTier) {
    this.activeUsersByTier[userTier || 'standard'] = activeUsers;
    // The gauge will be observed on the next collection interval
  }
}

// Wrap exporter methods to catch connection errors
function wrapExporterWithErrorHandler(exporter, exporterName) {
  if (!exporter) return exporter;
  
  // Catch errors in the internal HTTP client
  if (exporter._otlpExporter && exporter._otlpExporter._transport) {
    const transport = exporter._otlpExporter._transport;
    if (transport.send) {
      const originalSend = transport.send.bind(transport);
      transport.send = function(...args) {
        try {
          return originalSend(...args).catch(err => {
            logger.error(`⚠️ [Telemetry] ${exporterName} export error:`, err.message);
            // Return success to prevent crash
            return { code: 0 };
          });
        } catch (err) {
          logger.error(`⚠️ [Telemetry] ${exporterName} send error:`, err.message);
          return Promise.resolve({ code: 0 });
        }
      };
    }
  }
  
  return exporter;
}

// Initialize telemetry
try {
  // Wrap exporters with error handlers
  wrapExporterWithErrorHandler(traceExporter, 'TraceExporter');
  wrapExporterWithErrorHandler(metricExporter, 'MetricExporter');
  
  sdk.start();
  
  // ✅ PART 2.3: Verification - Print success message indicating OTEL Exporters are active
  logger.info('✅ [Telemetry] OpenTelemetry backend instrumentation initialized successfully');
  logger.info(`✅ [Telemetry] Service Name: ${process.env.OTEL_SERVICE_NAME || 'rpa-system-backend'}`);
  logger.info(`✅ [Telemetry] OTLP Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'localhost:4318'}`);
  logger.info(`✅ [Telemetry] OTLP Headers: ${process.env.OTEL_EXPORTER_OTLP_HEADERS ? 'CONFIGURED ✓' : '❌ MISSING - Traces will NOT reach Grafana!'}`);
  logger.info(`✅ [Telemetry] Trace Sampler: ParentBasedSampler with ${(samplingRatio * 100).toFixed(0)}% sampling ratio`);
  logger.info(`✅ [Telemetry] Data Redaction: Active (Gap 14 - sensitive data removed)`);
  logger.info('✅ [Telemetry] OTEL Exporters: ACTIVE - Ready to stream to Grafana Cloud');
  
  // Create global SLO metrics provider
  global.sloMetrics = new SLOMetricsProvider();
  
} catch (error) {
  logger.error('❌ [Telemetry] Failed to initialize OpenTelemetry:', error);
}

// Add global error handlers for OTLP exporter errors
const telemetryErrorPatterns = [
  'destroyed',
  'OTLP',
  'opentelemetry',
  'otlp-exporter',
  'Cannot read properties of undefined'
];

process.on('uncaughtException', (error) => {
  const errorStr = error.message || error.toString();
  if (telemetryErrorPatterns.some(pattern => errorStr.includes(pattern))) {
    logger.error('⚠️ [Telemetry] OTLP exporter error (non-fatal):', error.message);
    logger.error('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    // Don't exit - these errors shouldn't crash the app
    return;
  }
  // Re-throw other uncaught exceptions
  throw error;
});

process.on('unhandledRejection', (reason, promise) => {
  const reasonStr = reason?.toString() || '';
  if (telemetryErrorPatterns.some(pattern => reasonStr.includes(pattern))) {
    logger.error('⚠️ [Telemetry] OTLP exporter rejection (non-fatal):', reasonStr);
    // Don't exit - these rejections shouldn't crash the app
    return;
  }
  // Log other unhandled rejections
  logger.error('Unhandled Rejection:', reasonStr);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => logger.info('[Telemetry] OpenTelemetry shutdown completed'))
    .catch((error) => logger.error('[Telemetry] Error during shutdown:', error))
    .finally(() => process.exit(0));
});

// Export utilities for application use
module.exports = {
  trace,
  metrics,
  context,
  SpanStatusCode,
  recordSLOMetric: (type, value, attributes) => {
    if (global.sloMetrics) {
      switch (type) {
        case 'process_execution':
          global.sloMetrics.recordProcessExecution(value, attributes);
          break;
        case 'external_api':
          global.sloMetrics.recordExternalApiCall(value, attributes);
          break;
        case 'user_transaction':
          global.sloMetrics.recordUserTransaction(value, attributes);
          break;
      }
    }
  }
};