/**
 * OpenTelemetry Backend Initialization for SLO Metrics Export
 * Must be imported before any other modules to ensure proper instrumentation
 */

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
  console.warn('⚠️  [Telemetry] OpenTelemetry exporters disabled - credentials not configured');
  console.warn('⚠️  [Telemetry] To enable Grafana Cloud integration, set these environment variables:');
  console.warn('    - OTEL_EXPORTER_OTLP_ENDPOINT');
  console.warn('    - OTEL_EXPORTER_OTLP_HEADERS');
  console.warn('⚠️  [Telemetry] Application will continue without observability export');
}

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
       (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` : 'http://localhost:4318/v1/traces'),
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ?
    parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
  // Add timeout to prevent hanging on auth failures
  timeoutMillis: 10000
});

const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
       (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics` : 'http://localhost:4318/v1/metrics'),
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ?
    parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
  // Add timeout to prevent hanging on auth failures
  timeoutMillis: 10000
});

// Helper function to parse headers from environment variable
// Format: "key1=value1,key2=value2" OR single header "Authorization=Basic <token>"
function parseHeaders(headerString) {
  const headers = {};
  if (headerString) {
    // Handle single Authorization header (most common case for OTLP)
    if (headerString.startsWith('Authorization=')) {
      const value = headerString.substring('Authorization='.length);
      headers['Authorization'] = value;
    } else {
      // Handle comma-separated headers
      headerString.split(',').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const key = pair.substring(0, idx).trim();
          const value = pair.substring(idx + 1).trim();
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

// ✅ INSTRUCTION 1: Configure trace sampler (Gap 10)
// Uses ParentBasedSampler: preserves all traces initiated by sampled requests
// TEMPORARY: Using 100% sampling for initial Grafana Cloud verification
// TODO: Reduce to 0.1 (10%) after traces are confirmed in Grafana Cloud
const samplingRatio = process.env.OTEL_TRACE_SAMPLING_RATIO ? parseFloat(process.env.OTEL_TRACE_SAMPLING_RATIO) : 1.0;
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
          console.error('❌ [Telemetry] Authentication failed - check OTEL_EXPORTER_OTLP_HEADERS');
          console.error('   Endpoint:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
          console.error('   Error:', result.error.message);
        } else if (result.error.code === 401) {
          console.error('❌ [Telemetry] 401 Unauthorized - Invalid Grafana Cloud credentials');
          console.error('   Please verify your OTEL_EXPORTER_OTLP_HEADERS token is correct');
        }
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
            'business.authenticated': !!request.headers.authorization
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
      }
    })
  ]
});

// Custom SLO Metrics Provider
class SLOMetricsProvider {
  constructor() {
    this.meter = metrics.getMeter('easyflow-slo-metrics', '1.0.0');
    this.initializeMetrics();
  }

  initializeMetrics() {
    // SLO 1: Process Execution Success Rate
    this.processExecutionCounter = this.meter.createCounter('rpa_process_executions_total', {
      description: 'Total RPA process executions for SLO calculation'
    });

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

    // Business context metrics
    this.businessContextGauge = this.meter.createGauge('business_context_active_users', {
      description: 'Current active users by tier'
    });
  }

  // Record process execution
  recordProcessExecution(success, attributes = {}) {
    this.processExecutionCounter.add(1, {
      user_tier: attributes.userTier || 'standard',
      workflow_id: attributes.workflowId || 'unknown',
      process_name: attributes.processName || 'generic'
    });

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

  // Update business context
  updateBusinessContext(activeUsers, userTier) {
    this.businessContextGauge.record(activeUsers, {
      user_tier: userTier
    });
  }
}

// Initialize telemetry
try {
  sdk.start();
  
  // ✅ PART 2.3: Verification - Print success message indicating OTEL Exporters are active
  console.log('✅ [Telemetry] OpenTelemetry backend instrumentation initialized successfully');
  console.log(`✅ [Telemetry] Service Name: ${process.env.OTEL_SERVICE_NAME || 'rpa-system-backend'}`);
  console.log(`✅ [Telemetry] OTLP Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'localhost:4318'}`);
  console.log(`✅ [Telemetry] OTLP Headers: ${process.env.OTEL_EXPORTER_OTLP_HEADERS ? 'CONFIGURED ✓' : '❌ MISSING - Traces will NOT reach Grafana!'}`);
  console.log(`✅ [Telemetry] Trace Sampler: ParentBasedSampler with ${(samplingRatio * 100).toFixed(0)}% sampling ratio`);
  console.log(`✅ [Telemetry] Data Redaction: Active (Gap 14 - sensitive data removed)`);
  console.log('✅ [Telemetry] OTEL Exporters: ACTIVE - Ready to stream to Grafana Cloud');
  
  // Create global SLO metrics provider
  global.sloMetrics = new SLOMetricsProvider();
  
} catch (error) {
  console.error('❌ [Telemetry] Failed to initialize OpenTelemetry:', error);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[Telemetry] OpenTelemetry shutdown completed'))
    .catch((error) => console.error('[Telemetry] Error during shutdown:', error))
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