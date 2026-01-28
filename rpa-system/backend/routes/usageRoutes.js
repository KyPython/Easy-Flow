/**
 * Usage Statistics API Routes
 * Provides comprehensive usage statistics for all plan features
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getUserPlan } = require('../middleware/planEnforcement');
const { getComprehensiveUsage } = require('../middleware/comprehensiveRateLimit');
const { getScrapingUsage } = require('../middleware/scrapingRateLimit');
const { createLogger } = require('../middleware/structuredLogging');
const { traceContextMiddleware } = require('../middleware/traceContext');

const logger = createLogger('routes.usage');
const contextLoggerMiddleware = traceContextMiddleware;

/**
 * GET /api/usage
 * Get comprehensive usage statistics for current user
 * Returns all usage metrics aligned with pricing page features
 */
router.get('/', requireAuth, contextLoggerMiddleware, async (req, res) => {
 const startTime = Date.now();
 const userId = req.user?.id;
 const userEmail = req.user?.email;

 const reqLogger = logger
 .withUser({ id: userId, email: userEmail })
 .withOperation('usage.route.get_usage', { requestId: req.requestId });

 try {
 const planData = await getUserPlan(userId);
 const comprehensiveUsage = await getComprehensiveUsage(userId);
 const scrapingUsage = await getScrapingUsage(userId);

 const usage = {
 // Automation runs
 automation_runs: {
 this_month: comprehensiveUsage.automation_runs_this_month || 0,
 limit: planData.limits?.automation_runs || 0,
 unlimited: planData.limits?.automation_runs === -1
 },

 // Storage
 storage: {
 used_gb: comprehensiveUsage.storage_gb_used || 0,
 limit_gb: planData.limits?.storage_gb || 0,
 unlimited: planData.limits?.storage_gb === -1
 },

 // Webhooks
 webhooks: {
 created: comprehensiveUsage.webhooks_created || 0,
 limit: (() => {
 const webhookValue = planData.limits?.webhook_integrations || planData.limits?.webhook_management;
 if (typeof webhookValue === 'number') return webhookValue;
 if (typeof webhookValue === 'string') {
 if (webhookValue.toLowerCase().includes('unlimited')) return -1;
 const match = webhookValue.match(/\d+/);
 return match ? parseInt(match[0], 10) : 0;
 }
 return 0;
 })(),
 unlimited: (() => {
 const webhookValue = planData.limits?.webhook_integrations || planData.limits?.webhook_management;
 return typeof webhookValue === 'string' && webhookValue.toLowerCase().includes('unlimited');
 })()
 },

 // Scheduled automations
 scheduled_automations: {
 today: comprehensiveUsage.scheduled_automations_today || 0,
 total: comprehensiveUsage.scheduled_automations_total || 0,
 daily_limit: (() => {
 const scheduledValue = planData.limits?.scheduled_automations;
 if (typeof scheduledValue === 'string') {
 if (scheduledValue.toLowerCase().includes('unlimited')) return -1;
 const match = scheduledValue.match(/\d+/);
 return match ? parseInt(match[0], 10) : 0;
 }
 return 0;
 })(),
 unlimited: (() => {
 const scheduledValue = planData.limits?.scheduled_automations;
 return typeof scheduledValue === 'string' && scheduledValue.toLowerCase().includes('unlimited');
 })()
 },

 // Integrations
 integrations: {
 created: comprehensiveUsage.integrations_created || 0,
 limit: (() => {
 const integrationValue = planData.limits?.custom_integrations;
 if (typeof integrationValue === 'number') return integrationValue;
 if (typeof integrationValue === 'string') {
 if (integrationValue.toLowerCase().includes('unlimited')) return -1;
 const match = integrationValue.match(/\d+/);
 return match ? parseInt(match[0], 10) : 0;
 }
 return 0;
 })(),
 unlimited: (() => {
 const integrationValue = planData.limits?.custom_integrations;
 return typeof integrationValue === 'string' && integrationValue.toLowerCase().includes('unlimited');
 })()
 },

 // Workflows
 workflows: {
 created: comprehensiveUsage.workflows_created || 0,
 limit: planData.limits?.workflows || -1,
 unlimited: planData.limits?.workflows === -1 || planData.limits?.automation_workflows === 'Unlimited'
 },

 // Scraping (if available)
 scraping: scrapingUsage ? {
 domains_this_month: scrapingUsage.domains_scraped_this_month || 0,
 jobs_created: scrapingUsage.jobs_created || 0,
 total_scrapes: scrapingUsage.total_scrapes || 0,
 domains_limit: planData.limits?.scraping_domains_per_month || 0,
 jobs_limit: planData.limits?.scraping_jobs_per_month || 0,
 enabled: planData.limits?.lead_generation && planData.limits?.lead_generation !== 'No'
 } : null,

 // Plan info
 plan: {
 name: planData.plan.name,
 features: {
 api_access: planData.limits?.api_access || planData.limits?.full_api_access || 'No',
 audit_logs: planData.limits?.audit_logs || 'No',
 lead_generation: planData.limits?.lead_generation || 'No',
 advanced_analytics: planData.limits?.advanced_analytics || 'No',
 priority_support: planData.limits?.priority_support || 'No'
 }
 }
 };

 const duration = Date.now() - startTime;
 reqLogger.performance('usage.route.get_usage', duration, {
 category: 'api_endpoint',
 success: true
 });

 res.json({
 success: true,
 usage
 });
 } catch (error) {
 const duration = Date.now() - startTime;
 reqLogger.error('Failed to get usage statistics', error, {
 duration,
 operation: 'usage.route.get_usage'
 });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

module.exports = router;

