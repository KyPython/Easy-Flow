/**
 * Unified Dev Bypass Authentication Middleware
 * 
 * This middleware provides consistent dev bypass support across all routes.
 * It should be used by any route that has its own auth middleware to ensure
 * dev bypass works consistently throughout the app.
 * 
 * SECURITY: Only works when NODE_ENV !== 'production'
 */

const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('middleware.devBypassAuth');

/**
 * Check if dev bypass should be applied
 * Returns user object if bypass is active, null otherwise
 */
function checkDevBypass(req) {
  // ✅ SECURITY: Never allow bypass in production
  // Double-check: ensure NODE_ENV is explicitly 'production' (case-insensitive)
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return null;
  }
  
  // ✅ SECURITY: Additional safety check - if NODE_ENV is not explicitly set to development,
  // be more restrictive (only allow if explicitly in development mode)
  // This prevents accidental bypass if NODE_ENV is unset or misconfigured
  if (nodeEnv !== 'development' && nodeEnv !== 'dev' && nodeEnv !== 'test') {
    // If NODE_ENV is not explicitly development/test, require explicit DEV_BYPASS_ENABLED flag
    if (process.env.DEV_BYPASS_ENABLED !== 'true') {
      return null;
    }
  }

  // Check for dev bypass token in Authorization header
  const authHeader = (req.get('authorization') || '').trim();
  const parts = authHeader.split(' ');
  const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

  if (process.env.DEV_BYPASS_TOKEN && token === process.env.DEV_BYPASS_TOKEN) {
    return {
      id: process.env.DEV_USER_ID || 'dev-user-123',
      email: 'developer@localhost',
      user_metadata: { name: 'Local Developer' }
    };
  }

  // Check for dev bypass header (x-dev-bypass)
  const header = (req.headers['x-dev-bypass'] || '').trim();
  const expected = (process.env.DEV_BYPASS_TOKEN || '').trim();
  
  if (expected && header === expected) {
    return {
      id: process.env.DEV_USER_ID || 'dev-user-123',
      email: 'developer@localhost',
      user_metadata: { name: 'Local Developer' }
    };
  }

  return null;
}

/**
 * Middleware that applies dev bypass if conditions are met
 * Use this in routes that have their own auth middleware
 */
function devBypassAuthMiddleware(req, res, next) {
  const devUser = checkDevBypass(req);
  
  if (devUser) {
    req.user = devUser;
    req.devBypass = true;
    req.devUser = { id: devUser.id, isDevBypass: true };
    
    logger.warn('[dev-bypass-auth] granted', {
      ip: req.ip,
      userId: devUser.id,
      path: req.path,
      method: req.method
    });
    
    return next();
  }
  
  // Not a dev bypass request, continue to normal auth
  next();
}

/**
 * Helper function to check if request has dev bypass
 * Can be used in route handlers to conditionally skip checks
 */
function hasDevBypass(req) {
  return req.devBypass === true || checkDevBypass(req) !== null;
}

module.exports = {
  checkDevBypass,
  devBypassAuthMiddleware,
  hasDevBypass
};

