/**
 * Authentication Middleware
 * Provides requireAuth middleware with dev bypass support
 */

const { getSupabase } = require('../utils/supabaseClient');
const { createLogger } = require('../middleware/structuredLogging');
const { checkDevBypass } = require('./devBypassAuth');

const logger = createLogger('middleware.auth');

/**
 * Require authentication middleware
 * Checks for valid JWT token or dev bypass
 * Sets req.user if authenticated
 */
const requireAuth = async (req, res, next) => {
 try {
 // ✅ SECURITY: Check dev bypass first (only works in development)
 const devUser = checkDevBypass(req);
 if (devUser) {
 req.user = devUser;
 req.devBypass = true;
 req.devUser = { id: devUser.id, isDevBypass: true };
 return next();
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const authHeader = (req.get('authorization') || '').trim();
 const parts = authHeader.split(' ');
 const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

 if (!token) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { data, error } = await supabase.auth.getUser(token);
 if (error || !data || !data.user) {
 return res.status(401).json({ error: 'Authentication failed' });
 }

 req.user = data.user;
 next();
 } catch (error) {
 logger.error('Auth middleware error:', { error: error.message, path: req.path });
 res.status(401).json({ error: 'Authentication failed' });
 }
};

module.exports = {
 requireAuth
};

