const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const router = express.Router();

// ✅ SECURITY: Rate limit expensive file system operations
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const fileSystemLimiter = rateLimit({
 windowMs: 60 * 1000, // 1 minute
 max: isDevelopment || isTest ? 1000 : 20, // Much higher in dev/test
 message: 'Too many file operations, please try again later',
 standardHeaders: true,
 legacyHeaders: false,
 skip: () => isDevelopment || isTest // Skip entirely in dev/test
});

// Create a child logger for frontend logs
const frontendLogger = logger.child({ source: 'frontend' });

// Accept frontend structured logs - integrates with observability pipeline
// Logs are written to the same logging infrastructure as backend logs
router.post('/front-logs', async (req, res) => {
 try {
 const { logs } = req.body || {};
 if (!Array.isArray(logs)) {
 return res.status(400).json({ error: 'logs must be an array' });
 }

 // Process each log entry through our structured logging pipeline
 logs.forEach(entry => {
 try {
 const { level, component, message, data, trace, user, timestamp } = entry;
 const logData = {
 frontend_component: component,
 frontend_data: data,
 frontend_trace: trace,
 frontend_user: user,
 frontend_timestamp: timestamp
 };

 // Route to appropriate log level
 switch (level) {
 case 'error':
 frontendLogger.error(`[FE:${component}] ${message}`, logData);
 break;
 case 'warn':
 frontendLogger.warn(`[FE:${component}] ${message}`, logData);
 break;
 case 'debug':
 frontendLogger.debug(`[FE:${component}] ${message}`, logData);
 break;
 default:
 frontendLogger.info(`[FE:${component}] ${message}`, logData);
 }
 } catch (logErr) {
 console.error('[internal/front-logs] failed to log entry:', logErr?.message || logErr);
 }
 });

 return res.status(204).send();
 } catch (err) {
 try {
 logger.error('[internal/front-logs] failed to process logs', { error: err?.message || err });
 } catch (e) {
 console.error('[internal/front-logs] critical error:', e?.message || e);
 }
 return res.status(500).json({ error: 'failed' });
 }
});

// Accept front-end telemetry / error payloads to help diagnose freezes.
// This endpoint is intentionally public (no auth) so the dev dashboard can POST
// errors when reproducing issues locally. Payloads are written to the repo's
// `diagnostics/` directory to make collection easy.
router.post('/front-errors', fileSystemLimiter, async (req, res) => {
 try {
 const payload = req.body || {};
 const ts = new Date().toISOString().replace(/[:.]/g, '-');
 // Prefer repo-level diagnostics/ if available (repo root is three levels up),
 // otherwise fall back to rpa-system/diagnostics for backward compatibility.
 const repoDiagnostics = path.resolve(__dirname, '..', '..', '..', 'diagnostics');
 const localDiagnostics = path.resolve(__dirname, '..', '..', 'diagnostics');
 let diagDir = repoDiagnostics;
 try {
 // try creating repo-level diagnostics if possible
 fs.mkdirSync(repoDiagnostics, { recursive: true });
 } catch (e) {
 diagDir = localDiagnostics;
 try { fs.mkdirSync(localDiagnostics, { recursive: true }); } catch (_e) { /* ignore */ }
 }
 const filename = path.join(diagDir, `${ts}-frontend-error.json`);
 const meta = {
 received_at: new Date().toISOString(),
 remote_ip: (req.ip || req.headers['x-forwarded-for'] || '').toString(),
 user_agent: req.get('user-agent') || null,
 url: req.body?.url || req.get('referer') || req.get('origin') || null
 };
 const out = { meta, payload };
 fs.writeFileSync(filename, JSON.stringify(out, null, 2), 'utf8');
 logger.info('[internal/front-errors] saved frontend error payload', { file: filename });
 return res.status(204).send();
 } catch (err) {
 try {
 logger.error('[internal/front-errors] failed to persist payload', err?.message || err);
 } catch (e) {
 // Fallback: if logger itself fails, use root logger directly
 const { rootLogger } = require('../middleware/structuredLogging');
 rootLogger.error({ error: e?.message || e }, '[internal/front-errors] logger failed');
 }
 return res.status(500).json({ error: 'failed' });
 }
});

module.exports = router;
