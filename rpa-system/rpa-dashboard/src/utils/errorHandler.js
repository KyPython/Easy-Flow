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
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = null;
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.warn(`[CircuitBreaker] OPEN - Too many failures (${this.failureCount}). Next attempt at ${new Date(this.nextAttempt).toLocaleTimeString()}`);
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt
    };
  }
}

// Global circuit breakers for different API endpoints
const circuitBreakers = {
  'social-proof': new CircuitBreaker(3, 30000),
  'user-data': new CircuitBreaker(5, 60000),
  'tasks': new CircuitBreaker(3, 45000),
  'files': new CircuitBreaker(4, 30000),
  'general': new CircuitBreaker(5, 60000)
};

/**
 * Enhanced API error handler with multiple fallback strategies
 */
export class ApiErrorHandler {
  constructor() {
    this.retryAttempts = new Map(); // Track retry attempts per endpoint
    this.fallbackData = new Map(); // Cache successful responses for fallback
    this.offlineMode = false;
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Connection restored');
        this.offlineMode = false;
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
    return circuitBreakers['general'];
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

      // Execute with circuit breaker protection
      const result = await circuitBreaker.execute(async () => {
        return await this.executeWithRetry(operation, retries, timeout);
      });

      // Cache successful response for future fallback
      if (result && typeof result === 'object') {
        this.fallbackData.set(endpoint, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.warn(`[ApiErrorHandler] ${endpoint} failed:`, error.message);

      if (silentFail) {
        console.log(`[ApiErrorHandler] Silent failure for ${endpoint}, returning fallback`);
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
      console.log(`[ApiErrorHandler] Using provided fallback for ${endpoint}`);
      return fallbackData;
    }

    return null;
  }

  /**
   * Create user-friendly error messages
   */
  createUserFriendlyError(error, endpoint) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
      return new Error(`Unable to connect to server. Please check your internet connection and try again.`);
    }
    
    if (message.includes('timeout')) {
      return new Error(`Request timed out. The server might be busy, please try again in a moment.`);
    }
    
    if (message.includes('404')) {
      return new Error(`The requested resource was not found. Please refresh the page.`);
    }
    
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return new Error(`Server error occurred. Our team has been notified. Please try again later.`);
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return new Error(`Your session has expired. Please sign in again.`);
    }

    // Generic fallback
    return new Error(`Something went wrong. Please try again or contact support if the problem persists.`);
  }

  /**
   * Utility methods
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearRetryAttempts() {
    this.retryAttempts.clear();
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
      cachedEndpoints: Array.from(this.fallbackData.keys()),
      circuitBreakers: Object.entries(circuitBreakers).reduce((acc, [name, cb]) => {
        acc[name] = cb.getStatus();
        return acc;
      }, {})
    };
  }
}

// Global instance
export const apiErrorHandler = new ApiErrorHandler();

// Expose for debugging in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window._errorHandler = apiErrorHandler;
}

export default apiErrorHandler;