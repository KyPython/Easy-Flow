
const { logger } = require('../utils/logger');
// Dev bypass middleware
// Enables a safe, auditable dev-only bypass when NODE_ENV !== 'production'
// Use header `x-dev-bypass: <DEV_BYPASS_TOKEN>` and set DEV_USER_ID in your local .env
// This middleware should be mounted early (before auth/plan checks)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = function devBypassMiddleware(req, res, next) {
 try {
 if (process.env.NODE_ENV === 'production') return next();

 const header = (req.headers['x-dev-bypass'] || '').trim();
 const expected = (process.env.DEV_BYPASS_TOKEN || '').trim();
 if (!expected || !header) return next();

 if (header === expected) {
 // Mark that the request used the dev bypass
 req.devBypass = true;
 // Provide a dev user identity for downstream code that expects req.user
 req.user = req.user || {};
 if (!req.user.id) req.user.id = process.env.DEV_USER_ID || req.user.id || null;
 // Attach a short descriptor
 req.devUser = { id: req.user.id, isDevBypass: true };
 // Log with minimal information for audit (do not log the token)
 logger.warn('[dev-bypass] granted', { ip: req.ip, userId: req.user.id, path: req.path, ts: new Date().toISOString() });
 }
 } catch (err) {
 logger.warn('[dev-bypass] middleware error', err?.message || err);
 }
 return next();
};
