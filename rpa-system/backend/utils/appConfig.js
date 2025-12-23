/**
 * Centralized Application Configuration
 * All hardcoded values should be moved here and made configurable via environment variables
 */

const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('config.appConfig');

/**
 * Get environment variable with fallback
 */
function getEnv(key, defaultValue = undefined) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value;
}

/**
 * Get environment variable as number
 */
function getEnvNumber(key, defaultValue = 0) {
  const value = getEnv(key);
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(key, defaultValue = false) {
  const value = getEnv(key);
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Application Configuration
 */
const appConfig = {
  // Server Configuration
  server: {
    port: getEnvNumber('PORT', 3030),
    host: getEnv('HOST', '0.0.0.0'),
    nodeEnv: getEnv('NODE_ENV', 'development'),
  },

  // API URLs
  urls: {
    // Backend API
    apiBase: getEnv('API_BASE_URL', getEnv('REACT_APP_API_BASE', '')),
    backendUrl: getEnv('BACKEND_URL', getEnv('API_BASE_URL', '')),
    
    // Automation Service
    automationUrl: getEnv('AUTOMATION_URL', 'http://127.0.0.1:7070'),
    automationPort: getEnvNumber('AUTOMATION_PORT', 7070),
    
    // Frontend
    frontendUrl: getEnv('FRONTEND_URL', getEnv('PUBLIC_URL', '')),
    
    // Demo Portal
    demoUrl: getEnv('DEMO_URL', '/demo'),
    
    // Support & Contact
    supportEmail: getEnv('SUPPORT_EMAIL', 'support@useeasyflow.com'),
    noreplyEmail: getEnv('NOREPLY_EMAIL', getEnv('SENDGRID_FROM_EMAIL', 'noreply@useeasyflow.com')),
    contactEmail: getEnv('CONTACT_EMAIL', 'contact@useeasyflow.com'),
    
    // External Services
    polarUrl: getEnv('POLAR_URL', 'https://api.polar.sh'),
    hubspotUrl: getEnv('HUBSPOT_URL', 'https://api.hubapi.com'),
    sendgridUrl: getEnv('SENDGRID_URL', 'https://api.sendgrid.com'),
  },

  // Timeouts & Limits
  timeouts: {
    // HTTP Client
    httpDefault: getEnvNumber('HTTP_TIMEOUT', 30000), // 30s
    httpLong: getEnvNumber('HTTP_TIMEOUT_LONG', 120000), // 2min for OCR
    
    // Workflow Execution
    workflowDefault: getEnvNumber('WORKFLOW_TIMEOUT', 300000), // 5min
    workflowMax: getEnvNumber('WORKFLOW_TIMEOUT_MAX', 600000), // 10min
    
    // Browser Automation
    browserDefault: getEnvNumber('BROWSER_TIMEOUT', 30000), // 30s
    browserPageLoad: getEnvNumber('BROWSER_PAGE_LOAD_TIMEOUT', 20000), // 20s
    browserSelector: getEnvNumber('BROWSER_SELECTOR_TIMEOUT', 15000), // 15s
    browserLogin: getEnvNumber('BROWSER_LOGIN_TIMEOUT', 25000), // 25s
    
    // Scraping
    scrapeDefault: getEnvNumber('SCRAPE_TIMEOUT', 30), // 30s
    scrapeMax: getEnvNumber('SCRAPE_TIMEOUT_MAX', 60), // 60s
    
    // Database
    databaseQuery: getEnvNumber('DATABASE_QUERY_TIMEOUT', 30000), // 30s
    databaseConnection: getEnvNumber('DATABASE_CONNECTION_TIMEOUT', 10000), // 10s
  },

  // Retry Configuration
  retries: {
    // Default retry attempts
    maxAttempts: getEnvNumber('MAX_RETRY_ATTEMPTS', 3),
    maxAttemptsLong: getEnvNumber('MAX_RETRY_ATTEMPTS_LONG', 5),
    
    // Backoff delays (milliseconds)
    baseDelay: getEnvNumber('RETRY_BASE_DELAY', 1000), // 1s
    maxDelay: getEnvNumber('RETRY_MAX_DELAY', 30000), // 30s
    
    // Exponential backoff multipliers
    backoffMultiplier: getEnvNumber('RETRY_BACKOFF_MULTIPLIER', 2),
    
    // Specific retry delays
    scrapeBackoff: [0, 5000, 15000], // 0s, 5s, 15s
    httpBackoff: [1000, 2000, 4000], // 1s, 2s, 4s
  },

  // Rate Limits
  rateLimits: {
    // API Rate Limits
    apiWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
    apiMaxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    
    // Workflow Execution Rate Limits
    workflowWindowMs: getEnvNumber('WORKFLOW_RATE_LIMIT_WINDOW_MS', 60000),
    workflowMaxExecutions: getEnvNumber('WORKFLOW_RATE_LIMIT_MAX', 10),
    
    // Scraping Rate Limits
    scrapeWindowMs: getEnvNumber('SCRAPE_RATE_LIMIT_WINDOW_MS', 60000),
    scrapeMaxRequests: getEnvNumber('SCRAPE_RATE_LIMIT_MAX', 20),
  },

  // Feature Flags
  features: {
    telemetry: !getEnvBoolean('DISABLE_TELEMETRY', false),
    emailWorker: getEnvBoolean('ENABLE_EMAIL_WORKER', true),
    analytics: getEnvBoolean('ENABLE_ANALYTICS', true),
    debugging: getEnvBoolean('ENABLE_DEBUGGING', getEnv('NODE_ENV') === 'development'),
  },

  // Demo Configuration
  demo: {
    enabled: getEnvBoolean('DEMO_ENABLED', true),
    username: getEnv('DEMO_USERNAME', 'demo@useeasyflow.com'),
    password: getEnv('DEMO_PASSWORD', ''), // Should be empty for security
    description: getEnv('DEMO_DESCRIPTION', 'EasyFlow demo invoice portal - always available, always works!'),
  },

  // Logging Configuration
  logging: {
    level: getEnv('LOG_LEVEL', getEnv('NODE_ENV') === 'production' ? 'info' : 'debug'),
    sampleRate: getEnvNumber('LOG_SAMPLE_RATE', 1), // 1 = 100%, 0.1 = 10%
  },

  // Cache Configuration
  cache: {
    ttl: getEnvNumber('CACHE_TTL', 300000), // 5 minutes
    maxSize: getEnvNumber('CACHE_MAX_SIZE', 1000),
  },
};

/**
 * Get automation service URL
 * Handles both full URL and port-only configurations
 */
function getAutomationUrl() {
  const url = appConfig.urls.automationUrl;
  // If it's just a port, construct full URL
  if (/^:\d+$/.test(url) || /^\d+$/.test(url)) {
    const port = url.replace(/^:/, '');
    return `http://127.0.0.1:${port}`;
  }
  return url;
}

/**
 * Get API base URL with fallback logic
 */
function getApiBaseUrl() {
  // Priority: explicit env var > auto-detect > fallback
  if (appConfig.urls.apiBase) {
    return appConfig.urls.apiBase;
  }
  
  if (appConfig.urls.backendUrl) {
    return appConfig.urls.backendUrl;
  }
  
  // Auto-detect based on environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:${appConfig.server.port}`;
    }
    
    // Production - use same origin
    return window.location.origin;
  }
  
  // Server-side fallback
  return '';
}

/**
 * Validate configuration on startup
 */
function validateConfig() {
  const errors = [];
  
  // Required for production
  if (appConfig.server.nodeEnv === 'production') {
    if (!appConfig.urls.supportEmail) {
      errors.push('SUPPORT_EMAIL is required in production');
    }
    if (!appConfig.urls.noreplyEmail) {
      errors.push('NOREPLY_EMAIL is required in production');
    }
  }
  
  if (errors.length > 0) {
    logger.error('Configuration validation failed', { errors });
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
  
  logger.info('Configuration validated successfully', {
    nodeEnv: appConfig.server.nodeEnv,
    port: appConfig.server.port,
    automationUrl: getAutomationUrl(),
    supportEmail: appConfig.urls.supportEmail,
  });
}

// Validate on module load
if (require.main !== module) {
  // Only validate when imported, not when run directly
  try {
    validateConfig();
  } catch (error) {
    logger.warn('Configuration validation warning (non-fatal)', { error: error.message });
  }
}

module.exports = {
  config: appConfig,
  getAutomationUrl,
  getApiBaseUrl,
  getEnv,
  getEnvNumber,
  getEnvBoolean,
  validateConfig,
};

