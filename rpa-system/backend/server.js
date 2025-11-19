// ✅ Initialize OpenTelemetry FIRST (before anything else, including New Relic)
// Allow disabling telemetry during local dev (avoids requiring heavy OTEL deps)
if (process.env.DISABLE_TELEMETRY !== 'true') {
  try {
    require('./middleware/telemetryInit');
  } catch (e) {
    console.warn('[server] telemetryInit failed to load - continuing without telemetry:', e?.message || e);
  }
} else {
  console.warn('[server] Telemetry disabled via DISABLE_TELEMETRY=true');
}

// Initialize New Relic monitoring SECOND (if needed)
if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_ENABLED !== 'false') {
  require('./newrelic');
  console.log('🚀 New Relic monitoring initialized for', process.env.NEW_RELIC_APP_NAME || 'EasyFlow-Automation-Service');
}

// Minimal HTTP server bootstrap for production
const app = require('./app');

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

// Only start the server when this file is run directly. This avoids binding the
// port during test runs when the app is required by Jest.
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`);
  });
}
