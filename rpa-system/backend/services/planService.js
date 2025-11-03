// rpa-system/backend/services/planService.js
// Service to fetch a user's plan, features, and limits from the database (Supabase)

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;

// Make Supabase optional for local development
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
} else {
  console.warn('⚠️ Supabase not configured - plan service disabled for local dev');
}

/**
 * Fetch the user's plan, usage, and limits from the database using SQL functions.
 * @param {string} userId
 * @returns {Promise<{plan: object, usage: object, limits: object}>}
 */
async function getUserPlan(userId) {
  if (!supabase) {
    console.log('📝 [LOCAL DEV] Would get plan for user:', userId);
    return {
      plan: { id: 'free', name: 'Free Plan', features: {} },
      usage: { automationsThisMonth: 0, storageUsed: 0 },
      limits: { maxAutomations: 10, maxStorage: 100 }
    };
  }

  // 1. Get the user's plan (join user_profiles -> plans)
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select('plan_id, plan:plans(*)')
    .eq('id', userId)
    .maybeSingle();
  if (userError || !userProfile) throw new Error('User profile/plan not found');
  const plan = userProfile.plan;

  // 2. Get usage from SQL function
  const { data: usageResult, error: usageError } = await supabase
    .rpc('get_monthly_usage', { user_uuid: userId });
  if (usageError) throw new Error('Failed to fetch usage');
  const usage = usageResult;

  // 3. Get limits from SQL function
  const { data: limitsResult, error: limitsError } = await supabase
    .rpc('get_plan_limits', { user_uuid: userId });
  if (limitsError) throw new Error('Failed to fetch plan limits');
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
