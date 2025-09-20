// Dynamic, database-driven plan enforcement middleware
const { getUserPlan } = require('../services/planService');

/**
 * Usage: requireFeature('feature_key')
 * Checks if the user has access to the given feature or limit, using live DB data.
 */

// Middleware: Check if user can run automation
const requireAutomationRun = async (req, res, next) => {
  try {
    // Allow explicit dev bypass token to short-circuit plan checks
    if (req.devBypass) {
      return next(); // Dev bypass: skip plan enforcement, but do not inject static planData
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);
    
    if (!planData.can_run_automation) {
      return res.status(403).json({
        error: 'Monthly automation limit reached',
        message: `You've used ${planData.usage.monthly_runs}/${planData.limits.monthly_runs} automation runs this month. Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: planData.usage.monthly_runs,
        limit: planData.limits.monthly_runs,
        upgrade_required: true
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    console.error('Plan enforcement error:', error);
    res.status(500).json({ error: 'Failed to check automation limits' });
  }
};

// Middleware: Check if user has specific feature access
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      // allow dev bypass to skip feature checks
      if (req.devBypass) {
        return next(); // Dev bypass: skip feature enforcement, but do not inject static planData
      }
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planData = await getUserPlan(userId);
      const hasFeature = planData.limits?.[featureKey] === true;
      
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
      console.error('Feature access error:', error);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
};

// Middleware: Check if user has required plan level
const requirePlan = (minPlan) => {
  const planHierarchy = {
    'hobbyist': 0,
    'free': 0,
    'starter': 1,
    'professional': 2,
    'enterprise': 3
  };

  return async (req, res, next) => {
    try {
      // allow dev bypass to skip plan checks
      if (req.devBypass) {
        return next(); // Dev bypass: skip plan enforcement, but do not inject static planData
      }
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const planData = await getUserPlan(userId);
      const currentPlanLevel = planHierarchy[planData.plan.name?.toLowerCase()] || 0;
      const requiredPlanLevel = planHierarchy[minPlan.toLowerCase()] || 0;
      
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
      console.error('Plan level check error:', error);
      res.status(500).json({ error: 'Failed to check plan level' });
    }
  };
};

// Middleware: Check storage limits for file uploads
const checkStorageLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const fileSize = req.body?.file_size || req.file?.size || 0;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);
    const storageLimit = planData.limits.storage_gb;
    const currentUsage = planData.usage.storage_gb;
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    
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
        current_usage_gb: currentUsage,
        limit_gb: storageLimit,
        file_size_gb: fileSizeGB,
        upgrade_required: true
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    console.error('Storage limit check error:', error);
    res.status(500).json({ error: 'Failed to check storage limits' });
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

module.exports = {
  getUserPlan,
  requireWorkflowCreation,
  requireAutomationRun,
  requireFeature,
  requirePlan,
  checkStorageLimit,
  getPlanData,
  createPlanErrorResponse
};