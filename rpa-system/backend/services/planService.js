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

// Module-level state for RPC warning/error logging
const planServiceState = {
 _rpcWarningLogged: false,
 _rpcErrorLogged: false
};

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
 // Check if supabase is properly initialized
 if (!supabase || typeof supabase.rpc !== 'function') {
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

 // ✅ FIX: Handle database schema issues gracefully
 // 1. Get the user's profile (query separately to avoid PostgREST FK requirement)
 let userProfile;
 let userError;

 try {
 const profileResult = await supabase
 .from('profiles')
 .select('plan_id')
 .eq('id', userId)
 .maybeSingle();

 userProfile = profileResult.data;
 userError = profileResult.error;
 } catch (err) {
 userError = err;
 userProfile = null;
 }

 // ✅ FIX: If profile doesn't exist, create one with default plan
 if (userError || !userProfile) {
 // Check if it's a schema/relationship error vs actual missing profile
 const isSchemaError = userError?.message?.includes('relationship') ||
 userError?.message?.includes('foreign key') ||
 userError?.code === 'PGRST200';

 if (isSchemaError) {
 // Schema issue - try to work around it by querying plan_id directly
 logger.warn('Database schema relationship issue detected, attempting workaround', {
 userId,
 error: userError?.message
 });

 // Try to get plan_id directly without join
 try {
 const directResult = await supabase
 .from('profiles')
 .select('plan_id')
 .eq('id', userId)
 .single();

 if (directResult.data) {
 userProfile = directResult.data;
 userError = null;
 }
 } catch (directErr) {
 // Still failed - fall through to default plan
 logger.warn('Direct query also failed, using default plan', {
 userId,
 error: directErr.message
 });
 }
 }

 // If still no profile, return default plan instead of throwing
 if (!userProfile) {
 if (shouldLogError(userId, 'USER_PROFILE_NOT_FOUND')) {
 logger.warn('User profile not found, returning default plan', {
 userId,
 database_error: userError,
 fallback_plan: 'free'
 });
 }

 // Return default plan instead of throwing
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
 }

 // 2. Get the plan details separately (avoids PostgREST FK relationship requirement)
 const planId = userProfile.plan_id || 'free';

 // ✅ FIX: Only query by id if planId is a valid UUID, otherwise query by name/slug
 const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
 const orQuery = isUuid
 ? `id.eq.${planId},name.eq.${planId},slug.eq.${planId}`
 : `name.eq.${planId},slug.eq.${planId}`;

 const { data: planData, error: planError } = await supabase
 .from('plans')
 .select('*')
 .or(orQuery)
 .maybeSingle();

 let plan;
 if (planError || !planData) {
 // If plan not found, use a default fallback
 logger.warn('Plan not found, using default', { userId, planId, database_error: planError });
 plan = {
 id: planId,
 name: 'Free Plan',
 features: {},
 limits: {}
 };
 // Continue with default plan instead of throwing error
 } else {
 plan = planData;
 }

 // 2. Get usage from SQL function (with fallback for dev)
 logger.info('Fetching monthly usage', { userId });
 let usage = { automationsThisMonth: 0, storageUsed: 0 };

 // ✅ FIX: Check supabase and rpc function exist before calling
 try {
 if (supabase && supabase.rpc && typeof supabase.rpc === 'function') {
 const { data: usageResult, error: usageError } = await supabase
 .rpc('get_monthly_usage', { user_uuid: userId });
 if (usageError) {
 logger.warn('Failed to fetch usage data, using defaults', { userId, database_error: usageError });
 // Use default usage instead of throwing
 } else if (usageResult) {
 usage = usageResult;
 }
 } else {
 logger.debug('Supabase RPC not available, using default usage', {
 userId,
 has_supabase: !!supabase,
 has_rpc: supabase && !!supabase.rpc
 });
 }
 } catch (rpcError) {
 logger.warn('RPC call failed, using default usage', {
 userId,
 error: rpcError.message,
 stack: rpcError.stack
 });
 // Use default usage instead of throwing
 }

 // 3. Get limits from SQL function (with fallback for dev)
 let limits = {
 workflow_executions: true,
 has_workflows: true,
 workflows: 100,
 maxAutomations: 10,
 maxStorage: 100
 };

 // ✅ FIX: Skip RPC call if function doesn't exist (development mode)
 const skipRpcInDev = process.env.NODE_ENV === 'development' && !process.env.ENABLE_PLAN_RPC;

 if (!skipRpcInDev) {
 try {
 if (supabase && supabase.rpc && typeof supabase.rpc === 'function') {
 const { data: limitsResult, error: limitsError} = await supabase
 .rpc('get_plan_limits', { user_uuid: userId });
 if (limitsError) {
 // ✅ FIX: Handle schema errors (like missing owner_id column) gracefully
 const isSchemaError = limitsError.code === '42703' || // undefined_column
 limitsError.message?.includes('owner_id') ||
 limitsError.message?.includes('does not exist');

 if (isSchemaError && shouldLogError(userId, 'SCHEMA_ERROR')) {
 logger.warn('Failed to fetch usage data, using defaults', {
 userId,
 database_error: {
 code: limitsError.code,
 message: limitsError.message,
 hint: limitsError.hint
 }
 });
 } else if (!isSchemaError && !planServiceState._rpcWarningLogged) {
 // Only log once per session to avoid spam for non-schema errors
 logger.warn('Plan limits RPC not available, using defaults. Set ENABLE_PLAN_RPC=true to enable.', {
 userId,
 error_code: limitsError.code
 });
 planServiceState._rpcWarningLogged = true;
 }
 } else if (limitsResult) {
 limits = limitsResult;
 }
 }
 } catch (rpcError) {
 // ✅ FIX: Handle schema errors gracefully
 const isSchemaError = rpcError.message?.includes('owner_id') ||
 rpcError.message?.includes('does not exist');

 if (isSchemaError && shouldLogError(userId, 'SCHEMA_ERROR')) {
 logger.warn('Failed to fetch usage data, using defaults', {
 userId,
 database_error: {
 code: rpcError.code,
 message: rpcError.message
 }
 });
 } else if (!isSchemaError && !planServiceState._rpcErrorLogged) {
 // Only log once per session
 logger.warn('RPC call failed, using default limits', {
 userId,
 error: rpcError.message
 });
 planServiceState._rpcErrorLogged = true;
 }
 }
 } else {
 logger.debug('Using default plan limits in development mode');
 }

 // ✅ BULLETPROOF: Merge feature_flags into limits for unified access
 // This ensures all features (including lead_generation) are accessible via limits
 const mergedLimits = {
 ...limits,
 ...(plan.feature_flags || {})
 };

 return { plan, usage, limits: mergedLimits };
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
