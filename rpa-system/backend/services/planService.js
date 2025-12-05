// rpa-system/backend/services/planService.js
// Service to fetch a user's plan, features, and limits from the database (Supabase)

const { createInstrumentedSupabaseClient } = require('../middleware/databaseInstrumentation');
const { createLogger } = require('../middleware/structuredLogging');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
const logger = createLogger('service.plan');

// Throttle repeated error logs to prevent flooding
const errorThrottleCache = new Map(); // userId -> { count, lastLogged, firstSeen }
const ERROR_THROTTLE_WINDOW_MS = 60000; // 1 minute
const MAX_ERRORS_PER_WINDOW = 1; // Only log once per window

function shouldLogError(userId, errorCode) {
  const now = Date.now();
  const key = `${userId}:${errorCode}`;
  const cached = errorThrottleCache.get(key);
  
  if (!cached) {
    errorThrottleCache.set(key, {
      count: 1,
      firstSeen: now,
      lastLogged: now
    });
    return true;
  }
  
  const timeSinceFirst = now - cached.firstSeen;
  const timeSinceLast = now - cached.lastLogged;
  
  // Reset if outside window
  if (timeSinceFirst > ERROR_THROTTLE_WINDOW_MS) {
    cached.count = 1;
    cached.firstSeen = now;
    cached.lastLogged = now;
    return true;
  }
  
  // Check if we should log BEFORE incrementing (prevents race conditions)
  if (timeSinceLast < ERROR_THROTTLE_WINDOW_MS) {
    // Still within throttle window - don't log
    cached.count++;
    return false;
  }
  
  // Enough time has passed - reset and log
  cached.count = 1;
  cached.firstSeen = now;
  cached.lastLogged = now;
  return true;
}

// Make Supabase optional for local development
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabase = createInstrumentedSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  logger.info('Plan service initialized with instrumented database client');
} else {
  logger.warn('Supabase not configured - plan service disabled for local dev');
}

/**
 * Fetch the user's plan, usage, and limits from the database using SQL functions.
 * @param {string} userId
 * @returns {Promise<{plan: object, usage: object, limits: object}>}
 */
async function getUserPlan(userId) {
  if (!supabase) {
    logger.info('Local development mode - returning mock plan data', { userId });
    return {
      plan: { id: 'free', name: 'Free Plan', features: {} },
      usage: { automationsThisMonth: 0, storageUsed: 0 },
      limits: { 
        maxAutomations: 10, 
        maxStorage: 100,
        workflow_executions: true,
        has_workflows: true,
        workflows: 100
      }
    };
  }

  logger.info('Fetching user plan data', { userId });

  // 1. Get the user's plan (join user_profiles -> plans)
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select('plan_id, plan:plans(*)')
    .eq('id', userId)
    .execute();
  
  if (userError || !userProfile) {
    const error = new Error('User profile/plan not found');
    error.code = 'USER_PROFILE_NOT_FOUND';
    error.userId = userId;
    
    // Throttle repeated errors to prevent log flooding
    if (shouldLogError(userId, 'USER_PROFILE_NOT_FOUND')) {
      logger.error('User profile/plan not found', error, { 
        userId,
        database_error: userError,
        business: { 
          operation: { operation_name: 'getUserPlan', user_id: userId }
        }
      });
    }
    throw error;
  }
  const plan = userProfile.plan;

  // 2. Get usage from SQL function  
  logger.info('Fetching monthly usage', { userId });
  const { data: usageResult, error: usageError } = await supabase
    .rpc('get_monthly_usage', { user_uuid: userId });
  if (usageError) {
    const error = new Error('Failed to fetch usage');
    error.code = 'USAGE_FETCH_FAILED';
    error.userId = userId;
    logger.error('Failed to fetch usage data from database', error, {
      userId,
      database_error: usageError,
      business: { 
        operation: { operation_name: 'getUserPlan', user_id: userId, step: 'fetch_usage' }
      }
    });
    throw error;
  }
  const usage = usageResult;

  // 3. Get limits from SQL function
  logger.info('Fetching plan limits', { userId });
  const { data: limitsResult, error: limitsError } = await supabase
    .rpc('get_plan_limits', { user_uuid: userId });
  if (limitsError) {
    const error = new Error('Failed to fetch plan limits');
    error.code = 'LIMITS_FETCH_FAILED';
    error.userId = userId;
    logger.error('Failed to fetch plan limits from database', error, {
      userId,
      database_error: limitsError,
      business: { 
        operation: { operation_name: 'getUserPlan', user_id: userId, step: 'fetch_limits' }
      }
    });
    throw error;
  }
  const limits = limitsResult;

  return { plan, usage, limits };
}

/**
 * Fetch the user's plan, features, and limits from the database.
 * @param {string} userId
 * @returns {Promise<{plan: object, features: string[], limits: object}>}
 */
async function getUserPlanAndFeaturesFromDB(userId) {
  // 1. Get the user's plan (join user_profiles -> plans)
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select('plan_id, plan:plans(*)')
    .eq('id', userId)
    .maybeSingle();
  if (userError || !userProfile) throw new Error('User profile/plan not found');
  const plan = userProfile.plan;

  // 2. Get all features and limits for this plan
  const { data: planFeatures, error: featuresError } = await supabase
    .from('plan_features')
    .select('feature_key, value')
    .eq('plan_id', plan.id);
  if (featuresError) throw new Error('Plan features not found');

  // 3. Separate boolean features and quantitative limits
  const features = [];
  const limits = {};
  for (const f of planFeatures) {
    if (typeof f.value === 'boolean' || f.value === 'yes' || f.value === 'no') {
      if (f.value === true || f.value === 'yes') features.push(f.feature_key);
    } else if (!isNaN(Number(f.value))) {
      limits[f.feature_key] = Number(f.value);
    }
  }

  return { plan, features, limits };
}

module.exports = { getUserPlanAndFeaturesFromDB, getUserPlan };
