// services/userPlanResolver.js
/**
 * User Plan Resolution Service
 * 
 * This module provides robust plan resolution with explicit fallback handling.
 * 
 * Design principles:
 * - Single source of truth for default plan definitions
 * - Explicit error handling with structured logging
 * - Type validation for all plan fields
 * - Cache-aware responses (ETag support)
 * - Rate-limited warnings for missing plans
 */

const { createInstrumentedSupabaseClient } = require('../middleware/databaseInstrumentation');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('service.userPlanResolver');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabase = createInstrumentedSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

// ============================================================================
// CONSTANTS: Default Plan Definitions (Single Source of Truth)
// ============================================================================

/**
 * Default Hobbyist plan structure.
 * This is the fallback when a user's stored plan_id cannot be resolved.
 */
const DEFAULT_HOBBYIST_PLAN = {
  id: 'hobbyist-default',
  name: 'Hobbyist',
  slug: 'hobbyist',
  description: 'Default plan for individual users',
  limits: {
    workflows: -1, // Unlimited
    storage_gb: 5,
    monthly_runs: 50,
    team_members: 1
  },
  feature_flags: {
    api_access: 'No',
    storage_gb: 5,
    automation_runs: 50,
    priority_support: 'No',
    advanced_analytics: 'No',
    automation_workflows: 'Unlimited',
    webhook_integrations: 'No',
    scheduled_automations: 'No'
  }
};

// Track users who have triggered fallback warnings (to avoid log spam)
const warnedUsers = new Map(); // userId -> timestamp
const WARN_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate and normalize plan object structure.
 * Ensures all required fields exist with correct types.
 */
function validatePlanStructure(plan) {
  if (!plan || typeof plan !== 'object') {
    return false;
  }
  
  // Required fields
  if (!plan.id || !plan.name) {
    return false;
  }
  
  // Ensure limits object exists
  if (!plan.limits || typeof plan.limits !== 'object') {
    plan.limits = { ...DEFAULT_HOBBYIST_PLAN.limits };
  }
  
  // Ensure feature_flags object exists
  if (!plan.feature_flags || typeof plan.feature_flags !== 'object') {
    plan.feature_flags = { ...DEFAULT_HOBBYIST_PLAN.feature_flags };
  }
  
  return true;
}

/**
 * Check if we should log a warning for this user (rate-limited).
 */
function shouldWarnForUser(userId) {
  const lastWarned = warnedUsers.get(userId);
  const now = Date.now();
  
  if (!lastWarned || (now - lastWarned) > WARN_THROTTLE_MS) {
    warnedUsers.set(userId, now);
    return true;
  }
  
  return false;
}

/**
 * Calculate current usage statistics for a user.
 */
async function calculateUsage(userId) {
  if (!supabase) {
    return {
      monthly_runs: 0,
      automation_runs: 0,
      automations: 0,
      storage_gb: 0,
      workflows: 0,
      team_members: 1
    };
  }
  
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  const [monthlyRunsResult, storageResult, workflowsResult] = await Promise.all([
    supabase
      .from('automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', startOfMonth),
    // ✅ OPTIMIZATION: Use RPC function for storage calculation if available, otherwise fallback to aggregation
    // This avoids fetching all file_size rows and summing in JavaScript
    (async () => {
      try {
        // Try to use a database function for better performance
        const { data, error } = await supabase.rpc('get_user_storage_total', { user_id: userId });
        if (!error && data !== null) {
          return { data: [{ file_size: data }], error: null };
        }
      } catch (rpcError) {
        // RPC function doesn't exist, fall back to aggregation
      }
      
      // Fallback: Use aggregation query (more efficient than fetching all rows)
      // Note: Supabase PostgREST doesn't support SUM() directly in select, so we fetch and sum
      // For better performance with many files, consider creating an RPC function:
      // CREATE FUNCTION get_user_storage_total(user_id UUID) RETURNS BIGINT AS $$
      //   SELECT COALESCE(SUM(file_size), 0) FROM user_files WHERE user_id = $1;
      // $$ LANGUAGE SQL;
      return await supabase
        .from('user_files')
        .select('file_size')
        .eq('user_id', userId);
    })(),
    supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
  ]);
  
  const monthlyRuns = monthlyRunsResult.count || 0;
  // ✅ OPTIMIZATION: Sum file sizes efficiently
  const storageBytes = storageResult.data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
  const storageGB = storageBytes / (1024 * 1024 * 1024);
  const workflows = workflowsResult.count || 0;
  
  return {
    monthly_runs: monthlyRuns,
    automation_runs: monthlyRuns,
    automations: monthlyRuns,
    storage_gb: Math.round(storageGB * 1000) / 1000,
    workflows: workflows,
    team_members: 1
  };
}

// ============================================================================
// MAIN RESOLUTION FUNCTION
// ============================================================================

/**
 * Resolve user's plan with explicit fallback handling.
 * 
 * Resolution strategy:
 * 1. Fetch user profile and stored plan_id
 * 2. If no profile exists, create one with 'free' plan_id
 * 3. Attempt to resolve stored plan_id from plans table
 * 4. If plan not found:
 *    - Log structured warning (rate-limited)
 *    - Optionally normalize profile to default plan_id
 *    - Return fallback Hobbyist plan
 * 5. Calculate current usage
 * 6. Return complete plan data with metadata
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Resolution options
 * @param {boolean} options.normalizeMissingPlan - If true, update profile to default plan when stored plan not found
 * @returns {Promise<Object>} - Complete plan data with metadata
 */
async function resolveUserPlan(userId, options = {}) {
  const { normalizeMissingPlan = false } = options;
  
  if (!supabase) {
    throw new Error('Database not configured');
  }
  
  logger.info('Resolving user plan', { userId });
  
  // -------------------------------------------------------------------------
  // STEP 1: Fetch or create user profile
  // -------------------------------------------------------------------------
  
  const profileQuery = await supabase
    .from('profiles')
    .select('id, plan_id, is_trial, trial_ends_at, plan_expires_at')
    .eq('id', userId)
    .limit(1);
  
  let profile = profileQuery.data?.[0] || null;
  let profileError = profileQuery.error;
  
  if (!profile) {
    logger.info('No profile found, creating default profile', { userId });
    
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{
        id: userId,
        plan_id: 'free',
        created_at: new Date().toISOString()
      }]);
    
    if (insertError) {
      const error = new Error('Failed to create user profile');
      error.code = 'PROFILE_CREATE_FAILED';
      error.userId = userId;
      error.details = insertError;
      logger.error('Failed to create user profile', error, { userId, database_error: insertError });
      throw error;
    }
    
    // Fetch newly created profile
    const refetchQuery = await supabase
      .from('profiles')
      .select('id, plan_id, is_trial, trial_ends_at, plan_expires_at')
      .eq('id', userId)
      .limit(1);
    
    profile = refetchQuery.data?.[0] || null;
    profileError = refetchQuery.error;
  }
  
  if (profileError) {
    const error = new Error('Failed to fetch user profile');
    error.code = 'PROFILE_FETCH_FAILED';
    error.userId = userId;
    error.details = profileError;
    logger.error('Profile fetch error', error, { userId, database_error: profileError });
    throw error;
  }
  
  const storedPlanId = profile?.plan_id || 'Hobbyist';
  
  // -------------------------------------------------------------------------
  // STEP 2: Attempt to resolve stored plan from plans table
  // -------------------------------------------------------------------------
  
  const planQuery = await supabase
    .from('plans')
    .select('*')
    .or(`name.eq.${storedPlanId},slug.eq.${storedPlanId},id.eq.${storedPlanId}`)
    .limit(1);
  
  let plan = planQuery.data?.[0] || null;
  let planError = planQuery.error;
  
  let usedFallback = false;
  let fallbackReason = null;
  
  if (planError || !plan) {
    // Plan not found - use fallback
    usedFallback = true;
    fallbackReason = planError ? 'PLAN_QUERY_ERROR' : 'PLAN_NOT_FOUND';
    
    // Log warning (rate-limited per user)
    if (shouldWarnForUser(userId)) {
      logger.warn('Plan not found for user, using fallback plan', {
        userId,
        storedPlanId,
        fallbackPlan: DEFAULT_HOBBYIST_PLAN.name,
        reason: fallbackReason,
        database_error: planError || null,
        business: {
          operation: {
            operation_name: 'resolveUserPlan',
            user_id: userId,
            stored_plan_id: storedPlanId,
            fallback_used: true
          }
        }
      });
    }
    
    // Use default Hobbyist plan
    plan = { ...DEFAULT_HOBBYIST_PLAN };
    
    // -----------------------------------------------------------------------
    // OPTIONAL: Normalize profile to default plan_id
    // -----------------------------------------------------------------------
    
    if (normalizeMissingPlan && storedPlanId !== DEFAULT_HOBBYIST_PLAN.slug) {
      logger.info('Normalizing user profile to default plan', { 
        userId, 
        oldPlanId: storedPlanId,
        newPlanId: DEFAULT_HOBBYIST_PLAN.slug
      });
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ plan_id: DEFAULT_HOBBYIST_PLAN.slug })
        .eq('id', userId);
      
      if (updateError) {
        logger.error('Failed to normalize plan_id', { userId, database_error: updateError });
        // Non-fatal - continue with fallback plan
      }
    }
  } else {
    logger.info('Plan resolved successfully', { 
      userId, 
      planId: plan.id,
      planName: plan.name 
    });
  }
  
  // Validate plan structure
  if (!validatePlanStructure(plan)) {
    logger.error('Invalid plan structure, using fallback', { userId, planId: plan?.id });
    plan = { ...DEFAULT_HOBBYIST_PLAN };
    usedFallback = true;
    fallbackReason = 'INVALID_PLAN_STRUCTURE';
  }
  
  // -------------------------------------------------------------------------
  // STEP 3: Calculate current usage
  // -------------------------------------------------------------------------
  
  const usage = await calculateUsage(userId);
  
  logger.info('Usage calculated', { 
    userId, 
    workflows: usage.workflows,
    monthlyRuns: usage.monthly_runs,
    storageGB: usage.storage_gb
  });
  
  // -------------------------------------------------------------------------
  // STEP 4: Build response with metadata
  // -------------------------------------------------------------------------
  
  const planData = {
    plan: {
      id: plan.id,
      name: plan.name,
      status: 'active',
      is_trial: profile?.is_trial || false,
      expires_at: profile?.trial_ends_at || profile?.plan_expires_at || null
    },
    usage,
    limits: plan.limits,
    features: plan.feature_flags,
    can_run_automation: usage.monthly_runs < (plan.limits?.monthly_runs || 50),
    can_create_workflow: (plan.limits?.workflows || 0) !== 0
  };
  
  // Include metadata about fallback usage
  const metadata = {
    resolved_at: new Date().toISOString(),
    used_fallback: usedFallback,
    fallback_reason: fallbackReason,
    stored_plan_id: storedPlanId
  };
  
  return {
    planData,
    metadata
  };
}

/**
 * Generate ETag for plan data.
 * Used for HTTP caching (304 Not Modified responses).
 * 
 * ETag is based on:
 * - Plan ID
 * - Usage numbers (so cache invalidates when usage changes)
 * - Trial/expiration dates
 */
function generatePlanETag(planData) {
  const {plan, usage} = planData;
  const etagData = [
    plan.id,
    plan.name,
    plan.is_trial,
    plan.expires_at || 'null',
    usage.workflows,
    usage.monthly_runs,
    usage.storage_gb
  ].join('|');
  
  // Simple hash (in production, consider crypto.createHash)
  let hash = 0;
  for (let i = 0; i < etagData.length; i++) {
    const char = etagData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `W/"${Math.abs(hash).toString(16)}"`;
}

module.exports = {
  resolveUserPlan,
  generatePlanETag,
  DEFAULT_HOBBYIST_PLAN
};
