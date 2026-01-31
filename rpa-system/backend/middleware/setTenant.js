// Middleware to set Postgres session tenant for request scope
// Usage: app.use(require('./middleware/setTenant')({ pool, jwtSecret }))
const jwt = require('jsonwebtoken');

module.exports = function ({ pool, jwtSecret } = {}) {
  if (!pool) throw new Error('Postgres pool is required');

  return async function setTenant(req, res, next) {
    try {
      // Priority: explicit header, then token 'tenant' claim
      const headerTenant = req.headers['x-tenant-id'];
      let tenant = headerTenant;

      if (!tenant) {
        const auth = req.headers.authorization || '';
        const token = auth.replace(/^Bearer\s+/i, '');
        if (token) {
          try {
            const payload = jwt.verify(token, jwtSecret || process.env.SESSION_SECRET || process.env.JWT_SECRET);
            tenant = payload && (payload.tenant || payload.tenant_id || payload.tid);
          } catch (e) {
            // ignore token errors here; auth middleware should handle rejection
          }
        }
      }

      if (tenant) {
        // set_config for this backend connection so subsequent queries see current_tenant
        await pool.query("SELECT set_config('app.current_tenant', $1, true)", [String(tenant)]);
        // attach to request for downstream use
        req.currentTenant = String(tenant);
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
