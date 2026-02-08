/**
 * Scraping & Lead Generation API Routes
 *
 * Provides endpoints for:
 * - Managing scrape jobs
 * - Viewing job postings
 * - Proxy management
 * - Queue management
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { traceContextMiddleware } = require('../middleware/traceContext');
const { getSupabase } = require('../utils/supabaseClient');
const { getProxyManager } = require('../services/proxyManager');
const { getAntiBotService } = require('../services/antiBotService');
const { getScrapeQueueManager } = require('../services/scrapeQueueManager');
const { getJobParserService } = require('../services/jobParserService');
const { getCompanyEnrichmentService } = require('../services/companyEnrichmentService');
const { getLeadScoringService } = require('../services/leadScoringService');
const { getContactEnrichmentService } = require('../services/contactEnrichmentService');
const { getColdEmailService } = require('../services/coldEmailService');
const { getPersonalizationService } = require('../services/personalizationService');
const { getPerformanceLearningService } = require('../services/performanceLearningService');
const { requireAuth } = require('../middleware/auth');
const { requireFeature, getUserPlan } = require('../middleware/planEnforcement');
const { checkScrapingDomainLimit, checkScrapingJobLimit, getScrapingUsage } = require('../middleware/scrapingRateLimit');
const { enforceBoundaries, trackExecution } = require('../middleware/boundaryEnforcement');
const axios = require('axios');
const { validateUrlForSSRF } = require('../utils/ssrfProtection');

const logger = createLogger('routes.scraping');
const contextLoggerMiddleware = traceContextMiddleware;

// Route-level middleware: Apply boundary enforcement to all POST operations
router.post('*', enforceBoundaries('scraping'), trackExecution);

/**
 * GET /api/scraping/queue/stats
 * Get queue statistics
 * OBSERVABILITY: Full request logging with performance tracking
 */
router.get('/queue/stats', requireAuth, contextLoggerMiddleware, async (req, res) => {
 const startTime = Date.now();
 const userId = req.user?.id;
 const userEmail = req.user?.email;

 const reqLogger = logger
 .withUser({ id: userId, email: userEmail })
 .withOperation('scraping.route.queue_stats', { requestId: req.requestId });

 try {
 const queueManager = getScrapeQueueManager();
 const stats = queueManager.getStats();

 const duration = Date.now() - startTime;
 reqLogger.performance('scraping.route.queue_stats', duration, {
 category: 'api_endpoint',
 success: true
 });

 res.json({
 success: true,
 stats
 });
 } catch (error) {
 const duration = Date.now() - startTime;
 reqLogger.error('Failed to get queue stats', error, {
 duration,
 operation: 'scraping.route.queue_stats'
 });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/queue/enqueue
 * Add domain(s) to scrape queue
 * OBSERVABILITY: Full request logging with performance tracking
 * PLAN ENFORCEMENT: Checks lead_generation feature and domain limits
 * BOUNDARY ENFORCEMENT: Tracks execution and enforces rate limits
 */
router.post('/queue/enqueue', requireAuth, requireFeature('lead_generation'), checkScrapingDomainLimit, enforceBoundaries('scraping'), trackExecution, contextLoggerMiddleware, async (req, res) => {
 const startTime = Date.now();
 const userId = req.user?.id;
 const userEmail = req.user?.email;

 const reqLogger = logger
 .withUser({ id: userId, email: userEmail })
 .withOperation('scraping.route.queue_enqueue', { requestId: req.requestId });

 try {
 const { domains, options } = req.body;

 if (!domains || (Array.isArray(domains) && domains.length === 0)) {
 return res.status(400).json({
 success: false,
 error: 'domains array is required'
 });
 }

 const queueManager = getScrapeQueueManager();
 const domainList = Array.isArray(domains) ? domains : [domains];

 reqLogger.info('Enqueuing domains for scraping', {
 domainCount: domainList.length,
 priority: options?.priority || 0
 });

 const jobIds = await queueManager.enqueueBatch(domainList, {
 priority: options?.priority || 0,
 retries: options?.retries || 3,
 rateLimit: options?.rateLimit || 60,
 config: options?.config || {},
 metadata: {
 userId: req.user.id,
 ...options?.metadata
 }
 });

 const duration = Date.now() - startTime;
 reqLogger.performance('scraping.route.queue_enqueue', duration, {
 category: 'api_endpoint',
 success: true,
 jobCount: jobIds.length
 });

 reqLogger.metric('scraping.queue.enqueued', jobIds.length, 'count', {
 userId,
 priority: options?.priority || 0
 });

 res.json({
 success: true,
 jobIds,
 count: jobIds.length
 });
 } catch (error) {
 const duration = Date.now() - startTime;
 reqLogger.error('Failed to enqueue domains', error, {
 duration,
 operation: 'scraping.route.queue_enqueue'
 });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/proxy/stats
 * Get proxy statistics
 */
router.get('/proxy/stats', requireAuth, contextLoggerMiddleware, async (req, res) => {
 try {
 const proxyManager = getProxyManager();
 const stats = proxyManager.getStats();

 res.json({
 success: true,
 stats
 });
 } catch (error) {
 logger.error('Failed to get proxy stats', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/antibot/config
 * Get anti-bot configuration for a domain
 */
router.get('/antibot/config', requireAuth, contextLoggerMiddleware, async (req, res) => {
 try {
 const { domain } = req.query;

 if (!domain) {
 return res.status(400).json({
 success: false,
 error: 'domain query parameter is required'
 });
 }

 const antiBotService = getAntiBotService();
 const config = antiBotService.getAntiBotConfig(domain);

 res.json({
 success: true,
 config
 });
 } catch (error) {
 logger.error('Failed to get anti-bot config', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/captcha/solve
 * Solve a CAPTCHA
 */
router.post('/captcha/solve', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { imageUrl, captchaType } = req.body;

 if (!imageUrl) {
 return res.status(400).json({
 success: false,
 error: 'imageUrl is required (base64 encoded image)'
 });
 }

 const antiBotService = getAntiBotService();
 const solution = await antiBotService.solveCaptcha(imageUrl, captchaType || 'image');

 res.json({
 success: true,
 solution
 });
 } catch (error) {
 logger.error('Failed to solve CAPTCHA', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/jobs
 * List scrape jobs for user
 */
router.get('/jobs', requireAuth, contextLoggerMiddleware, async (req, res) => {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { data: jobs, error } = await supabase
 .from('scrape_jobs')
 .select('*')
 .eq('user_id', req.user.id)
 .order('created_at', { ascending: false });

 if (error) {
 throw error;
 }

 res.json({
 success: true,
 jobs: jobs || []
 });
 } catch (error) {
 logger.error('Failed to list scrape jobs', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/jobs
 * Create a new scrape job
 * PLAN ENFORCEMENT: Checks lead_generation feature and job creation limits
 */
router.post('/jobs', requireAuth, requireFeature('lead_generation'), checkScrapingJobLimit, contextLoggerMiddleware, async (req, res) => {
 try {
 const { domain, frequency, jobPattern, config, priority } = req.body;

 if (!domain || !frequency) {
 return res.status(400).json({
 success: false,
 error: 'domain and frequency are required'
 });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Calculate next_run based on frequency
 const nextRun = calculateNextRun(frequency);

 const { data: job, error } = await supabase
 .from('scrape_jobs')
 .insert({
 domain,
 frequency,
 job_pattern: jobPattern,
 next_run: nextRun.toISOString(),
 user_id: req.user.id,
 config: config || {},
 priority: priority || 0,
 status: 'pending'
 })
 .select()
 .single();

 if (error) {
 throw error;
 }

 // Also add to in-memory queue
 const queueManager = getScrapeQueueManager();
 await queueManager.enqueue(domain, {
 priority: priority || 0,
 scheduledFor: nextRun,
 config: config || {},
 metadata: { dbJobId: job.id }
 });

 res.json({
 success: true,
 job
 });
 } catch (error) {
 logger.error('Failed to create scrape job', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * Helper: Calculate next run time based on frequency
 */
function calculateNextRun(frequency) {
 // ✅ SECURITY: Validate type before using string methods
 const safeFrequency = typeof frequency === 'string' ? frequency : String(frequency || 'daily');

 const now = new Date();
 const next = new Date(now);

 switch (safeFrequency.toLowerCase()) {
 case 'hourly':
 next.setHours(next.getHours() + 1);
 break;
 case 'daily':
 next.setDate(next.getDate() + 1);
 break;
 case 'weekly':
 next.setDate(next.getDate() + 7);
 break;
 case 'monthly':
 next.setMonth(next.getMonth() + 1);
 break;
 default:
 next.setHours(next.getHours() + 24); // Default to daily
 }

 return next;
}

/**
 * POST /api/scraping/parse-job
 * Parse a job posting from URL or HTML
 */
router.post('/parse-job', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { url, html, atsVendor } = req.body;

 if (!url && !html) {
 return res.status(400).json({
 success: false,
 error: 'url or html is required'
 });
 }

 // Fetch HTML if only URL provided
 let jobHtml = html;
 if (!jobHtml && url) {
 // ✅ SECURITY: Validate URL to prevent SSRF
 const urlValidation = validateUrlForSSRF(url);
 if (!urlValidation.valid) {
 return res.status(400).json({
 success: false,
 error: `Invalid URL: ${urlValidation.error}`
 });
 }

 try {
 const response = await axios.get(urlValidation.url, {
 timeout: 30000,
 headers: {
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
 }
 });
 jobHtml = response.data;
 } catch (error) {
 logger.warn('Failed to fetch URL', { url, error: error.message });
 return res.status(400).json({
 success: false,
 error: `Failed to fetch URL: ${error.message}`
 });
 }
 }

 const parser = getJobParserService();
 const result = await parser.parseJobPosting(url || 'unknown', jobHtml, atsVendor);

 if (result.success) {
 // Save to database if user wants
 if (req.body.saveToDatabase !== false) {
 const supabase = getSupabase();
 if (supabase && result.normalizedData) {
 const normalized = result.normalizedData;
 const { error: insertError } = await supabase
 .from('job_postings')
 .insert({
 company_domain: normalized.sourceUrl ? new URL(normalized.sourceUrl).hostname.replace('www.', '') : null,
 company_name: normalized.companyName,
 role_title: normalized.roleTitle,
 location: normalized.location,
 salary_range: normalized.salaryRange,
 posting_date: normalized.postingDate,
 seniority: normalized.seniority,
 department: normalized.department,
 tech_stack: normalized.techStack,
 source_url: normalized.sourceUrl,
 ats_vendor: result.atsVendor,
 raw_data: result.rawData,
 normalized_data: normalized,
 user_id: req.user.id,
 scrape_status: 'success'
 });

 if (insertError) {
 logger.warn('Failed to save job posting to database', { error: insertError.message });
 }
 }
 }
 }

 res.json(result);
 } catch (error) {
 logger.error('Failed to parse job posting', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/parse-careers-page
 * Parse multiple job postings from a careers page
 */
router.post('/parse-careers-page', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { url, html } = req.body;

 if (!url && !html) {
 return res.status(400).json({
 success: false,
 error: 'url or html is required'
 });
 }

 // Fetch HTML if only URL provided
 let pageHtml = html;
 if (!pageHtml && url) {
 // ✅ SECURITY: Validate URL to prevent SSRF
 const urlValidation = validateUrlForSSRF(url);
 if (!urlValidation.valid) {
 return res.status(400).json({
 success: false,
 error: `Invalid URL: ${urlValidation.error}`
 });
 }

 try {
 const response = await axios.get(urlValidation.url, {
 timeout: 30000,
 headers: {
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
 }
 });
 pageHtml = response.data;
 } catch (error) {
 logger.warn('Failed to fetch URL', { url, error: error.message });
 return res.status(400).json({
 success: false,
 error: `Failed to fetch URL: ${error.message}`
 });
 }
 }

 const parser = getJobParserService();
 const result = await parser.parseCareersPage(url || 'unknown', pageHtml);

 res.json(result);
 } catch (error) {
 logger.error('Failed to parse careers page', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/enrich-company
 * Enrich company profile from domain
 */
router.post('/enrich-company', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { domain, saveToDatabase } = req.body;

 if (!domain) {
 return res.status(400).json({
 success: false,
 error: 'domain is required'
 });
 }

 const enrichmentService = getCompanyEnrichmentService();
 const result = await enrichmentService.enrichCompany(domain, {
 skipClearbit: req.body.skipClearbit === true
 });

 if (result.success && saveToDatabase !== false) {
 await enrichmentService.saveCompanyProfile(domain, result.data);
 }

 res.json(result);
 } catch (error) {
 logger.error('Failed to enrich company', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/job-postings
 * List job postings with filters
 */
router.get('/job-postings', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { domain, atsVendor, department, seniority, limit = 50, offset = 0 } = req.query;

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 let query = supabase
 .from('job_postings')
 .select('*')
 .eq('user_id', req.user.id)
 .order('scraped_at', { ascending: false })
 .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

 if (domain) {
 query = query.eq('company_domain', domain);
 }
 if (atsVendor) {
 query = query.eq('ats_vendor', atsVendor);
 }
 if (department) {
 query = query.eq('department', department);
 }
 if (seniority) {
 query = query.eq('seniority', seniority);
 }

 const { data, error, count } = await query;

 if (error) {
 throw error;
 }

 res.json({
 success: true,
 jobPostings: data || [],
 count: data?.length || 0
 });
 } catch (error) {
 logger.error('Failed to list job postings', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/company-profiles
 * List company profiles
 */
router.get('/company-profiles', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { domain, industry, limit = 50, offset = 0 } = req.query;

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 let query = supabase
 .from('company_profiles')
 .select('*')
 .order('enriched_at', { ascending: false })
 .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

 if (domain) {
 query = query.eq('domain', domain);
 }
 if (industry) {
 query = query.eq('industry', industry);
 }

 const { data, error } = await query;

 if (error) {
 throw error;
 }

 res.json({
 success: true,
 companies: data || [],
 count: data?.length || 0
 });
 } catch (error) {
 logger.error('Failed to list company profiles', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/calculate-lead-score
 * Calculate lead score for a company
 */
router.post('/calculate-lead-score', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { companyDomain, weights, techStackPreferences, departmentPreferences } = req.body;

 if (!companyDomain) {
 return res.status(400).json({
 success: false,
 error: 'companyDomain is required'
 });
 }

 const scoringService = getLeadScoringService();
 const result = await scoringService.calculateLeadScore(companyDomain, {
 weights,
 techStackPreferences,
 departmentPreferences,
 userId: req.user.id
 });

 res.json(result);
 } catch (error) {
 logger.error('Failed to calculate lead score', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/filter-by-icp
 * Filter companies by ICP criteria
 */
router.post('/filter-by-icp', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const criteria = req.body;

 if (!criteria || typeof criteria !== 'object') {
 return res.status(400).json({
 success: false,
 error: 'ICP criteria object is required'
 });
 }

 const scoringService = getLeadScoringService();
 const result = await scoringService.filterByICP(criteria, {
 userId: req.user.id
 });

 res.json(result);
 } catch (error) {
 logger.error('Failed to filter by ICP', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/lead-scores
 * List lead scores with filters
 */
router.get('/lead-scores', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { minScore, maxScore, limit = 50, offset = 0 } = req.query;

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 let query = supabase
 .from('lead_scores')
 .select('*, company_profiles(*)')
 .eq('user_id', req.user.id)
 .order('score', { ascending: false })
 .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

 if (minScore) {
 query = query.gte('score', parseFloat(minScore));
 }
 if (maxScore) {
 query = query.lte('score', parseFloat(maxScore));
 }

 const { data, error } = await query;

 if (error) {
 throw error;
 }

 res.json({
 success: true,
 leadScores: data || [],
 count: data?.length || 0
 });
 } catch (error) {
 logger.error('Failed to list lead scores', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/enrich-contact
 * Enrich a contact with email and professional info
 */
router.post('/enrich-contact', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { firstName, lastName, companyDomain } = req.body;

 if (!firstName || !lastName || !companyDomain) {
 return res.status(400).json({
 success: false,
 error: 'firstName, lastName, and companyDomain are required'
 });
 }

 const enrichmentService = getContactEnrichmentService();
 const result = await enrichmentService.enrichContact(firstName, lastName, companyDomain, {
 skipHunter: req.body.skipHunter === true,
 skipApollo: req.body.skipApollo === true,
 skipRocketReach: req.body.skipRocketReach === true
 });

 res.json(result);
 } catch (error) {
 logger.error('Failed to enrich contact', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/find-decision-makers
 * Find decision-makers at a company
 */
router.post('/find-decision-makers', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { companyDomain, department } = req.body;

 if (!companyDomain) {
 return res.status(400).json({
 success: false,
 error: 'companyDomain is required'
 });
 }

 const enrichmentService = getContactEnrichmentService();
 const result = await enrichmentService.findDecisionMakers(companyDomain, department);

 res.json(result);
 } catch (error) {
 logger.error('Failed to find decision-makers', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/verify-email
 * Verify an email address
 */
router.post('/verify-email', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { email } = req.body;

 if (!email) {
 return res.status(400).json({
 success: false,
 error: 'email is required'
 });
 }

 const enrichmentService = getContactEnrichmentService();
 const result = await enrichmentService.verifyEmail(email);

 res.json(result);
 } catch (error) {
 logger.error('Failed to verify email', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/create-campaign
 * Create a cold email campaign
 */
router.post('/create-campaign', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { platform, campaignData } = req.body;

 if (!platform || !campaignData) {
 return res.status(400).json({
 success: false,
 error: 'platform and campaignData are required'
 });
 }

 if (!['instantly', 'smartlead'].includes(platform)) {
 return res.status(400).json({
 success: false,
 error: 'platform must be "instantly" or "smartlead"'
 });
 }

 const coldEmailService = getColdEmailService();
 let result;

 if (platform === 'instantly') {
 result = await coldEmailService.createInstantlyCampaign(campaignData);
 } else {
 result = await coldEmailService.createSmartleadCampaign(campaignData);
 }

 if (result.success) {
 await coldEmailService.saveCampaign({
 ...campaignData,
 platform,
 campaignId: result.campaignId
 }, req.user.id);
 }

 res.json(result);
 } catch (error) {
 logger.error('Failed to create campaign', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/add-leads-to-campaign
 * Add leads to a cold email campaign
 */
router.post('/add-leads-to-campaign', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { platform, campaignId, leads } = req.body;

 if (!platform || !campaignId || !leads || !Array.isArray(leads)) {
 return res.status(400).json({
 success: false,
 error: 'platform, campaignId, and leads array are required'
 });
 }

 const coldEmailService = getColdEmailService();
 let result;

 if (platform === 'instantly') {
 result = await coldEmailService.addLeadsToInstantlyCampaign(campaignId, leads);
 } else {
 result = await coldEmailService.addLeadsToSmartleadCampaign(campaignId, leads);
 }

 res.json(result);
 } catch (error) {
 logger.error('Failed to add leads to campaign', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/campaign-stats
 * Get campaign statistics
 */
router.get('/campaign-stats', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { platform, campaignId } = req.query;

 if (!platform || !campaignId) {
 return res.status(400).json({
 success: false,
 error: 'platform and campaignId query parameters are required'
 });
 }

 const coldEmailService = getColdEmailService();
 const result = await coldEmailService.getCampaignStats(platform, campaignId);

 res.json(result);
 } catch (error) {
 logger.error('Failed to get campaign stats', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/export-leads
 * Export leads in campaign-ready format
 */
router.post('/export-leads', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { leads, format = 'csv' } = req.body;

 if (!leads || !Array.isArray(leads)) {
 return res.status(400).json({
 success: false,
 error: 'leads array is required'
 });
 }

 const coldEmailService = getColdEmailService();
 let content, contentType;

 if (format === 'json') {
 content = coldEmailService.exportLeadsToJSON(leads);
 contentType = 'application/json';
 } else {
 content = coldEmailService.exportLeadsToCSV(leads);
 contentType = 'text/csv';
 }

 res.setHeader('Content-Type', contentType);
 res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.${format}"`);
 res.send(content);
 } catch (error) {
 logger.error('Failed to export leads', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/generate-personalized-snippet
 * Generate personalized email snippet from job posting
 */
router.post('/generate-personalized-snippet', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { jobPostingId, contactInfo, options } = req.body;

 if (!jobPostingId) {
 return res.status(400).json({
 success: false,
 error: 'jobPostingId is required'
 });
 }

 // Get job posting from database
 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 const { data: jobPosting, error } = await supabase
 .from('job_postings')
 .select('*')
 .eq('id', jobPostingId)
 .eq('user_id', req.user.id)
 .single();

 if (error || !jobPosting) {
 return res.status(404).json({
 success: false,
 error: 'Job posting not found'
 });
 }

 const personalizationService = getPersonalizationService();
 const result = await personalizationService.generatePersonalizedSnippet(
 jobPosting,
 contactInfo || {},
 options || {}
 );

 res.json(result);
 } catch (error) {
 logger.error('Failed to generate personalized snippet', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/generate-personalized-email
 * Generate personalized email from template
 */
router.post('/generate-personalized-email', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { template, variables, options } = req.body;

 if (!template || !variables) {
 return res.status(400).json({
 success: false,
 error: 'template and variables are required'
 });
 }

 const personalizationService = getPersonalizationService();
 const result = await personalizationService.generatePersonalizedEmail(template, variables, options);

 res.json(result);
 } catch (error) {
 logger.error('Failed to generate personalized email', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/playbook-template
 * Get playbook template
 */
router.get('/playbook-template', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const { playbookName = 'generic' } = req.query;

 const personalizationService = getPersonalizationService();
 const template = personalizationService.getPlaybookTemplate(playbookName);

 res.json({
 success: true,
 template
 });
 } catch (error) {
 logger.error('Failed to get playbook template', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/track-email-performance
 * Track email performance metrics
 */
router.post('/track-email-performance', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const emailData = req.body;

 if (!emailData.email || !emailData.companyDomain) {
 return res.status(400).json({
 success: false,
 error: 'email and companyDomain are required'
 });
 }

 const learningService = getPerformanceLearningService();
 const result = await learningService.trackEmailPerformance({
 ...emailData,
 userId: req.user.id
 });

 res.json(result);
 } catch (error) {
 logger.error('Failed to track email performance', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/analyze-signal-correlation
 * Analyze which signals correlate with better performance
 */
router.get('/analyze-signal-correlation', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const learningService = getPerformanceLearningService();
 const result = await learningService.analyzeSignalCorrelation(req.user.id);

 res.json(result);
 } catch (error) {
 logger.error('Failed to analyze signal correlation', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/scraping/update-scoring-weights
 * Update lead scoring weights based on performance
 */
router.post('/update-scoring-weights', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const learningService = getPerformanceLearningService();
 const result = await learningService.updateScoringWeights(req.user.id, req.body);

 res.json(result);
 } catch (error) {
 logger.error('Failed to update scoring weights', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/usage
 * Get scraping usage statistics for current user
 * PLAN ENFORCEMENT: Returns usage and limits based on current plan
 */
router.get('/usage', requireAuth, contextLoggerMiddleware, async (req, res) => {
 const startTime = Date.now();
 const userId = req.user?.id;
 const userEmail = req.user?.email;

 const reqLogger = logger
 .withUser({ id: userId, email: userEmail })
 .withOperation('scraping.route.usage', { requestId: req.requestId });

 try {
 const planData = await getUserPlan(userId);
 const scrapingUsage = await getScrapingUsage(userId);

 const usage = {
 domains_scraped_this_month: scrapingUsage.domains_scraped_this_month || 0,
 jobs_created: scrapingUsage.jobs_created || 0,
 total_scrapes: scrapingUsage.total_scrapes || 0,
 limits: {
 domains_per_month: planData.limits?.scraping_domains_per_month ?? 0,
 jobs_per_month: planData.limits?.scraping_jobs_per_month ?? 0,
 lead_generation: planData.limits?.lead_generation || 'No'
 },
 plan: planData.plan.name
 };

 const duration = Date.now() - startTime;
 reqLogger.performance('scraping.route.usage', duration, {
 category: 'api_endpoint',
 success: true
 });

 res.json({
 success: true,
 usage
 });
 } catch (error) {
 const duration = Date.now() - startTime;
 reqLogger.error('Failed to get scraping usage', error, {
 duration,
 operation: 'scraping.route.usage'
 });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/scraping/performance-metrics
 * Get performance metrics
 */
router.get('/performance-metrics', requireAuth, requireFeature('lead_generation'), contextLoggerMiddleware, async (req, res) => {
 try {
 const learningService = getPerformanceLearningService();
 const result = await learningService.getPerformanceMetrics(req.user.id);

 res.json(result);
 } catch (error) {
 logger.error('Failed to get performance metrics', { error: error.message });
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

module.exports = router;

