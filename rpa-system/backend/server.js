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
  // ✅ DATABASE WARM-UP: Block server startup until database is ready
  // This prevents "cold start" query timeout issues with serverless databases
  // By warming up during startup (when no users are waiting), we eliminate
  // timeout errors for the first user request.
  (async () => {
    try {
      console.log('[server] Starting database warm-up process...');
      logger.info('[server] Starting database warm-up process...');
      
      const { getSupabase } = require('./utils/supabaseClient');
      const supabase = getSupabase();
      
      if (supabase) {
        console.log('[server] Warming up database connection before accepting requests...');
        logger.info('[server] Warming up database connection before accepting requests...');
        
        // Simple, fast query to wake up the database connection
        // This blocks startup until database is ready, ensuring first request succeeds
        const { error } = await supabase
          .from('workflows')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('[server] ❌ Database warm-up failed - server will not start');
          console.error('[server] Database error:', error.message);
          logger.error('[server] ❌ Database warm-up failed - server will not start');
          logger.error('[server] Database error:', error.message);
          process.exit(1); // Fail loudly - don't start in broken state
        }
        
        console.log('[server] ✅ Database warm-up completed - connection ready');
        logger.info('[server] ✅ Database warm-up completed - connection ready');
      } else {
        console.warn('[server] ⚠️ Supabase not configured - skipping database warm-up');
        logger.warn('[server] ⚠️ Supabase not configured - skipping database warm-up');
      }
      
      // Start server only after database is ready (or confirmed not needed)
      app.listen(PORT, HOST, () => {
        console.log(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`);
        console.log(`[server] Ready to accept requests - database connection established`);
        logger.info(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`);
        logger.info(`[server] Ready to accept requests - database connection established`);
      });
      
    } catch (error) {
      console.error('[server] ❌ Failed to start server:', error);
      console.error('[server] Database connection failed - server will not start');
      logger.fatal('[server] ❌ Failed to start server:', error);
      logger.fatal('[server] Database connection failed - server will not start');
      process.exit(1); // Fail loudly - don't start in broken state
    }
  })();
}
