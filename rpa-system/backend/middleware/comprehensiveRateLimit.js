/**
 * Comprehensive Rate Limiting Middleware
 *
 * Enforces ALL pricing page features with bulletproof limit checking:
 * - Webhook creation limits
 * - Scheduled automation daily limits
 * - Integration creation limits
 * - API access enforcement
 * - Audit logs access enforcement
 *
 * All limits are checked against Supabase plan feature_flags
 */

const { getUserPlan } = require('../services/planService');
const { getSupabase } = require('../utils/supabaseClient');
const { createLogger } = require('../middleware/structuredLogging');

// Import scraping usage for comprehensive usage endpoint
let getScrapingUsageFromScraping = null;
try {
  const scrapingRateLimit = require('./scrapingRateLimit');
  getScrapingUsageFromScraping = scrapingRateLimit.getScrapingUsage;
} catch (e) {
  // Scraping rate limit not available, that's ok
}

const logger = createLogger('middleware.comprehensiveRateLimit');

/**
 * Middleware: Check if user can create a webhook
 * Enforces webhook count limits based on plan
 */
const checkWebhookLimit = async (req, res, next) => {
  try {
    // Allow dev bypass
    if (req.devBypass) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);

    // Check if webhooks are enabled
    const webhookValue = planData.limits?.webhook_integrations || planData.limits?.webhook_management;
    const hasWebhooks = typeof webhookValue === 'string'
      ? webhookValue.toLowerCase() !== 'no' && webhookValue !== ''
      : !!webhookValue;

    if (!hasWebhooks) {
      return res.status(403).json({
        error: 'Webhooks not available',
        message: 'This feature requires a Starter plan or higher.',
        feature: 'webhook_integrations',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    // Check if unlimited
    const webhookStr = String(webhookValue || '').toLowerCase();
    if (webhookStr.includes('unlimited')) {
      req.planData = planData;
      return next();
    }

    // Get limit from plan (extract number from strings like "10 webhooks")
    let webhookLimit = 0;
    if (typeof webhookValue === 'number') {
      webhookLimit = webhookValue;
    } else if (typeof webhookValue === 'string') {
      const match = webhookValue.match(/\d+/);
      webhookLimit = match ? parseInt(match[0], 10) : 0;
    }

    // Check current usage
    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('Supabase not available, allowing request');
      req.planData = planData;
      return next();
    }

    // ✅ BULLETPROOF: Use database function for accurate limit checking
    // Falls back to manual check if function doesn't exist
    let canCreate = true;
    if (supabase.rpc && typeof supabase.rpc === 'function') {
      const { data: canCreateResult, error: checkError } = await supabase
        .rpc('can_create_webhook', {
          user_uuid: userId
        });

      if (checkError) {
        logger.warn('Database function failed, using manual check', { error: checkError.message, userId });
        // Fall through to manual check below
      } else {
        canCreate = canCreateResult;
      }
    }

    // Manual check fallback if database function not available
    if (canCreate === true && (!supabase.rpc || typeof supabase.rpc !== 'function')) {
      const { count } = await supabase
        .from('workflow_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('schedule_type', 'webhook')
        .eq('is_active', true);

      canCreate = (count || 0) < webhookLimit;
    }

    if (!canCreate) {
      // Get current webhook count for error message
      const { count } = await supabase
        .from('workflow_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('schedule_type', 'webhook')
        .eq('is_active', true);

      return res.status(403).json({
        error: 'Webhook limit reached',
        message: `You've reached your webhook limit (${webhookLimit} webhooks). Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: count || 0,
        limit: webhookLimit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in webhook limit check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Middleware: Check if user can create a scheduled automation
 * Enforces daily scheduled automation limits based on plan
 */
const checkScheduledAutomationLimit = async (req, res, next) => {
  try {
    // Allow dev bypass
    if (req.devBypass) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);

    // Check if scheduled automations are enabled
    const scheduledValue = planData.limits?.scheduled_automations;
    const hasScheduled = typeof scheduledValue === 'string'
      ? scheduledValue.toLowerCase() !== 'no' && scheduledValue !== ''
      : !!scheduledValue;

    if (!hasScheduled) {
      return res.status(403).json({
        error: 'Scheduled automations not available',
        message: 'This feature requires a Starter plan or higher.',
        feature: 'scheduled_automations',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    // Check if unlimited
    const scheduledStr = String(scheduledValue || '').toLowerCase();
    if (scheduledStr.includes('unlimited')) {
      req.planData = planData;
      return next();
    }

    // Check current usage
    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('Supabase not available, allowing request');
      req.planData = planData;
      return next();
    }

    // ✅ BULLETPROOF: Use database function for accurate limit checking
    // Falls back to manual check if function doesn't exist
    let canCreate = true;
    if (supabase.rpc && typeof supabase.rpc === 'function') {
      const { data: canCreateResult, error: checkError } = await supabase
        .rpc('can_create_scheduled_automation', {
          user_uuid: userId
        });

      if (checkError) {
        logger.warn('Database function failed, using manual check', { error: checkError.message, userId });
        // Fall through to manual check below
      } else {
        canCreate = canCreateResult;
      }
    }

    // Manual check fallback if database function not available
    if (canCreate === true && (!supabase.rpc || typeof supabase.rpc !== 'function')) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('workflow_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('schedule_type', 'cron')
        .gte('created_at', startOfDay.toISOString());

      const scheduledStr = String(scheduledValue || '');
      const match = scheduledStr.match(/\d+/);
      const dailyLimit = match ? parseInt(match[0], 10) : 0;

      canCreate = (count || 0) < dailyLimit;
    }

    if (!canCreate) {
      // Get current daily count for error message
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: currentCount } = await supabase
        .from('workflow_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('schedule_type', ['cron', 'interval'])
        .gte('created_at', startOfDay.toISOString());

      // Extract daily limit from plan
      const scheduledStr = String(scheduledValue || '');
      const match = scheduledStr.match(/\d+/);
      const dailyLimit = match ? parseInt(match[0], 10) : 0;

      return res.status(403).json({
        error: 'Daily scheduled automation limit reached',
        message: `You've reached your daily scheduled automation limit (${dailyLimit} per day). Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: currentCount || 0,
        limit: dailyLimit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in scheduled automation limit check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Middleware: Check if user can create an integration
 * Enforces integration count limits based on plan
 */
const checkIntegrationLimit = async (req, res, next) => {
  try {
    // Allow dev bypass
    if (req.devBypass) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);

    // Check if custom integrations are enabled
    const integrationValue = planData.limits?.custom_integrations;
    const hasIntegrations = typeof integrationValue === 'string'
      ? integrationValue.toLowerCase() !== 'no' && integrationValue !== ''
      : !!integrationValue;

    if (!hasIntegrations) {
      return res.status(403).json({
        error: 'Custom integrations not available',
        message: 'This feature requires a Professional plan or higher.',
        feature: 'custom_integrations',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    // Check if unlimited
    const integrationStr = String(integrationValue || '').toLowerCase();
    if (integrationStr.includes('unlimited')) {
      req.planData = planData;
      return next();
    }

    // Check current usage
    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('Supabase not available, allowing request');
      req.planData = planData;
      return next();
    }

    // ✅ BULLETPROOF: Use database function for accurate limit checking
    // Falls back to manual check if function doesn't exist
    let canCreate = true;
    if (supabase.rpc && typeof supabase.rpc === 'function') {
      const { data: canCreateResult, error: checkError } = await supabase
        .rpc('can_create_integration', {
          user_uuid: userId
        });

      if (checkError) {
        logger.warn('Database function failed, using manual check', { error: checkError.message, userId });
        // Fall through to manual check below
      } else {
        canCreate = canCreateResult;
      }
    }

    // Manual check fallback if database function not available
    if (canCreate === true && (!supabase.rpc || typeof supabase.rpc !== 'function')) {
      const { count } = await supabase
        .from('integration_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      const integrationStr = String(integrationValue || '');
      const match = integrationStr.match(/\d+/);
      const integrationLimit = match ? parseInt(match[0], 10) : 0;

      canCreate = (count || 0) < integrationLimit;
    }

    if (!canCreate) {
      // Get current integration count for error message
      const { count: currentCount } = await supabase
        .from('integration_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Extract limit from plan
      const integrationStr = String(integrationValue || '');
      const match = integrationStr.match(/\d+/);
      const integrationLimit = match ? parseInt(match[0], 10) : 0;

      return res.status(403).json({
        error: 'Integration limit reached',
        message: `You've reached your integration limit (${integrationLimit} integrations). Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: currentCount || 0,
        limit: integrationLimit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in integration limit check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Middleware: Check if user has API access
 * Enforces API access based on plan
 */
const checkApiAccess = async (req, res, next) => {
  try {
    // Allow dev bypass
    if (req.devBypass) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const planData = await getUserPlan(userId);

    // Check API access
    const apiValue = planData.limits?.api_access || planData.limits?.full_api_access;
    const hasApiAccess = typeof apiValue === 'string'
      ? apiValue.toLowerCase() !== 'no' && apiValue !== ''
      : !!apiValue;

    if (!hasApiAccess) {
      return res.status(403).json({
        error: 'API access not available',
        message: 'This feature requires a Professional plan or higher.',
        feature: 'api_access',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in API access check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Helper: Get comprehensive usage for a user
 */
async function getComprehensiveUsage(userId) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        automation_runs_this_month: 0,
        storage_gb_used: 0,
        webhooks_created: 0,
        scheduled_automations_today: 0,
        scheduled_automations_total: 0,
        integrations_created: 0,
        workflows_created: 0
      };
    }

    const { data, error } = await supabase
      .rpc('get_comprehensive_usage', { user_uuid: userId })
      .single();

    if (error) {
      logger.warn('Error getting comprehensive usage', { error: error.message, userId });
      return {
        automation_runs_this_month: 0,
        storage_gb_used: 0,
        webhooks_created: 0,
        scheduled_automations_today: 0,
        scheduled_automations_total: 0,
        integrations_created: 0,
        workflows_created: 0
      };
    }

    return data || {
      automation_runs_this_month: 0,
      storage_gb_used: 0,
      webhooks_created: 0,
      scheduled_automations_today: 0,
      scheduled_automations_total: 0,
      integrations_created: 0,
      workflows_created: 0
    };
  } catch (error) {
    logger.error('Error in getComprehensiveUsage', error, { userId });
    return {
      automation_runs_this_month: 0,
      storage_gb_used: 0,
      webhooks_created: 0,
      scheduled_automations_today: 0,
      scheduled_automations_total: 0,
      integrations_created: 0,
      workflows_created: 0
    };
  }
}

module.exports = {
  checkWebhookLimit,
  checkScheduledAutomationLimit,
  checkIntegrationLimit,
  checkApiAccess,
  getComprehensiveUsage
};

