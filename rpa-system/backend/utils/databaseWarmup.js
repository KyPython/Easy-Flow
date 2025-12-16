/**
 * Database Warm-Up Utility
 * 
 * Prevents "cold start" query timeout issues by waking up the database
 * connection when the server starts. This is especially important for
 * serverless/auto-scaling databases like Supabase that may pause inactive instances.
 * 
 * Problem: First request after inactivity times out while database wakes up
 * Solution: Run a lightweight query on startup to establish connection
 * 
 * NOTE: The main warm-up is now handled directly in server.js with blocking behavior.
 * This utility is kept for health check endpoint warm-up (non-blocking).
 */

const { getSupabase } = require('./supabaseClient');
const { logger } = require('./logger');

/**
 * Warm up the database connection by running a lightweight query
 * This wakes up paused database instances and establishes a connection pool
 * 
 * @param {Object} options - Warm-up options
 * @param {number} options.timeout - Maximum time to wait for warm-up (ms), default 30000
 * @param {boolean} options.failSilently - If true, log warnings instead of throwing, default true
 * @returns {Promise<boolean>} - True if warm-up succeeded, false otherwise
 */
async function warmupDatabase(options = {}) {
  const {
    timeout = 30000, // 30 seconds max wait
    failSilently = true // Don't crash server if warm-up fails
  } = options;

  const startTime = Date.now();
  logger.info('[DatabaseWarmup] Starting database warm-up...');

  try {
    const supabase = getSupabase();
    
    if (!supabase) {
      const message = '[DatabaseWarmup] Supabase not configured - skipping warm-up';
      if (failSilently) {
        logger.warn(message);
        return false;
      }
      throw new Error(message);
    }

    // Run a lightweight query that:
    // 1. Wakes up the database connection
    // 2. Verifies connectivity
    // 3. Doesn't require any data to exist
    // Using a simple SELECT 1 query wrapped in a timeout
    const warmupPromise = supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .limit(0); // Don't fetch any rows, just wake up the connection

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database warm-up timeout')), timeout)
    );

    await Promise.race([warmupPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    logger.info(`[DatabaseWarmup] ✅ Database warm-up completed in ${duration}ms`);

    return true;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error?.message || String(error);
    
    if (failSilently) {
      logger.warn(`[DatabaseWarmup] ⚠️ Database warm-up failed after ${duration}ms: ${errorMessage}`);
      logger.warn('[DatabaseWarmup] Server will continue - first request may be slower');
      return false;
    }

    logger.error(`[DatabaseWarmup] ❌ Database warm-up failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Warm up database with retry logic
 * Useful for environments where database may take longer to wake up
 * 
 * @param {Object} options - Warm-up options
 * @param {number} options.maxRetries - Maximum retry attempts, default 2
 * @param {number} options.retryDelay - Delay between retries (ms), default 2000
 * @param {number} options.timeout - Timeout per attempt (ms), default 30000
 * @returns {Promise<boolean>} - True if warm-up succeeded, false otherwise
 */
async function warmupDatabaseWithRetry(options = {}) {
  const {
    maxRetries = 2,
    retryDelay = 2000,
    timeout = 30000
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      logger.info(`[DatabaseWarmup] Retry attempt ${attempt}/${maxRetries} after ${retryDelay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    const success = await warmupDatabase({ timeout, failSilently: attempt < maxRetries });
    
    if (success) {
      return true;
    }
  }

  logger.warn(`[DatabaseWarmup] ⚠️ Database warm-up failed after ${maxRetries + 1} attempts`);
  return false;
}

module.exports = {
  warmupDatabase,
  warmupDatabaseWithRetry
};

