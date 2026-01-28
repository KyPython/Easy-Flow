// Lightweight logger facade for the backend
// Exposes a default `logger` instance and a `getLogger(namespace)` helper
const { createLogger, rootLogger } = require('../middleware/structuredLogging');

// Default app logger (namespace: app)
const logger = createLogger('app');

function getLogger(namespace = 'app', context = {}) {
 try {
 return createLogger(namespace, context);
 } catch (e) {
 // Fallback to rootLogger to avoid crashing logging paths
 return {
 info: (...args) => { try { rootLogger.info(...args); } catch (_e) { /* ignore */ } },
 warn: (...args) => { try { rootLogger.warn(...args); } catch (_e) { /* ignore */ } },
 error: (...args) => { try { rootLogger.error(...args); } catch (_e) { /* ignore */ } },
 debug: (...args) => { try { rootLogger.debug(...args); } catch (_e) { /* ignore */ } },
 trace: (...args) => { try { rootLogger.trace(...args); } catch (_e) { /* ignore */ } }
 };
 }
}

// Convenience wrappers that preserve console.* return behavior (undefined)
module.exports = {
 logger,
 getLogger
};
