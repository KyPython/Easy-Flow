/**
 * OpenTelemetry Web SDK Configuration for Frontend UX Metrics
 * Tracks component render times, user interactions, and API response times
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { WebSDK } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

// Custom performance instrumentation
class FrontendPerformanceInstrumentation {
  constructor() {
    this.tracer = trace.getTracer('easyflow-frontend', '1.0.0');
    this.renderSpans = new Map();
    this.interactionSpans = new Map();
  }

  /**
   * Track component render performance
   */
  startComponentRender(componentName, props = {}) {
    const span = this.tracer.startSpan(`component.render.${componentName}`, {
      attributes: {
        'component.name': componentName,
        'component.props_count': Object.keys(props).length,
        'frontend.operation': 'render',
        'frontend.category': 'component'
      }
    });
    
    const spanId = `${componentName}-${Date.now()}`;
    this.renderSpans.set(spanId, span);
    return spanId;
  }

  /**
   * Complete component render tracking
   */
  endComponentRender(spanId, renderResult = {}) {
    const span = this.renderSpans.get(spanId);
    if (span) {
      span.setAttributes({
        'component.rendered_elements': renderResult.elementCount || 0,
        'component.has_errors': !!renderResult.error
      });
      
      if (renderResult.error) {
        span.recordException(renderResult.error);
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      
      span.end();
      this.renderSpans.delete(spanId);
    }
  }

  /**
   * Track user interaction performance
   */
  trackUserInteraction(interactionType, targetElement, metadata = {}) {
    const span = this.tracer.startSpan(`user.interaction.${interactionType}`, {
      attributes: {
        'user.interaction_type': interactionType,
        'user.target_element': targetElement,
        'user.page': window.location.pathname,
        'frontend.operation': 'interaction',
        'frontend.category': 'user_event',
        ...metadata
      }
    });

    return {
      addAttribute: (key, value) => span.setAttributes({ [key]: value }),
      recordError: (error) => {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
      },
      end: () => span.end()
    };
  }

  /**
   * Track API call performance with business context
   */
  trackApiCall(method, url, businessContext = {}) {
    const span = this.tracer.startSpan(`api.call.${method.toUpperCase()}`, {
      attributes: {
        'http.method': method.toUpperCase(),
        'http.url': url,
        'http.route': this._extractRoute(url),
        'frontend.operation': 'api_call',
        'frontend.category': 'network',
        // Business context attributes
        'business.user_id': businessContext.userId,
        'business.operation': businessContext.operation,
        'business.workflow_id': businessContext.workflowId
      }
    });

    return {
      setResponseData: (response) => {
        span.setAttributes({
          'http.status_code': response.status,
          'http.status_text': response.statusText,
          'http.response_size': JSON.stringify(response.data || {}).length,
          'http.response_time': Date.now() - span.startTime
        });
      },
      setError: (error) => {
        span.recordException(error);
        span.setAttributes({
          'http.error_type': error.constructor.name,
          'http.status_code': error.response?.status || 0
        });
        span.setStatus({ code: SpanStatusCode.ERROR });
      },
      end: () => span.end()
    };
  }

  /**
   * Track page load performance
   */
  trackPageLoad(pageName, routeParams = {}) {
    const span = this.tracer.startSpan(`page.load.${pageName}`, {
      attributes: {
        'page.name': pageName,
        'page.url': window.location.href,
        'page.pathname': window.location.pathname,
        'page.route_params_count': Object.keys(routeParams).length,
        'frontend.operation': 'page_load',
        'frontend.category': 'navigation'
      }
    });

    // Capture Web Vitals if available
    if (window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        span.setAttributes({
          'page.load_time': navigation.loadEventEnd - navigation.fetchStart,
          'page.dom_content_loaded': navigation.domContentLoadedEventEnd - navigation.fetchStart,
          'page.first_paint': navigation.responseEnd - navigation.fetchStart
        });
      }
    }

    return {
      addMetric: (key, value) => span.setAttributes({ [key]: value }),
      end: () => span.end()
    };
  }

  /**
   * Extract route pattern from URL
   */
  _extractRoute(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/\/\d+/g, '/:id'); // Replace IDs with placeholder
    } catch {
      return url;
    }
  }
}

// Initialize OpenTelemetry
function initializeFrontendTelemetry() {
  // Only initialize in production or when explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.REACT_APP_ENABLE_TELEMETRY) {
    console.info('[Telemetry] Skipping initialization in development mode');
    return new FrontendPerformanceInstrumentation();
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'easyflow-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.REACT_APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  });

  // Configure exporter (would need backend endpoint in production)
  const exporter = new OTLPTraceExporter({
    url: process.env.REACT_APP_OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces'
  });

  const sdk = new WebSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(exporter, {
      maxExportBatchSize: 100,
      scheduledDelayMillis: 5000,
      maxQueueSize: 1000
    }),
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-document-load': {
          enabled: true
        },
        '@opentelemetry/instrumentation-fetch': {
          enabled: true,
          clearTimingResources: true,
          propagateTraceHeaderCorsUrls: [
            /^http:\/\/localhost:3030\/.*/, // Backend API
            new RegExp(process.env.REACT_APP_API_URL || 'http://localhost:3030')
          ]
        },
        '@opentelemetry/instrumentation-xml-http-request': {
          enabled: true,
          clearTimingResources: true
        },
        '@opentelemetry/instrumentation-user-interaction': {
          enabled: true,
          eventNames: ['click', 'dblclick', 'mousedown', 'mouseup', 'submit']
        }
      })
    ]
  });

  try {
    sdk.start();
    console.info('[Telemetry] Frontend telemetry initialized successfully');
  } catch (error) {
    console.error('[Telemetry] Failed to initialize frontend telemetry:', error);
  }

  return new FrontendPerformanceInstrumentation();
}

// Create global performance tracker
const performanceTracker = initializeFrontendTelemetry();

// React Hook for component instrumentation
export function usePerformanceTracking(componentName) {
  const [renderSpanId, setRenderSpanId] = useState(null);

  useEffect(() => {
    const spanId = performanceTracker.startComponentRender(componentName);
    setRenderSpanId(spanId);

    return () => {
      if (spanId) {
        performanceTracker.endComponentRender(spanId);
      }
    };
  }, [componentName]);

  return {
    trackInteraction: (type, element, metadata) => 
      performanceTracker.trackUserInteraction(type, element, metadata),
    trackApiCall: (method, url, context) => 
      performanceTracker.trackApiCall(method, url, context),
    trackPageLoad: (pageName, params) => 
      performanceTracker.trackPageLoad(pageName, params)
  };
}

// Enhanced API client with automatic instrumentation
export function createInstrumentedApiClient(baseConfig = {}) {
  const api = axios.create(baseConfig);

  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      // Start API call tracking
      const tracker = performanceTracker.trackApiCall(
        config.method || 'GET',
        config.url || '',
        {
          userId: config.headers['x-user-id'],
          operation: config.headers['x-operation'],
          workflowId: config.headers['x-workflow-id']
        }
      );
      
      config._performanceTracker = tracker;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      if (response.config._performanceTracker) {
        response.config._performanceTracker.setResponseData(response);
        response.config._performanceTracker.end();
      }
      return response;
    },
    (error) => {
      if (error.config?._performanceTracker) {
        error.config._performanceTracker.setError(error);
        error.config._performanceTracker.end();
      }
      return Promise.reject(error);
    }
  );

  return api;
}

export { performanceTracker };
export default performanceTracker;