
const { logger, getLogger } = require('../utils/logger');
// Dynamic, database-driven plan enforcement middleware
const { getUserPlan } = require('../services/planService');
const { getPlanHierarchy } = require('../utils/planHierarchy');

// Throttle repeated error logs to prevent flooding
const errorThrottleCache = new Map(); // errorKey -> { count, lastLogged, firstSeen }
const ERROR_THROTTLE_WINDOW_MS = 60000; // 1 minute
const MAX_ERRORS_PER_WINDOW = 1; // Only log once per window

function shouldLogError(errorKey) {
  const now = Date.now();
  const cached = errorThrottleCache.get(errorKey);
  
  if (!cached) {
    errorThrottleCache.set(errorKey, {
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

/**
 * Usage: requireFeature('feature_key')
 * Checks if the user has access to the given feature or limit, using live DB data.
 */

// Middleware: Check if user can run workflows (unlimited for everyone)
const requireWorkflowRun = async (req, res, next) => {
  try {
    // Allow workflows to run without limits for everyone
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get plan data but don't enforce limits for workflows
    const planData = await getUserPlan(userId);
    req.planData = planData;
    next();
  } catch (error) {
    // Throttle repeated errors
    const errorKey = error.code === 'USER_PROFILE_NOT_FOUND'
      ? `plan_enforcement:profile_not_found:${req.user?.id || 'unknown'}`
      : `plan_enforcement:${error.code || error.message}`;
    
    if (shouldLogError(errorKey)) {
      logger.error('Plan enforcement error:', error);
      // Don't block workflow execution even if there's an error getting plan data
      logger.warn('Continuing workflow execution despite plan check error');
    }
    next();
  }
};

// Middleware: Check if user can run automation (with limits)
// ✅ BULLETPROOF: Uses database function for accurate limit checking
const requireAutomationRun = async (req, res, next) => {
  try {
    // ✅ FIX: Check development mode FIRST to avoid unnecessary DB calls
    // Check multiple ways NODE_ENV might be set
    const nodeEnv = (process.env.NODE_ENV || process.env.node_env || 'development').toLowerCase();
    const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev';
    
    // Allow explicit dev bypass token to short-circuit plan checks
    if (req.devBypass || isDevelopment) {
      logger.info('[PlanEnforcement] Development mode detected, skipping automation limits', {
        devBypass: !!req.devBypass,
        nodeEnv: process.env.NODE_ENV || process.env.node_env || 'development'
      });
      return next(); // Skip plan enforcement entirely in development
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ✅ BULLETPROOF: Use database function for accurate limit checking
    const { getSupabase } = require('../utils/supabaseClient');
    const supabase = getSupabase();
    
    if (supabase && supabase.rpc) {
      const { data: canRun, error: checkError } = await supabase
        .rpc('can_run_automation', { user_uuid: userId });

      if (!checkError && !canRun) {
        // Get usage for error message
        const { data: usageData } = await supabase
          .rpc('get_automation_run_usage', { user_uuid: userId })
          .single();

        const planData = await getUserPlan(userId);
        const usage = usageData?.runs_this_month || 0;
        const limit = usageData?.limit_per_month || 0;
        const planName = planData?.plan?.name || 'Unknown';

        return res.status(403).json({
          error: 'Monthly automation limit reached',
          message: `You've used ${usage}/${limit} automation runs this month. Upgrade for higher limits.`,
          current_plan: planName,
          usage: usage,
          limit: limit,
          upgrade_required: true,
          upgrade_url: '/pricing'
        });
      }

      // If database function fails, fall back to planData check
      if (checkError) {
        logger.warn('Database function failed, falling back to planData check', { error: checkError.message });
      }
    }

    // Fallback: Use planData check if database function not available
    const planData = await getUserPlan(userId);
    
    // If plan data is missing or invalid, block in production
    if (!planData || !planData.can_run_automation) {
      // ✅ FIX: Properly handle undefined values in error message
      const usage = planData?.usage?.monthly_runs ?? 0;
      const limit = planData?.limits?.automation_runs ?? planData?.limits?.monthly_runs ?? 0;
      const planName = planData?.plan?.name || 'Unknown';
      
      return res.status(403).json({
        error: 'Monthly automation limit reached',
        message: `You've used ${usage}/${limit} automation runs this month. Upgrade for higher limits.`,
        current_plan: planName,
        usage: usage,
        limit: limit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    // In development mode, allow even if there's an error getting plan data
    const nodeEnv = (process.env.NODE_ENV || process.env.node_env || 'development').toLowerCase();
    const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev';
    
    if (isDevelopment) {
      logger.warn('[PlanEnforcement] Error checking plan but allowing in development mode:', error.message);
      return next();
    }
    
    logger.error('Plan enforcement error:', error);
    res.status(500).json({ error: 'Failed to check automation limits' });
  }
};

// Middleware: Check if user has specific feature access
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      // ✅ FIX: Check development mode FIRST to avoid unnecessary DB calls
      // Check multiple ways NODE_ENV might be set
      const nodeEnv = (process.env.NODE_ENV || process.env.node_env || 'development').toLowerCase();
      const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev';
      
      // Allow explicit dev bypass token OR development mode to short-circuit feature checks
      if (req.devBypass || isDevelopment) {
        logger.info('[PlanEnforcement] Development mode detected, skipping feature check', {
          feature: featureKey,
          devBypass: !!req.devBypass,
          nodeEnv: process.env.NODE_ENV || process.env.node_env || 'development'
        });
        return next(); // Skip feature enforcement entirely in development
      }
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planData = await getUserPlan(userId);
      
      // Check feature access - handle both boolean and string values from feature_flags
      const featureValue = planData.limits?.[featureKey];
      let hasFeature = false;
      
      if (typeof featureValue === 'boolean') {
        hasFeature = featureValue === true;
      } else if (typeof featureValue === 'string') {
        // Handle string values: "Yes", "Unlimited", "Basic (10 rules)" = true; "No" = false
        const normalized = featureValue.toLowerCase().trim();
        hasFeature = normalized !== 'no' && normalized !== 'false' && normalized !== '';
      } else if (typeof featureValue === 'number') {
        // Numeric values > 0 mean feature is available
        hasFeature = featureValue > 0;
      } else if (featureValue !== null && featureValue !== undefined) {
        // Any other truthy value means feature is available
        hasFeature = !!featureValue;
      }
      
      if (!hasFeature) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `This feature requires a premium plan. You're currently on the ${planData.plan.name} plan.`,
          feature: featureKey,
          current_plan: planData.plan.name,
          upgrade_required: true
        });
      }

      req.planData = planData;
      next();
    } catch (error) {
      // Skip logging if it's a USER_PROFILE_NOT_FOUND error (already logged in planService with throttling)
      const errorKey = error.code === 'USER_PROFILE_NOT_FOUND' 
        ? `profile_not_found:${req.user?.id || 'unknown'}`
        : `feature_error:${error.code || error.message}`;
      
      if (shouldLogError(errorKey)) {
        logger.error('Feature access error:', error);
      }
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
};

// Middleware: Check if user has required plan level
const requirePlan = (minPlan) => {
  return async (req, res, next) => {
    try {
      // ✅ FIX: Check development mode FIRST to avoid unnecessary DB calls
      // Check multiple ways NODE_ENV might be set
      const nodeEnv = (process.env.NODE_ENV || process.env.node_env || 'development').toLowerCase();
      const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev';
      
      // Allow explicit dev bypass token OR development mode to short-circuit plan checks
      if (req.devBypass || isDevelopment) {
        logger.info('[PlanEnforcement] Development mode detected, skipping plan check', {
          requiredPlan: minPlan,
          devBypass: !!req.devBypass,
          nodeEnv: process.env.NODE_ENV || process.env.node_env || 'development'
        });
        return next(); // Skip plan enforcement entirely in development
      }
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planData = await getUserPlan(userId);
      
      // Get dynamic plan hierarchy from database
      const planHierarchy = await getPlanHierarchy();
      const currentPlanLevel = planHierarchy[planData.plan.name?.toLowerCase()] ?? 0;
      const requiredPlanLevel = planHierarchy[minPlan.toLowerCase()] ?? 0;
      
      if (currentPlanLevel < requiredPlanLevel) {
        return res.status(403).json({
          error: 'Plan upgrade required',
          message: `This feature requires the ${minPlan} plan or higher. You're currently on the ${planData.plan.name} plan.`,
          current_plan: planData.plan.name,
          required_plan: minPlan,
          upgrade_required: true
        });
      }

      req.planData = planData;
      next();
    } catch (error) {
      logger.error('Plan level check error:', error);
      res.status(500).json({ error: 'Failed to check plan level' });
    }
  };
};

// Middleware: Check storage limits for file uploads
// ✅ BULLETPROOF: Uses database function for accurate limit checking
const checkStorageLimit = async (req, res, next) => {
  try {
    // Allow dev bypass
    if (req.devBypass) {
      return next();
    }

    const userId = req.user?.id;
    const fileSize = req.body?.file_size || req.file?.size || 0;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const fileSizeGB = fileSize / (1024 * 1024 * 1024);

    // ✅ BULLETPROOF: Use database function for accurate limit checking
    const { getSupabase } = require('../utils/supabaseClient');
    const supabase = getSupabase();
    
    if (supabase && supabase.rpc) {
      const { data: canUse, error: checkError } = await supabase
        .rpc('can_use_storage', { 
          user_uuid: userId,
          additional_gb: fileSizeGB
        });

      if (!checkError && !canUse) {
        // Get usage for error message
        const { data: usageData } = await supabase
          .rpc('get_storage_usage', { user_uuid: userId })
          .single();

        const planData = await getUserPlan(userId);
        const currentUsage = usageData?.storage_gb_used || 0;
        const storageLimit = usageData?.limit_gb || planData?.limits?.storage_gb || 0;
        const planName = planData?.plan?.name || 'Unknown';

        return res.status(403).json({
          error: 'Storage limit exceeded',
          message: `Adding this file would exceed your storage limit. Current usage: ${currentUsage.toFixed(2)}GB, Limit: ${storageLimit}GB`,
          current_plan: planName,
          current_usage_gb: currentUsage,
          limit_gb: storageLimit,
          file_size_gb: fileSizeGB,
          upgrade_required: true,
          upgrade_url: '/pricing'
        });
      }

      // If database function fails, fall back to planData check
      if (checkError) {
        logger.warn('Database function failed, falling back to planData check', { error: checkError.message });
      }
    }

    // Fallback: Use planData check if database function not available
    const planData = await getUserPlan(userId);
    const storageLimit = planData.limits?.storage_gb || 0;
    const currentUsage = planData.usage?.storage_gb || 0;
    
    // Check if unlimited storage
    if (storageLimit === -1) {
      req.planData = planData;
      return next();
    }
    
    // Check if adding this file would exceed limit
    if ((currentUsage + fileSizeGB) > storageLimit) {
      return res.status(403).json({
        error: 'Storage limit exceeded',
        message: `Adding this file would exceed your storage limit. Current usage: ${currentUsage.toFixed(2)}GB, Limit: ${storageLimit}GB`,
        current_plan: planData.plan?.name || 'Unknown',
        current_usage_gb: currentUsage,
        limit_gb: storageLimit,
        file_size_gb: fileSizeGB,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Storage limit check error:', error);
    // Fail open for availability
    req.planData = null;
    next();
  }
};

// Helper function to get plan data for route handlers
const getPlanData = (req) => {
  return req.planData || null;
};

// Utility function to format error responses
const createPlanErrorResponse = (type, planData, details = {}) => {
  const baseResponse = {
    current_plan: planData?.plan?.name || 'Unknown',
    upgrade_required: true,
    upgrade_url: '/pricing'
  };

  switch (type) {
    case 'workflow_limit':
      return {
        error: 'Workflow limit reached',
        message: `You've reached the ${planData.limits.workflows} workflow limit for your ${planData.plan.name} plan.`,
        limit: planData.limits.workflows,
        ...baseResponse,
        ...details
      };

    case 'automation_limit':
      return {
        error: 'Automation limit reached',
        message: `You've used ${planData.usage.monthly_runs}/${planData.limits.monthly_runs} automation runs this month.`,
        usage: planData.usage.monthly_runs,
        limit: planData.limits.monthly_runs,
        ...baseResponse,
        ...details
      };

    case 'storage_limit':
      return {
        error: 'Storage limit exceeded',
        message: `You've used ${planData.usage.storage_gb.toFixed(2)}/${planData.limits.storage_gb}GB of storage.`,
        usage_gb: planData.usage.storage_gb,
        limit_gb: planData.limits.storage_gb,
        ...baseResponse,
        ...details
      };

    case 'feature_access':
      return {
        error: 'Feature not available',
        message: `This feature is not available on your ${planData.plan.name} plan.`,
        feature: details.feature,
        ...baseResponse,
        ...details
      };

    default:
      return {
        error: 'Plan restriction',
        message: 'This action is not available on your current plan.',
        ...baseResponse,
        ...details
      };
  }
};

// Check if user can create workflows
const requireWorkflowCreation = async (req, res, next) => {
  try {
    const planData = await getUserPlan(req.user.id);
    
    if (!planData) {
      return res.status(403).json({ 
        error: 'Plan data not available',
        code: 'PLAN_DATA_UNAVAILABLE' 
      });
    }

    // Check if workflows are enabled for this plan
    if (!planData.limits?.has_workflows) {
      return res.status(402).json({
        error: 'Workflow creation requires a plan upgrade',
        code: 'WORKFLOW_CREATION_DISABLED',
        requiredPlan: 'Starter',
        feature: 'workflow_creation',
        currentPlan: planData.plan?.name || 'Unknown'
      });
    }

    // Check workflow limit
    const currentWorkflows = planData.usage?.workflows || 0;
    const workflowLimit = planData.limits?.workflows || 0;
    
    if (workflowLimit > 0 && currentWorkflows >= workflowLimit) {
      return res.status(402).json({
        error: 'Workflow creation limit reached',
        code: 'WORKFLOW_LIMIT_REACHED',
        currentUsage: currentWorkflows,
        limit: workflowLimit,
        requiredPlan: 'Professional',
        feature: 'workflow_creation'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in requireWorkflowCreation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' 
    });
  }
};

module.exports = {
  getUserPlan,
  requireWorkflowCreation,
  requireWorkflowRun,
  requireAutomationRun,
  requireFeature,
  requirePlan,
  checkStorageLimit,
  getPlanData,
  createPlanErrorResponse
};