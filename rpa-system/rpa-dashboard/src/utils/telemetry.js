/**
 * OpenTelemetry Web SDK Configuration for Frontend UX Metrics
 * Tracks component render times, user interactions, and API response times
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';

// Custom performance instrumentation
class FrontendPerformanceInstrumentation {
 constructor() {
 this.tracer = globalThis.trace?.getTracer || (() => ({
    startSpan: () => ({ setStatus: () => {}, end: () => {} }),
    setAttributes: () => {},
    recordException: () => {}
  }));('easyflow-frontend', '1.0.0');
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
 /* eslint-disable-next-line no-undef */
    span.setStatus({ code: typeof SpanStatusCode !== "undefined" ? SpanStatusCode.ERROR : 2 });
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
 /* eslint-disable-next-line no-undef */
    span.setStatus({ code: typeof SpanStatusCode !== "undefined" ? SpanStatusCode.ERROR : 2 });
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
 addAttribute: (key, value) => span.setAttributes({ [key]: value }),
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
 /* eslint-disable-next-line no-undef */
    span.setStatus({ code: typeof SpanStatusCode !== "undefined" ? SpanStatusCode.ERROR : 2 });
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
async function initializeFrontendTelemetry() {
 // Safe helpers to avoid errors when XHR is missing/polyfilled/mocked
 const WRAPPED_FLAG = Symbol.for('easyflow.telemetry.wrapped');
 const isFunction = (fn) => typeof fn === 'function';

 function ensureXhrSafety() {
 try {
 if (typeof XMLHttpRequest === 'undefined') {
 console.warn('[Telemetry] XMLHttpRequest is not available in this environment -- skipping XHR safety patch.');
 return false;
 }

 const proto = XMLHttpRequest.prototype || {};

 ['open', 'send'].forEach((name) => {
 try {
 const orig = proto[name];

 // If it's already marked wrapped by us, skip
 if (orig && orig[WRAPPED_FLAG]) return;

 if (!isFunction(orig)) {
 // Install a safe no-op shim that preserves minimal metadata used by instrumentation
 proto[name] = function(...args) {
 try {
 if (name === 'open') {
 // store last method/url for any later instrumentation that expects them
						try {
							this.__easyflow_lastMethod = String(args[0] || 'GET');
							this.__easyflow_lastUrl = String(args[1] || '(unknown)');
						} catch (err) {
							// eslint-disable-next-line no-console
							console.debug('[Telemetry] failed to set last method/url', err && (err.message || err));
						}
 }
 if (name === 'send') {
 // no-op send shim; do nothing if original missing
 }
 } catch (e) {
 // swallow any errors -- we must not break app
 }
 };
						try {
							proto[name][WRAPPED_FLAG] = true;
						} catch (err) {
							// eslint-disable-next-line no-console
							console.debug('[Telemetry] failed to mark proto as wrapped', name, err && (err.message || err));
						}
 console.warn(`[Telemetry] Installed safe shim for XMLHttpRequest.prototype.${name} to avoid instrumentation errors.`);
 } else {
 // Wrap original idempotently to mark it wrapped (avoid double wraps)
 if (!orig[WRAPPED_FLAG]) {
 const wrapped = function(...args) { return orig.apply(this, args); };
								try {
									wrapped[WRAPPED_FLAG] = true;
								} catch (err) {
									// eslint-disable-next-line no-console
									console.debug('[Telemetry] failed to mark wrapped function', name, err && (err.message || err));
								}
 try { proto[name] = wrapped; } catch (e) { /* ignore assignment failures */ }
 }
 }
 } catch (e) {
 // per-method failure should not stop overall initialization
 console.debug('[Telemetry] ensureXhrSafety per-method error for', name, e && e.message ? e.message : e);
 }
 });

 return true;
 } catch (e) {
 console.debug('[Telemetry] ensureXhrSafety failed', e && e.message ? e.message : e);
 return false;
 }
 }

 // By default do NOT initialize browser OTLP exporters in production.
 // Enable in development, or explicitly opt-in in production via
 // REACT_APP_ENABLE_BROWSER_OTLP=true (build-time env) for advanced cases.
 const enableBrowserOtlp = (process.env.NODE_ENV !== 'production') || (String(process.env.REACT_APP_ENABLE_BROWSER_OTLP).toLowerCase() === 'true') || (String(process.env.REACT_APP_ENABLE_TELEMETRY).toLowerCase() === 'true');

 if (!enableBrowserOtlp) {
 console.info('[Telemetry] Browser telemetry disabled in production (REACT_APP_ENABLE_BROWSER_OTLP not set)');
 // Return a plain instrumentation object that will create spans locally but
 // won't attempt to export them from the browser. Server-side or collector
 // exports should be used in production instead.
 return new FrontendPerformanceInstrumentation();
 }

 // Dynamically import OpenTelemetry packages so they are not included
 // in the main bundle and parsed on-first-load.
 const [{ WebTracerProvider, BatchSpanProcessor }] = [await import('@opentelemetry/sdk-trace-web')];
 const { Resource } = await import('@opentelemetry/resources');
 const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
 const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
 const { getWebAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-web');
 const { trace, context, SpanStatusCode } = await import('@opentelemetry/api');
 const { registerInstrumentations } = await import('@opentelemetry/instrumentation');

 const resource = new Resource({
 [SemanticResourceAttributes.SERVICE_NAME]: 'easyflow-frontend',
 [SemanticResourceAttributes.SERVICE_VERSION]: process.env.REACT_APP_VERSION || '1.0.0',
 [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
 });

 const exporterUrl = process.env.REACT_APP_OTEL_EXPORTER_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4318/v1/traces' : '');
 const exporter = exporterUrl ? new OTLPTraceExporter({ url: exporterUrl }) : null;

 const provider = new WebTracerProvider({ resource });

 if (exporter) {
 provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
 maxExportBatchSize: 100,
 scheduledDelayMillis: 5000,
 maxQueueSize: 1000
 }));
 } else {
 console.info('[Telemetry] No browser exporter configured (exporter URL empty). Spans will not be sent from the browser.');
 }

 provider.register();

 // Ensure XHR safety before registering instrumentations to avoid runtime wrap errors
 const xhrSafe = ensureXhrSafety();

 try {
 const autoInstrOptions = {
 '@opentelemetry/instrumentation-document-load': { enabled: true },
 '@opentelemetry/instrumentation-fetch': {
 enabled: true,
 clearTimingResources: true,
 propagateTraceHeaderCorsUrls: [
 /^http:\/\/localhost:3030\/.*/, // Backend API
 new RegExp(process.env.REACT_APP_API_URL || 'http://localhost:3030')
 ]
 },
 // Only enable XHR instrumentation when environment supports it safely
 '@opentelemetry/instrumentation-xml-http-request': {
 enabled: xhrSafe && typeof XMLHttpRequest !== 'undefined' && typeof XMLHttpRequest.prototype?.open === 'function',
 clearTimingResources: true
 },
 '@opentelemetry/instrumentation-user-interaction': {
 enabled: true,
 eventNames: ['click', 'dblclick', 'mousedown', 'mouseup', 'submit']
 }
 };

 registerInstrumentations({
 instrumentations: [ getWebAutoInstrumentations(autoInstrOptions) ]
 });
 } catch (e) {
 // Fail-safe: instrumentation registration can fail if environment is exotic -- log and continue
 console.warn('[Telemetry] registerInstrumentations failed, continuing without auto-instrumentations:', e && e.message ? e.message : e);
 }

 try {
 console.info('[Telemetry] Frontend telemetry initialized successfully');
 } catch (error) {
 console.error('[Telemetry] Failed to initialize frontend telemetry:', error);
 }

 return new FrontendPerformanceInstrumentation();
}

// NOTE: Do NOT initialize telemetry eagerly at module-load time. Initializing
// the OpenTelemetry web SDK and registering auto-instrumentations can be
// CPU- and IO-intensive and may block the main thread during app startup.
// Instead expose a lazy initializer and a lightweight no-op tracker so the
// app can opt-in to initialize telemetry after the first render.

let _realTracker = null;

const noopTracker = (() => {
 const noopSpan = () => ({ 
 addMetric: () => {}, 
 addAttribute: () => {},
 end: () => {} 
 });
 const noopApiCall = () => ({ 
 addAttribute: () => {}, 
 setResponseData: () => {}, 
 setError: () => {}, 
 end: () => {} 
 });
 const noopInteraction = () => ({
 addAttribute: () => {},
 recordError: () => {},
 end: () => {}
 });
 return {
 startComponentRender: () => null,
 endComponentRender: () => {},
 trackUserInteraction: () => noopInteraction(),
 trackApiCall: () => noopApiCall(),
 trackPageLoad: () => noopSpan()
 };
})();

export function initPerformanceTracker() {
 if (_realTracker) return _realTracker;

 // Start initialization asynchronously so callers don't block on dynamic imports.
 (async () => {
 try {
 const tracker = await initializeFrontendTelemetry();
 _realTracker = tracker || noopTracker;
 // Replace exported tracker reference so other importers see the real tracker
 performanceTracker = _realTracker;
 console.info('[Telemetry] Performance tracker initialized successfully');
 } catch (e) {
 // Fail-safe: if initialization fails, keep using noop tracker
 // and surface a console warning so developers can debug.
 // eslint-disable-next-line no-console
 console.warn('[Telemetry] initPerformanceTracker failed, using no-op tracker:', e && e.message ? e.message : e);
 _realTracker = noopTracker;
 performanceTracker = noopTracker;
 }
 })();

 // Always return a safe tracker immediately
 return noopTracker;
}

// Export a default tracker that is a no-op until `initPerformanceTracker` is called.
export let performanceTracker = noopTracker;

// React Hook for component instrumentation
export function usePerformanceTracking(componentName) {
 const [renderSpanId, setRenderSpanId] = useState(null);

 useEffect(() => {
 const tracker = performanceTracker || noopTracker;
 const spanId = tracker.startComponentRender ? tracker.startComponentRender(componentName) : null;
 setRenderSpanId(spanId);

 return () => {
 if (spanId && tracker.endComponentRender) {
 tracker.endComponentRender(spanId);
 }
 };
 }, [componentName]);

 const safeNoopInteraction = () => ({ addAttribute: () => {}, recordError: () => {}, end: () => {} });
 const safeNoopApiCall = () => ({ addAttribute: () => {}, setResponseData: () => {}, setError: () => {}, end: () => {} });
 const safeNoopPageLoad = () => ({ addMetric: () => {}, end: () => {} });

 return {
 trackInteraction: (type, element, metadata) => {
 const tracker = performanceTracker || noopTracker;
 return tracker && tracker.trackUserInteraction 
 ? tracker.trackUserInteraction(type, element, metadata) 
 : safeNoopInteraction();
 },
 trackApiCall: (method, url, context) => {
 const tracker = performanceTracker || noopTracker;
 return tracker && tracker.trackApiCall 
 ? tracker.trackApiCall(method, url, context) 
 : safeNoopApiCall();
 },
 trackPageLoad: (pageName, params) => {
 const tracker = performanceTracker || noopTracker;
 return tracker && tracker.trackPageLoad 
 ? tracker.trackPageLoad(pageName, params) 
 : safeNoopPageLoad();
 }
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

export default performanceTracker;