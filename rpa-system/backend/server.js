// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { logger } = require('./utils/logger');
// ✅ OBSERVABILITY: Initialize OpenTelemetry FIRST (before anything else)
// All telemetry flows through OpenTelemetry -> OTEL Collector -> Prometheus/Tempo/Grafana
// Telemetry is ALWAYS enabled - DISABLE_TELEMETRY is ignored
try {
 logger.info('[server] Initializing OpenTelemetry...');
 require('./middleware/telemetryInit');
 logger.info('[server] ✅ OpenTelemetry initialized - traces flowing to Tempo, metrics to Prometheus');
} catch (e) {
 logger.error('[server] ❌ OpenTelemetry initialization failed - observability disabled', {
 error: e?.message,
 stack: e?.stack,
 code: e?.code
 });
}

// Initialize New Relic monitoring SECOND (if needed)
if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_ENABLED !== 'false') {
 require('./newrelic');
 logger.info('🚀 New Relic monitoring initialized for', process.env.NEW_RELIC_APP_NAME || 'EasyFlow-Automation-Service');
}

// Minimal HTTP server bootstrap for production
// Use factory to avoid side effects during tests
const { createApp } = require('./app');
const app = createApp();

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

// Only start the server when this file is run directly and not under Jest.
// This avoids binding the port during test runs when the app is imported by Jest.
if (require.main === module && process.env.NODE_ENV !== 'test') {
 // ✅ DATABASE WARM-UP: Block server startup until database is ready
 // This prevents "cold start" query timeout issues with serverless databases
 // By warming up during startup (when no users are waiting), we eliminate
 // timeout errors for the first user request.
 (async () => {
 try {
 logger.info('[server] Starting database warm-up process...');

 const { getSupabase } = require('./utils/supabaseClient');
 const supabase = getSupabase();

 if (supabase) {
 logger.info('[server] Warming up database connection before accepting requests...');

 // Simple, fast query to wake up the database connection
 // This blocks startup until database is ready, ensuring first request succeeds
 const { error } = await supabase
 .from('workflows')
 .select('id')
 .limit(1);

 if (error) {
 logger.error('[server] ❌ Database warm-up failed - server will not start', {
 error: error.message,
 code: error.code,
 details: error.details
 });
 process.exit(1); // Fail loudly - don't start in broken state
 }

 logger.info('[server] ✅ Database warm-up completed - connection ready');
 } else {
 logger.warn('[server] ⚠️ Supabase not configured - skipping database warm-up');
 }

 // ✅ RAG INITIALIZATION: Seed knowledge base on startup (non-blocking)
 // This ensures the AI assistant has access to EasyFlow knowledge
 if (process.env.RAG_AUTO_SEED !== 'false') {
 try {
 const ragClient = require('./services/ragClient');
 const aiAgent = require('./services/aiWorkflowAgent');

 // Initialize RAG knowledge asynchronously (don't block server startup)
 setImmediate(async () => {
 try {
 logger.info('[server] 🧠 Initializing RAG knowledge base...');
 const result = await aiAgent.initializeKnowledge();

 if (result.success) {
 logger.info('[server] ✅ RAG knowledge base initialized', {
 method: result.method,
 successCount: result.successCount,
 errorCount: result.errorCount
 });
 } else {
 logger.warn('[server] ⚠️ RAG knowledge initialization failed (non-critical)', {
 error: result.error,
 hint: result.hint || 'RAG service may not be running - AI assistant will work but with limited knowledge'
 });
 }
 } catch (ragError) {
 logger.warn('[server] ⚠️ RAG initialization error (non-critical)', {
 error: ragError.message,
 hint: 'RAG service may not be running. Start it with: cd /Users/ky/rag-node-ts && npm run dev'
 });
 }
 });
 } catch (ragInitError) {
 logger.warn('[server] ⚠️ RAG client not available (non-critical)', {
 error: ragInitError.message,
 hint: 'RAG integration is optional - server will start without it'
 });
 }
 } else {
 logger.info('[server] RAG auto-seeding disabled (RAG_AUTO_SEED=false)');
 }

 // ✅ WORKFLOW WORKER: Start background worker for async workflow execution
 let workflowWorker = null;
 if (process.env.WORKFLOW_WORKER_ENABLED !== 'false') {
   try {
     const { WorkflowWorker } = require('./workers/workflowWorker');
     workflowWorker = new WorkflowWorker();
     workflowWorker.start();
     logger.info('[server] ✅ Workflow execution worker started');
   } catch (workerError) {
     logger.warn('[server] ⚠️ Failed to start workflow worker (non-critical)', {
       error: workerError.message,
       hint: 'Workflow executions may not process. Ensure Redis is running and REDIS_URL is configured.'
     });
   }
 }

 // Start server only after database is ready (or confirmed not needed)
 app.listen(PORT, HOST, () => {
   logger.info(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`, {
     port: PORT,
     host: HOST,
     environment: process.env.NODE_ENV || 'development'
   });
   logger.info('[server] Ready to accept requests - database connection established');

   if (workflowWorker) {
     logger.info('[server] ✅ Workflow execution worker is running');
   }
   });

   // Graceful shutdown
   process.on('SIGTERM', async () => {
     logger.info('[server] SIGTERM received, shutting down gracefully...');
     if (workflowWorker) {
       await workflowWorker.stop();
     }
     process.exit(0);
   });

 } catch (error) {
 logger.fatal('[server] ❌ Failed to start server', {
 error: error?.message || String(error),
 stack: error?.stack,
 code: error?.code
 });
 process.exit(1); // Fail loudly - don't start in broken state
 }
 })();
}
