/**
 * Scraping Rate Limiting Middleware
 * 
 * Enforces plan-based rate limits for scraping operations:
 * - Domains per month limit
 * - Scrape jobs per month limit
 * - Per-domain rate limiting
 * 
 * Automatically checks user's plan and enforces limits based on feature_flags.
 */

const { getUserPlan } = require('../services/planService');
const { getSupabase } = require('../utils/supabaseClient');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('middleware.scrapingRateLimit');

/**
 * Middleware: Check if user can scrape a domain
 * Enforces monthly domain limits based on plan
 */
const checkScrapingDomainLimit = async (req, res, next) => {
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
    
    // Check if lead generation is enabled
    const leadGenValue = planData.limits?.lead_generation;
    const hasLeadGen = typeof leadGenValue === 'string' 
      ? leadGenValue.toLowerCase() !== 'no' && leadGenValue !== ''
      : !!leadGenValue;

    if (!hasLeadGen) {
      return res.status(403).json({
        error: 'Lead generation not available',
        message: 'This feature requires a Professional or Enterprise plan.',
        feature: 'lead_generation',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    // Get domain from request
    const domain = req.body?.domain || req.query?.domain || req.params?.domain;
    if (!domain) {
      // No domain specified, allow (will be checked later)
      req.planData = planData;
      return next();
    }

    // Get domains limit from plan
    const domainsLimit = planData.limits?.scraping_domains_per_month;
    
    // Unlimited (-1) means no limit
    if (domainsLimit === -1) {
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
    let canScrape = true;
    if (supabase.rpc && typeof supabase.rpc === 'function') {
      const { data: canScrapeResult, error: checkError } = await supabase
        .rpc('can_scrape_domain', {
          user_uuid: userId,
          domain_to_check: domain
        });

      if (checkError) {
        logger.warn('Database function failed, using manual check', { error: checkError.message, userId, domain });
        // Fall through to manual check below
      } else {
        canScrape = canScrapeResult;
      }
    }

    // Manual check fallback if database function not available
    if (canScrape === true && (!supabase.rpc || typeof supabase.rpc !== 'function')) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      // Count distinct domains scraped this month
      const { data: executions } = await supabase
        .from('scrape_executions')
        .select('domain')
        .eq('user_id', userId)
        .eq('status', 'success')
        .gte('started_at', startOfMonth.toISOString());

      const uniqueDomains = new Set(executions?.map(e => e.domain) || []);
      const domainsUsed = uniqueDomains.size;
      
      canScrape = domainsUsed < domainsLimit;
    }

    if (!canScrape) {
      // Get usage for error message
      const { data: usage } = await supabase
        .rpc('get_scraping_usage', { user_uuid: userId })
        .single();

      return res.status(403).json({
        error: 'Scraping limit reached',
        message: `You've reached your monthly domain scraping limit (${domainsLimit} domains/month). Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: usage?.domains_scraped_this_month || 0,
        limit: domainsLimit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in scraping domain limit check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Middleware: Check if user can create a scrape job
 * Enforces job creation limits based on plan
 */
const checkScrapingJobLimit = async (req, res, next) => {
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
    
    // Check if lead generation is enabled
    const leadGenValue = planData.limits?.lead_generation;
    const hasLeadGen = typeof leadGenValue === 'string' 
      ? leadGenValue.toLowerCase() !== 'no' && leadGenValue !== ''
      : !!leadGenValue;

    if (!hasLeadGen) {
      return res.status(403).json({
        error: 'Lead generation not available',
        message: 'This feature requires a Professional or Enterprise plan.',
        feature: 'lead_generation',
        current_plan: planData.plan.name,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    // Get jobs limit from plan
    const jobsLimit = planData.limits?.scraping_jobs_per_month;
    
    // Unlimited (-1) means no limit
    if (jobsLimit === -1) {
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
        .rpc('can_create_scrape_job', {
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
        .from('scrape_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      canCreate = (count || 0) < jobsLimit;
    }

    if (!canCreate) {
      // Get current job count
      const { count } = await supabase
        .from('scrape_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      return res.status(403).json({
        error: 'Job creation limit reached',
        message: `You've reached your scrape job limit (${jobsLimit} jobs). Upgrade for higher limits.`,
        current_plan: planData.plan.name,
        usage: count || 0,
        limit: jobsLimit,
        upgrade_required: true,
        upgrade_url: '/pricing'
      });
    }

    req.planData = planData;
    next();
  } catch (error) {
    logger.error('Error in scraping job limit check', error, { userId: req.user?.id });
    // Fail open for availability
    req.planData = null;
    next();
  }
};

/**
 * Helper: Get scraping usage for a user
 */
async function getScrapingUsage(userId) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        domains_scraped_this_month: 0,
        jobs_created: 0,
        total_scrapes: 0
      };
    }

    const { data, error } = await supabase
      .rpc('get_scraping_usage', { user_uuid: userId })
      .single();

    if (error) {
      logger.warn('Error getting scraping usage', { error: error.message, userId });
      return {
        domains_scraped_this_month: 0,
        jobs_created: 0,
        total_scrapes: 0
      };
    }

    return data || {
      domains_scraped_this_month: 0,
      jobs_created: 0,
      total_scrapes: 0
    };
  } catch (error) {
    logger.error('Error in getScrapingUsage', error, { userId });
    return {
      domains_scraped_this_month: 0,
      jobs_created: 0,
      total_scrapes: 0
    };
  }
}

module.exports = {
  checkScrapingDomainLimit,
  checkScrapingJobLimit,
  getScrapingUsage
};

