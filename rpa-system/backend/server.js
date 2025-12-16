// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { logger, getLogger } = require('./utils/logger');
// ✅ OBSERVABILITY: Initialize OpenTelemetry FIRST (before anything else)
// All telemetry flows through OpenTelemetry -> OTEL Collector -> Prometheus/Tempo/Grafana
if (process.env.DISABLE_TELEMETRY !== 'true') {
  try {
    console.log('[server] Initializing OpenTelemetry...');
    require('./middleware/telemetryInit');
    console.log('[server] ✅ OpenTelemetry initialized successfully');
    logger.info('[server] ✅ OpenTelemetry initialized - traces flowing to Tempo, metrics to Prometheus');
  } catch (e) {
    console.error('[server] ❌ OpenTelemetry initialization FAILED:');
    console.error('[server] Error:', e.message);
    console.error('[server] Stack:', e.stack);
    logger.error('[server] ❌ OpenTelemetry initialization failed - observability disabled', {
      error: e?.message,
      stack: e?.stack,
      code: e?.code
    });
  }
} else {
  console.log('[server] Telemetry disabled via DISABLE_TELEMETRY=true');
  logger.info('[server] Telemetry disabled via DISABLE_TELEMETRY=true');
}

// Initialize New Relic monitoring SECOND (if needed)
if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_ENABLED !== 'false') {
  require('./newrelic');
  logger.info('🚀 New Relic monitoring initialized for', process.env.NEW_RELIC_APP_NAME || 'EasyFlow-Automation-Service');
}

// Minimal HTTP server bootstrap for production
const app = require('./app');

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

// Only start the server when this file is run directly. This avoids binding the
// port during test runs when the app is required by Jest.
if (require.main === module) {
  // ✅ DATABASE WARM-UP: Wake up database connection before accepting requests
  // This prevents "cold start" query timeout issues with serverless databases
  const { warmupDatabaseWithRetry } = require('./utils/databaseWarmup');
  
  // Warm up database asynchronously - don't block server startup
  // If warm-up fails, server still starts (first request may be slower)
  warmupDatabaseWithRetry({
    maxRetries: 2,
    retryDelay: 2000,
    timeout: 30000
  }).catch(err => {
    // Already logged in warmupDatabaseWithRetry, just ensure we don't crash
    logger.warn('[server] Database warm-up completed with warnings - server continuing');
  });

  app.listen(PORT, HOST, () => {
    logger.info(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`);
    logger.info(`[server] Database warm-up initiated - connection will be ready for first request`);
  });
}
