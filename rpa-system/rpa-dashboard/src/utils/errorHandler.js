/**
 * Robust Error Handler with Circuit Breaker Pattern
 * Prevents cascading failures and provides graceful degradation
 */

class CircuitBreaker {
  constructor(failureThreshold = 5, timeout = 60000, monitoringPeriod = 10000) {
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.monitoringPeriod = monitoringPeriod;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
    // Track if the last failure was a backend-unreachable error
    this.lastErrorType = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        // Include the reason in the error for better UX
        const reason = this.lastErrorType === 'BACKEND_UNREACHABLE' 
          ? 'Backend server is not reachable. Please start the API server.'
          : 'Service temporarily unavailable due to repeated failures.';
        throw new Error(`Circuit breaker is OPEN. ${reason}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = null;
    this.lastErrorType = null;
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Classify the error type for better messaging
    this.lastErrorType = classifyErrorType(error);

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      
      // IMPROVED: More specific logging based on error type
      if (this.lastErrorType === 'BACKEND_UNREACHABLE') {
        console.error(`[CircuitBreaker] OPEN - Backend unreachable (ECONNREFUSED). Failures: ${this.failureCount}. Check if API server is running.`);
      } else {
        console.warn(`[CircuitBreaker] OPEN - Too many failures (${this.failureCount}). Next attempt at ${new Date(this.nextAttempt).toLocaleTimeString()}`);
      }
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      lastErrorType: this.lastErrorType
    };
  }
}

/**
 * Classify error type for smarter handling
 * @param {Error} error - The error object (may have response.data from Axios)
 * @returns {'BACKEND_UNREACHABLE' | 'NETWORK' | 'TIMEOUT' | 'SERVER_ERROR' | 'AUTH' | 'UNKNOWN'}
 */
function classifyErrorType(error) {
  const message = error?.message?.toLowerCase() || '';
  const responseData = error?.response?.data || '';
  const responseDataStr = typeof responseData === 'string' ? responseData.toLowerCase() : JSON.stringify(responseData).toLowerCase();
  
  // Check for ECONNREFUSED / Proxy error (backend not running)
  // This is the CRITICAL check for the dev proxy issue
  if (
    message.includes('econnrefused') ||
    responseDataStr.includes('econnrefused') ||
    responseDataStr.includes('proxy error') ||
    responseDataStr.includes('could not proxy')
  ) {
    return 'BACKEND_UNREACHABLE';
  }
  
  if (message.includes('network') || message.includes('fetch failed') || error?.code === 'ERR_NETWORK') {
    return 'NETWORK';
  }
  
  if (message.includes('timeout') || error?.code === 'ECONNABORTED') {
    return 'TIMEOUT';
  }
  
  const status = error?.response?.status;
  if (status >= 500 && status < 600) {
    return 'SERVER_ERROR';
  }
  
  if (status === 401 || status === 403 || message.includes('unauthorized')) {
    return 'AUTH';
  }
  
  return 'UNKNOWN';
}

// Global circuit breakers for different API endpoints
const circuitBreakers = {
  'social-proof': new CircuitBreaker(3, 30000),
  'user-data': new CircuitBreaker(5, 60000),
  'tasks': new CircuitBreaker(3, 45000),
  'files': new CircuitBreaker(4, 30000),
  'track-event': new CircuitBreaker(3, 30000), // Dedicated breaker for tracking
  'general': new CircuitBreaker(5, 60000)
};

// Track if we've already logged the "backend unreachable" message recently
// to avoid spamming the console
let lastBackendUnreachableLog = 0;
const BACKEND_UNREACHABLE_LOG_INTERVAL = 10000; // Only log once per 10 seconds

/**
 * Enhanced API error handler with multiple fallback strategies
 */
export class ApiErrorHandler {
  constructor() {
    this.retryAttempts = new Map(); // Track retry attempts per endpoint
    this.fallbackData = new Map(); // Cache successful responses for fallback
    this.offlineMode = false;
    this.backendUnreachable = false; // NEW: Track if backend is unreachable
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Connection restored');
        this.offlineMode = false;
        this.backendUnreachable = false;
        this.clearRetryAttempts();
      });
      
      window.addEventListener('offline', () => {
        console.log('📡 Connection lost - switching to offline mode');
        this.offlineMode = true;
      });
    }
  }

  /**
   * Get appropriate circuit breaker for endpoint
   */
  getCircuitBreaker(endpoint) {
    if (endpoint.includes('social-proof')) return circuitBreakers['social-proof'];
    if (endpoint.includes('user') || endpoint.includes('auth')) return circuitBreakers['user-data'];
    if (endpoint.includes('task')) return circuitBreakers['tasks'];
    if (endpoint.includes('file')) return circuitBreakers['files'];
    if (endpoint.includes('track-event')) return circuitBreakers['track-event'];
    return circuitBreakers['general'];
  }

  /**
   * Check if an error indicates the backend is unreachable
   */
  isBackendUnreachable(error) {
    return classifyErrorType(error) === 'BACKEND_UNREACHABLE';
  }

  /**
   * Robust API call wrapper with circuit breaker and fallback
   */
  async safeApiCall(operation, options = {}) {
    const {
      endpoint = 'unknown',
      fallbackData = null,
      retries = 2,
      timeout = 15000,
      silentFail = false
    } = options;

    const circuitBreaker = this.getCircuitBreaker(endpoint);
    
    try {
      // Check if we should attempt the call
      if (this.offlineMode && !options.forceOnline) {
        return this.getFallbackResponse(endpoint, fallbackData);
      }

      // NEW: If backend is known to be unreachable, skip immediately for non-critical endpoints
      if (this.backendUnreachable && silentFail) {
        return this.getFallbackResponse(endpoint, fallbackData);
      }

      // Execute with circuit breaker protection
      const result = await circuitBreaker.execute(async () => {
        return await this.executeWithRetry(operation, retries, timeout);
      });

      // Backend is reachable again
      this.backendUnreachable = false;

      // Cache successful response for future fallback
      if (result && typeof result === 'object') {
        this.fallbackData.set(endpoint, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      // NEW: Detect and log backend unreachable errors with throttling
      if (this.isBackendUnreachable(error)) {
        this.backendUnreachable = true;
        const now = Date.now();
        if (now - lastBackendUnreachableLog > BACKEND_UNREACHABLE_LOG_INTERVAL) {
          lastBackendUnreachableLog = now;
          console.error(`[ApiErrorHandler] ❌ Backend not reachable (ECONNREFUSED). Check if API server is running on the expected port.`);
        }
      } else {
        console.warn(`[ApiErrorHandler] ${endpoint} failed:`, error.message);
      }

      if (silentFail) {
        // Only log once, not for every silent failure
        if (!this.isBackendUnreachable(error)) {
          console.log(`[ApiErrorHandler] Silent failure for ${endpoint}, returning fallback`);
        }
        return this.getFallbackResponse(endpoint, fallbackData);
      }

      // Try to return cached data if available
      const cachedResponse = this.getFallbackResponse(endpoint, fallbackData);
      if (cachedResponse) {
        console.log(`[ApiErrorHandler] Using cached data for ${endpoint}`);
        return cachedResponse;
      }

      // If no fallback available, throw a user-friendly error
      throw this.createUserFriendlyError(error, endpoint);
    }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, maxRetries, timeout) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // Add timeout to the operation
        return await this.withTimeout(operation(), timeout);
      } catch (error) {
        lastError = error;
        
        // NEW: Don't retry if backend is unreachable - it won't help
        if (this.isBackendUnreachable(error)) {
          throw error;
        }
        
        if (attempt <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`[ApiErrorHandler] Retry ${attempt}/${maxRetries} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Add timeout to a promise
   */
  withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      })
    ]);
  }

  /**
   * Get fallback response from cache or provided fallback
   */
  getFallbackResponse(endpoint, fallbackData) {
    // Try cached data first (if not too old)
    const cached = this.fallbackData.get(endpoint);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log(`[ApiErrorHandler] Using cached data for ${endpoint} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
      return cached.data;
    }

    // Use provided fallback
    if (fallbackData) {
      // Don't spam logs for fallback usage when backend is down
      if (!this.backendUnreachable) {
        console.log(`[ApiErrorHandler] Using provided fallback for ${endpoint}`);
      }
      return fallbackData;
    }

    return null;
  }

  /**
   * Create user-friendly error messages
   * IMPROVED: Specific handling for ECONNREFUSED/Proxy errors
   */
  createUserFriendlyError(error, endpoint) {
    const errorType = classifyErrorType(error);
    
    switch (errorType) {
      case 'BACKEND_UNREACHABLE':
        // Extract port from error message if possible
        const portMatch = error?.response?.data?.match?.(/localhost:(\d+)/);
        const port = portMatch ? portMatch[1] : '3030';
        return new Error(
          `Backend server is offline (connection refused to :${port}). ` +
          `Please start the API server or check your dev proxy configuration.`
        );
      
      case 'NETWORK':
        return new Error(`Unable to connect to server. Please check your internet connection and try again.`);
      
      case 'TIMEOUT':
        return new Error(`Request timed out. The server might be busy, please try again in a moment.`);
      
      case 'SERVER_ERROR':
        return new Error(`Server error occurred. Our team has been notified. Please try again later.`);
      
      case 'AUTH':
        return new Error(`Your session has expired. Please sign in again.`);
      
      default:
        // Check for 404 separately
        if (error?.response?.status === 404) {
          return new Error(`The requested resource was not found. Please refresh the page.`);
        }
        return new Error(`Something went wrong. Please try again or contact support if the problem persists.`);
    }
  }

  /**
   * Utility methods
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearRetryAttempts() {
    this.retryAttempts.clear();
    this.backendUnreachable = false;
    // Reset circuit breakers when connection is restored
    Object.values(circuitBreakers).forEach(cb => {
      if (cb.state === 'OPEN') {
        cb.state = 'HALF_OPEN';
      }
    });
  }

  /**
   * Get system status for debugging
   */
  getStatus() {
    return {
      offlineMode: this.offlineMode,
      backendUnreachable: this.backendUnreachable,
      cachedEndpoints: Array.from(this.fallbackData.keys()),
      circuitBreakers: Object.entries(circuitBreakers).reduce((acc, [name, cb]) => {
        acc[name] = cb.getStatus();
        return acc;
      }, {})
    };
  }
}

// Export the classifyErrorType for use in other modules
export { classifyErrorType };

// Global instance
export const apiErrorHandler = new ApiErrorHandler();

// Expose for debugging in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window._errorHandler = apiErrorHandler;
}

export default apiErrorHandler;