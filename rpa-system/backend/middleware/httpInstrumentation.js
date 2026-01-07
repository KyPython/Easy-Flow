/**
 * HTTP Client Instrumentation for External API Calls
 * Provides automatic span creation and trace header propagation for HTTP requests
 */

const axios = require('axios');
const { getCurrentTraceContext, createContextLogger } = require('../middleware/traceContext');

class InstrumentedAxiosClient {
  constructor(baseConfig = {}) {
    this.logger = createContextLogger('http.client');

    // Create axios instance with instrumentation
    this.client = axios.create({
      ...baseConfig,
      timeout: baseConfig.timeout || 30000
    });

    // Add request interceptor for trace propagation
    this.client.interceptors.request.use(
      (config) => this._instrumentRequest(config),
      (error) => this._handleRequestError(error)
    );

    // Add response interceptor for timing and logging
    this.client.interceptors.response.use(
      (response) => this._instrumentResponse(response),
      (error) => this._handleResponseError(error)
    );
  }

  /**
   * Instrument outgoing HTTP request
   */
  _instrumentRequest(config) {
    const startTime = Date.now();
    const traceContext = getCurrentTraceContext();

    // Add trace headers for external service correlation
    if (!config.headers) config.headers = {};

    if (traceContext.traceparent) {
      config.headers['traceparent'] = traceContext.traceparent;
    }
    if (traceContext.traceId) {
      config.headers['x-trace-id'] = traceContext.traceId;
    }
    if (traceContext.requestId) {
      config.headers['x-request-id'] = traceContext.requestId;
    }
    if (traceContext.userId) {
      config.headers['x-user-id'] = traceContext.userId;
    }

    // Store timing and context for response handling
    config._instrumentationStart = startTime;
    config._traceContext = traceContext;

    // Log request start
    this.logger.info('HTTP request started', {
      http: {
        method: config.method?.toUpperCase() || 'GET',
        url: this._sanitizeUrl(config.url),
        baseURL: config.baseURL,
        hasAuth: !!(config.headers.Authorization || config.headers.authorization),
        hasTraceHeaders: !!traceContext.traceparent,
        timeout: config.timeout
      },
      span: {
        operation: 'HTTP_REQUEST',
        service: this._extractServiceName(config.url, config.baseURL),
        startTime: new Date(startTime).toISOString()
      }
    });

    return config;
  }

  /**
   * Handle request errors
   */
  _handleRequestError(error) {
    this.logger.error('HTTP request setup failed', {
      error: {
        message: error.message,
        type: error.constructor.name
      }
    });
    return Promise.reject(error);
  }

  /**
   * Instrument HTTP response
   */
  _instrumentResponse(response) {
    const duration = Date.now() - (response.config._instrumentationStart || Date.now());
    const traceContext = response.config._traceContext || {};

    this.logger.info('HTTP request completed', {
      http: {
        method: response.config.method?.toUpperCase() || 'GET',
        url: this._sanitizeUrl(response.config.url),
        statusCode: response.status,
        statusText: response.statusText,
        responseSize: this._getResponseSize(response),
        contentType: response.headers['content-type']
      },
      span: {
        operation: 'HTTP_REQUEST',
        service: this._extractServiceName(response.config.url, response.config.baseURL),
        duration,
        status: 'success'
      },
      performance: { duration }
    });

    return response;
  }

  /**
   * Handle HTTP response errors
   */
  _handleResponseError(error) {
    const duration = error.config
      ? Date.now() - (error.config._instrumentationStart || Date.now())
      : 0;

    const traceContext = error.config?._traceContext || {};

    this.logger.error('HTTP request failed', {
      http: {
        method: error.config?.method?.toUpperCase() || 'UNKNOWN',
        url: this._sanitizeUrl(error.config?.url),
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        errorCode: error.code
      },
      span: {
        operation: 'HTTP_REQUEST',
        service: this._extractServiceName(error.config?.url, error.config?.baseURL),
        duration,
        status: 'error'
      },
      error: {
        message: error.message,
        type: error.constructor.name,
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: !error.response
      },
      performance: { duration }
    });

    return Promise.reject(error);
  }

  /**
   * Sanitize URL for logging (remove sensitive data)
   */
  _sanitizeUrl(url) {
    if (!url) return 'unknown';

    try {
      const urlObj = new URL(url);
      // Remove query parameters that might contain sensitive data
      const sensitiveParams = ['key', 'token', 'secret', 'password', 'auth', 'api_key'];
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });
      return urlObj.toString();
    } catch {
      return url.split('?')[0]; // Just return path if URL parsing fails
    }
  }

  /**
   * Extract service name from URL for better observability
   */
  _extractServiceName(url, baseURL) {
    try {
      const fullUrl = baseURL ? `${baseURL}${url}` : url;
      const hostname = new URL(fullUrl).hostname;

      // Map common services to readable names
      const serviceMap = {
        'api.openai.com': 'openai',
        'api.anthropic.com': 'anthropic',
        'hooks.slack.com': 'slack-webhooks',
        'api.slack.com': 'slack-api',
        'api.dropbox.com': 'dropbox',
        'www.googleapis.com': 'google-apis',
        'api.github.com': 'github',
        'quickbooks-sandbox.api.intuit.com': 'quickbooks-sandbox',
        'sandbox-quickbooks.api.intuit.com': 'quickbooks-sandbox',
        'api.quickbooks.com': 'quickbooks'
      };

      return serviceMap[hostname] || hostname || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get response size for performance tracking
   */
  _getResponseSize(response) {
    const contentLength = response.headers['content-length'];
    if (contentLength) return parseInt(contentLength, 10);

    // Estimate size if content-length not available
    if (response.data) {
      if (typeof response.data === 'string') return response.data.length;
      if (typeof response.data === 'object') {
        try {
          return JSON.stringify(response.data).length;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Proxy all axios methods through instrumented client
   */
  get(url, config) {
    return this.client.get(url, config);
  }

  post(url, data, config) {
    return this.client.post(url, data, config);
  }

  put(url, data, config) {
    return this.client.put(url, data, config);
  }

  patch(url, data, config) {
    return this.client.patch(url, data, config);
  }

  delete(url, config) {
    return this.client.delete(url, config);
  }

  head(url, config) {
    return this.client.head(url, config);
  }

  options(url, config) {
    return this.client.options(url, config);
  }

  request(config) {
    return this.client.request(config);
  }
}

/**
 * Factory function to create instrumented HTTP client
 */
function createInstrumentedHttpClient(config = {}) {
  return new InstrumentedAxiosClient(config);
}

/**
 * Create instrumented axios instance (for backward compatibility)
 */
function createInstrumentedAxios(config = {}) {
  const client = new InstrumentedAxiosClient(config);
  return client.client; // Return the underlying axios instance
}

module.exports = {
  InstrumentedAxiosClient,
  createInstrumentedHttpClient,
  createInstrumentedAxios
};
