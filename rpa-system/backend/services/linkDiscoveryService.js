
const { logger, getLogger } = require('../utils/logger');
const puppeteer = require('puppeteer');
const { PasswordResetService } = require('./PasswordResetService');
const { SiteAdaptationService } = require('./SiteAdaptationService');
const { getSupabase } = require('../utils/supabaseClient');
const { getBrowserVisualizationService } = require('./browserVisualizationService');

/**
 * Link Discovery Service for Seamless Invoice Download
 *
 * Automatically finds PDF download links after login, eliminating manual URL hunting.
 * Supports multiple discovery methods for maximum compatibility.
 *
 * ✅ ADAPTIVE LEARNING: Learns from every run and improves over time
 * - Stores successful patterns in database
 * - Tries learned patterns first for faster discovery
 * - Adapts to site changes automatically
 * - Works with any site structure in the world
 */
class LinkDiscoveryService {
 constructor() {
 this.config = {
 TIMEOUT: 30000,
 SELECTOR_TIMEOUT: 15000,
 LOGIN_TIMEOUT: 25000
 };
 this.passwordResetService = new PasswordResetService();
 this.siteAdaptationService = new SiteAdaptationService();
 this.supabase = getSupabase();
 // Cache for learned patterns (in-memory for speed)
 this.patternCache = new Map();
 }

 /**
 * Helper function to wait for a specified amount of time
 * Replaces deprecated page.waitForTimeout()
 */
 async _wait(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }

 /**
 * ✅ ADAPTIVE LEARNING: Get learned patterns for a site
 * Returns patterns that worked before, prioritized by success rate
 */
 async _getLearnedPatterns(siteUrl) {
 try {
 // Check cache first
 const cacheKey = this._normalizeUrl(siteUrl);
 if (this.patternCache.has(cacheKey)) {
 return this.patternCache.get(cacheKey);
 }

 if (!this.supabase) {
 logger.warn('[LinkDiscovery] Supabase not available, skipping pattern lookup');
 return [];
 }

 const { data, error } = await this.supabase
 .from('link_discovery_patterns')
 .select('*')
 .eq('site_url', cacheKey)
 .order('success_count', { ascending: false })
 .order('last_success_at', { ascending: false })
 .limit(5);

 if (error) {
 // Table might not exist yet - that's okay, we'll create it on first success
 if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
 logger.info('[LinkDiscovery] Learning tables not created yet - will be created on first successful discovery');
 return [];
 }
 logger.warn('[LinkDiscovery] Error fetching learned patterns:', error);
 return [];
 }

 // Cache for 5 minutes
 this.patternCache.set(cacheKey, data || []);
 setTimeout(() => this.patternCache.delete(cacheKey), 5 * 60 * 1000);

 return data || [];
 } catch (error) {
 logger.warn('[LinkDiscovery] Error getting learned patterns:', error);
 return [];
 }
 }

 /**
 * ✅ ADAPTIVE LEARNING: Learn from successful discovery
 * Stores patterns that worked for future use
 */
 async _learnFromSuccess(siteUrl, discoveredLinks, pageStructure, discoveryMethod, selectorsUsed = []) {
 try {
 if (!this.supabase) {
 logger.warn('[LinkDiscovery] Supabase not available, skipping pattern storage');
 return;
 }

 const normalizedUrl = this._normalizeUrl(siteUrl);

 // Extract pattern from successful discovery
 const pattern = {
 site_url: normalizedUrl,
 discovery_method: discoveryMethod,
 selectors_used: selectorsUsed,
 link_patterns: discoveredLinks.map(link => ({
 href_pattern: this._extractUrlPattern(link.href),
 text_pattern: link.text?.substring(0, 100), // First 100 chars
 selector: link.selector,
 score: link.score
 })),
 page_structure: {
 title: pageStructure.title,
 link_count: pageStructure.allLinks,
 has_forms: pageStructure.hasForms,
 structure_hash: this._hashStructure(pageStructure)
 },
 success_count: 1,
 last_success_at: new Date().toISOString(),
 created_at: new Date().toISOString()
 };

 // First, try to get existing pattern
 const { data: existing } = await this.supabase
 .from('link_discovery_patterns')
 .select('success_count')
 .eq('site_url', normalizedUrl)
 .eq('discovery_method', discoveryMethod)
 .maybeSingle();

 const { error } = await this.supabase
 .from('link_discovery_patterns')
 .upsert({
 ...pattern,
 success_count: (existing?.success_count || 0) + 1,
 updated_at: new Date().toISOString()
 }, {
 onConflict: 'site_url,discovery_method'
 });

 if (error) {
 // Table might not exist yet - that's okay, we'll create it via migration
 if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
 logger.info('[LinkDiscovery] Learning tables not created yet. Run migration: add_link_discovery_learning.sql');
 return;
 }
 logger.warn('[LinkDiscovery] Error learning from success:', error);
 } else {
 logger.info('[LinkDiscovery] ✅ Learned pattern stored for future use', {
 siteUrl: normalizedUrl,
 linksFound: discoveredLinks.length,
 method: discoveryMethod
 });
 // Clear cache to force refresh
 this.patternCache.delete(normalizedUrl);
 }
 } catch (error) {
 logger.warn('[LinkDiscovery] Error in learnFromSuccess:', error);
 }
 }

 /**
 * ✅ ADAPTIVE LEARNING: Learn from failure
 * Stores what didn't work to avoid repeating mistakes
 */
 async _learnFromFailure(siteUrl, errorMessage, attemptedMethod, pageStructure) {
 try {
 if (!this.supabase) {
 logger.warn('[LinkDiscovery] Supabase not available, skipping failure storage');
 return;
 }

 const normalizedUrl = this._normalizeUrl(siteUrl);

 const { error } = await this.supabase
 .from('link_discovery_failures')
 .insert({
 site_url: normalizedUrl,
 error_message: errorMessage,
 attempted_method: attemptedMethod,
 page_structure: pageStructure,
 occurred_at: new Date().toISOString()
 });

 if (error) {
 // Table might not exist yet - that's okay
 if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
 logger.info('[LinkDiscovery] Learning tables not created yet. Run migration: add_link_discovery_learning.sql');
 return;
 }
 logger.warn('[LinkDiscovery] Error learning from failure:', error);
 } else {
 logger.info('[LinkDiscovery] Failure pattern recorded for learning');
 }
 } catch (error) {
 logger.warn('[LinkDiscovery] Error learning from failure:', error);
 }
 }

 /**
 * ✅ ADAPTIVE LEARNING: Try multiple strategies in parallel
 * Uses learned patterns first, then falls back to all strategies
 */
 async _tryMultipleStrategies(page, siteUrl, learnedPatterns = []) {
 const strategies = [];

 // Strategy 1: Try learned patterns first (if available) - HIGHEST PRIORITY
 if (learnedPatterns.length > 0) {
 logger.info(`[LinkDiscovery] 🎯 Applying ${learnedPatterns.length} learned pattern(s) FIRST (highest priority)`);
 for (const pattern of learnedPatterns.slice(0, 3)) { // Try top 3 learned patterns
 strategies.push({
 name: `learned-${pattern.discovery_method}`,
 method: pattern.discovery_method,
 selectors: pattern.selectors_used || [],
 priority: 20, // HIGHEST priority - learned patterns always tried first
 pattern: pattern,
 success_count: pattern.success_count || 0
 });
 logger.debug(`[LinkDiscovery] Added learned pattern: ${pattern.discovery_method} (success_count: ${pattern.success_count || 0})`);
 }
 }

 // Strategy 2: Standard auto-detect (always try)
 strategies.push({
 name: 'auto-detect',
 method: 'auto-detect',
 priority: 5
 });

 // Strategy 3: Enhanced detection with multiple selectors
 strategies.push({
 name: 'enhanced-detect',
 method: 'enhanced-detect',
 priority: 3
 });

 // Try strategies in priority order
 strategies.sort((a, b) => b.priority - a.priority);

 for (const strategy of strategies) {
 try {
 logger.info(`[LinkDiscovery] Trying strategy: ${strategy.name}`);
 let result;

 if (strategy.method === 'auto-detect') {
 result = await this._autoDetectPdfLinks(page);
 } else if (strategy.method === 'enhanced-detect') {
 result = await this._enhancedDetectPdfLinks(page);
 } else if (strategy.pattern) {
 // Use learned pattern
 result = await this._applyLearnedPattern(page, strategy.pattern);
 }

 if (result && result.pdfLinks && result.pdfLinks.length > 0) {
 if (strategy.priority >= 20) {
 logger.info(`[LinkDiscovery] ✅ LEARNED PATTERN SUCCEEDED! ${strategy.name} found ${result.pdfLinks.length} links (success_count: ${strategy.success_count})`);
 } else {
 logger.info(`[LinkDiscovery] Strategy ${strategy.name} succeeded with ${result.pdfLinks.length} links`);
 }
 return { ...result, strategyUsed: strategy.name, wasLearnedPattern: strategy.priority >= 20 };
 }
 } catch (error) {
 logger.warn(`[LinkDiscovery] Strategy ${strategy.name} failed:`, error.message);
 // Continue to next strategy
 }
 }

 return { pdfLinks: [], allLinksFound: 0 };
 }

 /**
 * ✅ ADAPTIVE LEARNING: Apply a learned pattern
 */
 async _applyLearnedPattern(page, pattern) {
 try {
 // Use the selectors from the learned pattern
 const selectors = pattern.selectors_used || [];
 const linkPatterns = pattern.link_patterns || [];

 const result = await page.evaluate((selectors, linkPatterns) => {
 const results = [];

 // Try each learned selector
 for (const selector of selectors) {
 try {
 const elements = document.querySelectorAll(selector);
 elements.forEach(el => {
 const href = el.href || el.getAttribute('data-url') || '';
 if (href && (href.includes('.pdf') || href.includes('pdf'))) {
 results.push({
 href: href,
 text: el.textContent?.trim() || '',
 selector: selector,
 score: 0.9, // High score for learned patterns
 reasons: ['Learned pattern match']
 });
 }
 });
 } catch (e) {
 // Selector invalid, skip
 }
 }

 // Try matching link patterns
 const allLinks = Array.from(document.querySelectorAll('a, button, [onclick]'));
 allLinks.forEach(link => {
 const href = link.href || '';
 for (const pattern of linkPatterns) {
 if (pattern.href_pattern && href.includes(pattern.href_pattern)) {
 results.push({
 href: href,
 text: link.textContent?.trim() || pattern.text_pattern || '',
 selector: 'pattern-match',
 score: 0.85,
 reasons: ['Matches learned link pattern']
 });
 }
 }
 });

 return {
 pdfLinks: results,
 allLinksFound: document.querySelectorAll('a').length
 };
 }, selectors, linkPatterns);

 return result;
 } catch (error) {
 logger.warn('[LinkDiscovery] Error applying learned pattern:', error);
 return { pdfLinks: [], allLinksFound: 0 };
 }
 }

 /**
 * ✅ ADAPTIVE LEARNING: Enhanced detection with more strategies
 */
 async _enhancedDetectPdfLinks(page) {
 // This is a more aggressive version of auto-detect
 // It tries additional strategies like:
 // - Waiting for dynamic content
 // - Clicking through modals/dropdowns
 // - Following redirects
 // - Checking iframe content

 try {
 // Wait longer for dynamic content
 await this._wait(3000);

 // Check for modals or dropdowns that might contain links
 await page.evaluate(() => {
 // Try to open common dropdowns/modals
 const triggers = document.querySelectorAll('[data-toggle="modal"], [data-bs-toggle="modal"], .dropdown-toggle, [aria-haspopup="true"]');
 triggers.forEach(trigger => {
 try {
 trigger.click();
 } catch (e) {
 // Ignore click errors
 }
 });
 });

 await this._wait(1000);

 // Now run standard auto-detect
 return await this._autoDetectPdfLinks(page);
 } catch (error) {
 logger.warn('[LinkDiscovery] Enhanced detection failed:', error);
 return { pdfLinks: [], allLinksFound: 0 };
 }
 }

 /**
 * Helper: Normalize URL for consistent storage
 */
 _normalizeUrl(url) {
 if (!url) return '';
 try {
 const urlObj = new URL(url);
 return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
 } catch {
 return url.toLowerCase();
 }
 }

 /**
 * Helper: Extract URL pattern (removes IDs, timestamps, etc.)
 */
 _extractUrlPattern(url) {
 if (!url) return '';
 // Remove query params, hash, and common variable parts
 return url
 .split('?')[0]
 .split('#')[0]
 .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD') // Dates
 .replace(/\d{10,}/g, 'TIMESTAMP') // Timestamps
 .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID'); // UUIDs
 }

 /**
 * Helper: Hash page structure for comparison
 */
 _hashStructure(structure) {
 return JSON.stringify({
 title: structure.title,
 linkCount: structure.allLinks,
 hasForms: structure.hasForms
 });
 }

 /**
 * Main entry point for link discovery
 */
 async discoverPdfLinks({ url, username, password, discoveryMethod, discoveryValue, testMode = false, runId = null, learnedPatterns = null }) {
 const browser = await this._launchBrowser();
 const page = await browser.newPage();
 const vizService = getBrowserVisualizationService();

 try {
 logger.info(`[LinkDiscovery] Starting discovery for ${url} using method: ${discoveryMethod}`);

 // Step 1: Navigate to the page
 logger.info(`[LinkDiscovery] Navigating to: ${url}`);
 await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.TIMEOUT });

 // ✅ VISUALIZATION: Capture screenshot after navigation
 if (runId) {
 await vizService.captureAndUpdate(page, runId, 'Page loaded', '🌐 Page loaded successfully', 15);
 }

 // Wait for page to be ready
 await page.waitForFunction(() => document.readyState === 'complete', {
 timeout: this.config.SELECTOR_TIMEOUT
 });

 // Step 2: Attempt login if credentials provided and login form detected
 // ✅ DEMO PORTAL: Skip login for demo portal - it's a test site that doesn't require authentication
 const isDemoPortal = url && (
 url.includes('/demo') ||
 url.includes('localhost:3030/demo') ||
 url.includes('127.0.0.1:3030/demo')
 );

 // ✅ DEMO PORTAL: Auto-show invoices by adding ?auto=true to URL
 if (isDemoPortal && !url.includes('?auto=true') && !url.includes('?public=true')) {
 const separator = url.includes('?') ? '&' : '?';
 url = `${url}${separator}auto=true`;
 logger.info(`[LinkDiscovery] Demo portal detected, navigating to: ${url}`);
 await page.goto(url, { waitUntil: 'networkidle0', timeout: this.config.TIMEOUT });
 // Wait for invoice list to appear
 try {
 await page.waitForSelector('#invoiceList', { visible: true, timeout: 5000 });
 logger.info('[LinkDiscovery] Invoice list appeared on demo page');
 } catch (e) {
 logger.warn('[LinkDiscovery] Invoice list did not appear, continuing anyway');
 }
 }

 if (username && password && !isDemoPortal) {
 let adaptedSelectors = null;
 try {
 // ✅ VISUALIZATION: Capture screenshot before login
 if (runId) {
 await vizService.captureBeforeAction(page, runId, 'Login form detected', '🔐 Logging in...', 25);
 }

 // ✅ INTELLIGENT ADAPTATION: Get adapted selectors for this site
 adaptedSelectors = await this.siteAdaptationService.getAdaptedSelectors(url, 'login');

 await this._performLogin(page, { url, username, password, adaptedSelectors });

 // ✅ VISUALIZATION: Capture screenshot after login
 if (runId) {
 await vizService.captureAfterAction(page, runId, 'Login successful', '✅ Logged in successfully', 35);
 }

 // ✅ LEARNING: Store successful pattern
 await this.siteAdaptationService.learnFromSuccess({
 siteUrl: url,
 taskType: 'login',
 selectorsUsed: adaptedSelectors,
 executionTime: Date.now(),
 successPattern: { method: 'login', selectors: adaptedSelectors }
 });
 } catch (loginError) {
 // ✅ AUTO PASSWORD RESET: Check if password reset is needed
 const resetCheck = await this.passwordResetService.detectPasswordResetNeeded(page, loginError);

 if (resetCheck.needsReset && resetCheck.canAutoReset) {
 logger.info('[LinkDiscovery] Password reset needed, attempting automated reset');

 const resetResult = await this.passwordResetService.performPasswordReset(page, {
 email: username, // Assuming username is email
 resetLinkUrl: resetCheck.resetLinkUrl,
 siteUrl: url
 });

 if (resetResult.success) {
 // ✅ LEARNING: Store failure pattern for future reference
 await this.siteAdaptationService.learnFromFailure({
 siteUrl: url,
 taskType: 'login',
 errorMessage: loginError.message,
 attemptedSelectors: adaptedSelectors || [],
 pageStructure: await this._getPageStructure(page)
 });

 throw new Error(`Password reset email sent. ${resetResult.message}. Please update your password in EasyFlow and try again.`);
 }
 }

 // ✅ SELF-HEALING: Try alternative strategies
 const pageStructure = await this._getPageStructure(page);
 const healing = await this.siteAdaptationService.selfHeal(url, 'login', null, pageStructure);

 if (healing.shouldRetry && healing.strategies.length > 0) {
 logger.info('[LinkDiscovery] Attempting self-healing with alternative selectors', {
 strategyCount: healing.strategies.length
 });

 // Try alternative selectors
 for (const strategy of healing.strategies.slice(0, healing.maxRetries)) {
 try {
 await this._performLogin(page, {
 url,
 username,
 password,
 adaptedSelectors: [strategy]
 });
 logger.info('[LinkDiscovery] Self-healing succeeded with alternative selector', { strategy });

 // Store successful healing pattern
 await this.siteAdaptationService.learnFromSuccess({
 siteUrl: url,
 taskType: 'login',
 selectorsUsed: [strategy],
 executionTime: Date.now(),
 successPattern: { method: 'self-healed', selector: strategy }
 });

 break; // Success, exit retry loop
 } catch (retryError) {
 logger.warn('[LinkDiscovery] Self-healing attempt failed', { strategy, error: retryError.message });
 // Continue to next strategy
 }
 }
 }

 // If login fails because no form was detected, continue without login
 if (loginError.message.includes('Could not detect login form')) {
 logger.info('[LinkDiscovery] No login form detected, proceeding without login');
 } else {
 // For other login errors, rethrow
 throw loginError;
 }
 }
 } else {
 logger.info('[LinkDiscovery] No credentials provided, skipping login');
 }

 // Step 3: Get page info for better error messages and learning
 const pageInfo = await page.evaluate(() => {
 return {
 title: document.title || 'Untitled Page',
 url: window.location.href,
 allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
 href: a.href,
 text: a.textContent?.trim() || ''
 })).length,
 hasForms: document.querySelectorAll('form').length > 0
 };
 });

 // ✅ ADAPTIVE LEARNING: Get learned patterns for this site (or use provided ones)
 const normalizedUrl = this._normalizeUrl(url);
 let patternsToUse = learnedPatterns;

 // If patterns weren't provided, fetch them
 if (!patternsToUse || patternsToUse.length === 0) {
 patternsToUse = await this._getLearnedPatterns(normalizedUrl);
 }

 if (patternsToUse && patternsToUse.length > 0) {
 logger.info(`[LinkDiscovery] 🧠 Using ${patternsToUse.length} learned pattern(s) - these will be tried FIRST`, {
 siteUrl: normalizedUrl,
 patterns: patternsToUse.map(p => ({
 method: p.discovery_method,
 success_count: p.success_count,
 last_success: p.last_success_at
 }))
 });
 } else {
 logger.info('[LinkDiscovery] No learned patterns found - will use generic strategies');
 }

 // Step 4: Discover PDF links using adaptive multi-strategy approach
 // ✅ VISUALIZATION: Capture screenshot before link discovery
 if (runId) {
 await vizService.captureAndUpdate(page, runId, 'Searching for PDF links', '🔍 Searching for PDF links...', 45);
 }

 let discoveredLinks = [];
 let allLinksFound = 0;
 let strategyUsed = discoveryMethod;
 let selectorsUsed = [];

 // ✅ ADAPTIVE LEARNING: Try user-specified method first, then fall back to multi-strategy
 if (discoveryMethod === 'css-selector' && discoveryValue) {
 discoveredLinks = await this._discoverByCssSelector(page, discoveryValue);
 selectorsUsed = [discoveryValue];
 } else if (discoveryMethod === 'text-match' && discoveryValue) {
 discoveredLinks = await this._discoverByTextMatch(page, discoveryValue);
 } else {
 // ✅ ADAPTIVE LEARNING: Use multi-strategy approach (tries learned patterns first)
 const multiStrategyResult = await this._tryMultipleStrategies(page, normalizedUrl, patternsToUse || []);
 discoveredLinks = multiStrategyResult.pdfLinks || [];
 allLinksFound = multiStrategyResult.allLinksFound || 0;
 strategyUsed = multiStrategyResult.strategyUsed || 'auto-detect';
 }

 // ✅ VISUALIZATION: Capture screenshot after link discovery
 if (runId && discoveredLinks.length > 0) {
 await vizService.captureAndUpdate(page, runId, `Found ${discoveredLinks.length} PDF link(s)`, `✅ Found ${discoveredLinks.length} PDF link(s)!`, 55);
 }

 // If auto-detect didn't return allLinksFound, count all links on page
 if (allLinksFound === 0) {
 allLinksFound = pageInfo.allLinks;
 }

 // ✅ ADAPTIVE LEARNING: If no links found, try enhanced detection as last resort
 if (discoveredLinks.length === 0) {
 logger.info('[LinkDiscovery] No links found, trying enhanced detection as last resort...');
 const enhancedResult = await this._enhancedDetectPdfLinks(page);
 if (enhancedResult.pdfLinks && enhancedResult.pdfLinks.length > 0) {
 discoveredLinks = enhancedResult.pdfLinks;
 allLinksFound = enhancedResult.allLinksFound || allLinksFound;
 strategyUsed = 'enhanced-detect';
 logger.info(`[LinkDiscovery] Enhanced detection found ${discoveredLinks.length} links`);
 }
 }

 // ✅ SEAMLESS UX: Extract cookies for authenticated PDF downloads
 const cookies = await page.cookies();
 const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

 logger.info(`[LinkDiscovery] Found ${discoveredLinks.length} potential PDF links out of ${allLinksFound} total links`);

 // ✅ ADAPTIVE LEARNING: Learn from this discovery attempt
 if (discoveredLinks.length > 0) {
 // Success! Store the pattern for future use
 await this._learnFromSuccess(
 normalizedUrl,
 discoveredLinks,
 pageInfo,
 strategyUsed,
 selectorsUsed
 );
 } else {
 // Failure - learn what didn't work
 await this._learnFromFailure(
 normalizedUrl,
 `No PDF links found using ${strategyUsed}`,
 strategyUsed,
 pageInfo
 );
 }

 return {
 success: discoveredLinks.length > 0,
 discoveredLinks,
 method: strategyUsed, // Return actual method used (may differ from requested)
 testMode,
 // ✅ SEAMLESS UX: Include cookies for authenticated downloads
 cookies: cookies,
 cookieString: cookieString,
 // ✅ UX IMPROVEMENT: Include diagnostic info
 pageTitle: pageInfo.title,
 pageUrl: pageInfo.url,
 allLinksFound: allLinksFound,
 diagnosticInfo: {
 totalLinksOnPage: pageInfo.allLinks,
 pdfLinksFound: discoveredLinks.length,
 discoveryMethod: strategyUsed,
 hasCookies: cookies.length > 0,
 learnedPatternsUsed: (patternsToUse && patternsToUse.length > 0) || false,
 learnedPatternsCount: patternsToUse?.length || 0
 }
 };

 } catch (error) {
 logger.error('[LinkDiscovery] Discovery failed:', error);

 // ✅ ADAPTIVE LEARNING: Learn from failure
 try {
 const pageInfo = await page.evaluate(() => ({
 title: document.title || 'Untitled Page',
 url: window.location.href,
 allLinks: document.querySelectorAll('a').length,
 hasForms: document.querySelectorAll('form').length > 0
 }));
 await this._learnFromFailure(
 this._normalizeUrl(url),
 error.message,
 discoveryMethod,
 pageInfo
 );
 } catch (learnError) {
 logger.warn('[LinkDiscovery] Error learning from failure:', learnError);
 }

 throw new Error(`Link discovery failed: ${error.message}`);
 } finally {
 await browser.close();
 }
 }

 /**
 * Get page structure for adaptation learning
 */
 async _getPageStructure(page) {
 try {
 return await page.evaluate(() => {
 const forms = Array.from(document.querySelectorAll('form')).map(form => ({
 action: form.action,
 method: form.method,
 inputs: Array.from(form.querySelectorAll('input')).map(input => ({
 type: input.type,
 name: input.name,
 id: input.id,
 placeholder: input.placeholder
 }))
 }));

 const links = Array.from(document.querySelectorAll('a')).map(link => ({
 href: link.href,
 text: link.textContent.trim()
 }));

 return { forms, links, title: document.title, url: window.location.href };
 });
 } catch (error) {
 logger.error('[LinkDiscovery] Error getting page structure:', error);
 return null;
 }
 }

 /**
 * Enhanced login with robust timeout handling and adaptive selectors
 */
 async _performLogin(page, { url, username, password, adaptedSelectors = null }) {
 try {
 // ✅ INTELLIGENT ADAPTATION: Use adapted selectors if available, otherwise auto-detect
 let loginSelectors;
 if (adaptedSelectors && adaptedSelectors.length > 0) {
 // Use learned/adapted selectors
 loginSelectors = await this._mapAdaptedSelectors(page, adaptedSelectors);
 logger.info('[LinkDiscovery] Using adapted selectors for login', { selectors: Object.keys(loginSelectors) });
 } else {
 // Auto-detect login form fields (page should already be navigated)
 loginSelectors = await this._detectLoginSelectors(page);
 }

 if (!loginSelectors.username || !loginSelectors.password || !loginSelectors.submit) {
 throw new Error('Could not detect login form. Page may not require login or form structure is unusual.');
 }

 logger.info('[LinkDiscovery] Detected login form:', loginSelectors);

 // Fill credentials
 await page.waitForSelector(loginSelectors.username, { timeout: this.config.SELECTOR_TIMEOUT });
 await page.click(loginSelectors.username);
 await page.evaluate((selector) => document.querySelector(selector).value = '', loginSelectors.username);
 await page.type(loginSelectors.username, username, { delay: 50 });

 await page.waitForSelector(loginSelectors.password, { timeout: this.config.SELECTOR_TIMEOUT });
 await page.click(loginSelectors.password);
 await page.evaluate((selector) => document.querySelector(selector).value = '', loginSelectors.password);
 await page.type(loginSelectors.password, password, { delay: 50 });

 // Submit login
 await page.waitForSelector(loginSelectors.submit, { timeout: this.config.SELECTOR_TIMEOUT });
 await page.click(loginSelectors.submit);

 // Wait for login completion
 await Promise.race([
 page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.config.LOGIN_TIMEOUT }),
 page.waitForFunction(() => {
 const indicators = ['dashboard', 'account', 'profile', 'welcome', 'home'];
 return indicators.some(term =>
 document.body.textContent.toLowerCase().includes(term) ||
 document.querySelector(`[class*="${term}"], [id*="${term}"]`)
 );
 }, { timeout: this.config.LOGIN_TIMEOUT })
 ]);

 logger.info('[LinkDiscovery] Login completed successfully');

 // ✅ LEARNING: Detect if site structure changed
 const currentStructure = await this._getPageStructure(page);
 const siteChange = await this.siteAdaptationService.detectSiteChange(url, currentStructure);
 if (siteChange.changed) {
 logger.warn('[LinkDiscovery] Site structure change detected after successful login', {
 similarity: (siteChange.similarity * 100).toFixed(1) + '%',
 confidence: (siteChange.confidence * 100).toFixed(1) + '%'
 });
 }

 return true;
 } catch (error) {
 // ✅ LEARNING: Store failure for adaptation
 const pageStructure = await this._getPageStructure(page).catch(() => null);
 await this.siteAdaptationService.learnFromFailure({
 siteUrl: url,
 taskType: 'login',
 errorMessage: error.message,
 attemptedSelectors: adaptedSelectors || [],
 pageStructure
 });
 throw error;
 }
 }

 /**
 * Map adapted selectors to login form fields
 */
 async _mapAdaptedSelectors(page, adaptedSelectors) {
 try {
 const selectors = {
 username: null,
 password: null,
 submit: null
 };

 // Find username/email field
 for (const selector of adaptedSelectors) {
 if (selector.includes('email') || selector.includes('user')) {
 const element = await page.$(selector).catch(() => null);
 if (element) {
 selectors.username = selector;
 break;
 }
 }
 }

 // Find password field
 for (const selector of adaptedSelectors) {
 if (selector.includes('password')) {
 const element = await page.$(selector).catch(() => null);
 if (element) {
 selectors.password = selector;
 break;
 }
 }
 }

 // Find submit button
 for (const selector of adaptedSelectors) {
 if (selector.includes('submit') || selector.includes('button')) {
 const element = await page.$(selector).catch(() => null);
 if (element) {
 selectors.submit = selector;
 break;
 }
 }
 }

 // Fallback to auto-detect if adapted selectors don't work
 if (!selectors.username || !selectors.password || !selectors.submit) {
 logger.warn('[LinkDiscovery] Adapted selectors incomplete, falling back to auto-detect');
 return await this._detectLoginSelectors(page);
 }

 return selectors;
 } catch (error) {
 logger.error('[LinkDiscovery] Error mapping adapted selectors:', error);
 return await this._detectLoginSelectors(page); // Fallback
 }
 }

 /**
 * Auto-detect login form selectors
 */
 async _detectLoginSelectors(page) {
 return await page.evaluate(() => {
 const selectors = { username: null, password: null, submit: null };

 // Find username/email field
 const usernamePatterns = [
 'input[type="email"]',
 'input[name*="email" i]',
 'input[name*="username" i]',
 'input[name*="user" i]',
 'input[name*="login" i]',
 'input[id*="email" i]',
 'input[id*="username" i]',
 'input[id*="user" i]',
 'input[id*="login" i]',
 'input[placeholder*="email" i]',
 'input[placeholder*="username" i]'
 ];

 for (const pattern of usernamePatterns) {
 const element = document.querySelector(pattern);
 if (element && element.type !== 'password') {
 selectors.username = pattern;
 break;
 }
 }

 // Find password field
 const passwordElement = document.querySelector('input[type="password"]');
 if (passwordElement) {
 if (passwordElement.name) {
 selectors.password = `input[name="${passwordElement.name}"]`;
 } else if (passwordElement.id) {
 selectors.password = `input[id="${passwordElement.id}"]`;
 } else {
 selectors.password = 'input[type="password"]';
 }
 }

 // Find submit button - use standard CSS selectors first
 const standardSelectors = [
 'button[type="submit"]',
 'input[type="submit"]',
 '.login-button',
 '#login-button',
 '.btn-login',
 '.submit-btn'
 ];

 for (const pattern of standardSelectors) {
 const element = document.querySelector(pattern);
 if (element) {
 selectors.submit = pattern;
 break;
 }
 }

 // If no standard selector found, search by text content using JavaScript
 if (!selectors.submit) {
 // Helper function to find button by text content and return a valid CSS selector
 const findButtonByText = (textVariations) => {
 const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));

 for (const button of allButtons) {
 const buttonText = (button.textContent || button.innerText || button.value || '').trim().toLowerCase();

 for (const text of textVariations) {
 if (buttonText.includes(text.toLowerCase())) {
 // Generate a valid CSS selector for this button
 // eslint-disable-next-line no-undef
 if (button.id) {
 // eslint-disable-next-line no-undef
 return `#${CSS.escape(button.id)}`;
 } else if (button.className && typeof button.className === 'string' && button.className.trim()) {
 // Use first class name (escape special characters)
 const firstClass = button.className.trim().split(/\s+/)[0];
 // eslint-disable-next-line no-undef
 return `.${CSS.escape(firstClass)}`;
 } else if (button.name) {
 // Use name attribute if available
 // eslint-disable-next-line no-undef
 return `${button.tagName.toLowerCase()}[name="${CSS.escape(button.name)}"]`;
 } else if (button.type === 'submit') {
 // Use type attribute
 return `${button.tagName.toLowerCase()}[type="submit"]`;
 } else {
 // Last resort: use data attribute or create a unique identifier
 // Try to find a parent form and use button position
 const form = button.closest('form');
 if (form) {
 const buttonsInForm = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]'));
 const index = buttonsInForm.indexOf(button);
 if (index === 0 && buttonsInForm.length === 1) {
 // Only one button in form, use form selector
 return 'form button, form input[type="submit"]';
 }
 }
 }
 }
 }
 }
 return null;
 };

 // Try to find login-related buttons by text
 const loginButtonSelector = findButtonByText(['login', 'sign in', 'log in', 'signin']);
 if (loginButtonSelector) {
 selectors.submit = loginButtonSelector;
 }
 }

 // Fallback: find any button in a form
 if (!selectors.submit) {
 const form = document.querySelector('form');
 if (form) {
 const button = form.querySelector('button, input[type="submit"], input[type="button"]');
 if (button) {
 if (button.id) {
 selectors.submit = `#${button.id}`;
 } else if (button.className && button.className.trim()) {
 selectors.submit = `.${button.className.trim().split(/\s+/)[0]}`;
 } else if (button.type === 'submit') {
 selectors.submit = 'input[type="submit"]';
 }
 }
 }
 }

 return selectors;
 });
 }

 /**
 * CSS Selector-based link discovery
 */
 async _discoverByCssSelector(page, cssSelector) {
 try {
 logger.info(`[LinkDiscovery] Using CSS selector: ${cssSelector}`);

 // Wait for elements to be available
 await this._wait(2000);

 const links = await page.evaluate((selector) => {
 const elements = document.querySelectorAll(selector);
 const results = [];

 elements.forEach((element, index) => {
 let href = null;
 let text = element.textContent?.trim() || '';

 if (element.tagName === 'A' && element.href) {
 href = element.href;
 } else if (element.onclick || element.getAttribute('data-url')) {
 // Handle JavaScript-based links
 href = element.getAttribute('data-url') || element.onclick?.toString();
 } else {
 // Look for nested anchor
 const nestedAnchor = element.querySelector('a');
 if (nestedAnchor) {
 href = nestedAnchor.href;
 text = text || nestedAnchor.textContent?.trim();
 }
 }

 if (href) {
 results.push({
 href: href,
 text: text || `Link ${index + 1}`,
 selector: selector,
 score: 0.9,
 method: 'css-selector'
 });
 }
 });

 return results;
 }, cssSelector);

 return this._validatePdfLinks(links);

 } catch (error) {
 logger.error('[LinkDiscovery] CSS selector discovery failed:', error);
 return [];
 }
 }

 /**
 * Text-based link discovery
 */
 async _discoverByTextMatch(page, linkText) {
 try {
 logger.info(`[LinkDiscovery] Searching for links containing: "${linkText}"`);

 await this._wait(2000);

 const links = await page.evaluate((searchText) => {
 const results = [];
 const searchLower = searchText.toLowerCase();

 // Find all clickable elements
 const clickableElements = document.querySelectorAll('a, button, [onclick], [role="button"]');

 clickableElements.forEach((element, index) => {
 const text = element.textContent?.trim() || '';
 const title = element.title || '';
 const ariaLabel = element.getAttribute('aria-label') || '';

 // Check if text matches
 if (text.toLowerCase().includes(searchLower) ||
 title.toLowerCase().includes(searchLower) ||
 ariaLabel.toLowerCase().includes(searchLower)) {

 let href = null;

 if (element.tagName === 'A' && element.href) {
 href = element.href;
 } else if (element.onclick) {
 href = element.onclick.toString();
 } else if (element.getAttribute('data-url')) {
 href = element.getAttribute('data-url');
 }

 if (href) {
 results.push({
 href: href,
 text: text || `Match ${index + 1}`,
 selector: `text-match("${searchText}")`,
 score: 0.85,
 method: 'text-match'
 });
 }
 }
 });

 return results;
 }, linkText);

 return this._validatePdfLinks(links);

 } catch (error) {
 logger.error('[LinkDiscovery] Text match discovery failed:', error);
 return [];
 }
 }

 /**
 * Intelligent auto-detection of PDF download links
 * Enhanced with smarter detection patterns and multiple strategies
 */
 async _autoDetectPdfLinks(page) {
 try {
 logger.info('[LinkDiscovery] Auto-detecting PDF links with enhanced detection...');

 await this._wait(2000);

 const result = await page.evaluate(() => {
 const results = [];
 let allLinksCount = 0;

 // Count all links first
 allLinksCount = document.querySelectorAll('a').length;

 // ✅ SEAMLESS UX: Multiple detection strategies for maximum compatibility
 // Strategy 1: Direct PDF links
 const directPdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="pdf"], a[href*="PDF"]'));
 directPdfLinks.forEach(link => {
 if (link.href && !results.find(r => r.href === link.href)) {
 results.push({
 href: link.href,
 text: link.textContent?.trim() || link.title || 'PDF Link',
 selector: 'direct-pdf-link',
 score: 0.95,
 reasons: ['Direct PDF URL'],
 method: 'auto-detect'
 });
 }
 });

 // Strategy 2: Comprehensive element detection
 const allElements = document.querySelectorAll('a, button, [onclick], [role="button"], [data-url], [data-pdf], [data-download]');

 allElements.forEach((element, index) => {
 // Skip if already added as direct PDF link
 if (element.tagName === 'A' && element.href && element.href.includes('.pdf')) {
 return;
 }

 const text = (element.textContent || '').trim().toLowerCase();
 let href = element.href || element.getAttribute('data-url') || element.getAttribute('data-pdf') || '';
 const onclick = element.onclick?.toString() || element.getAttribute('onclick') || '';
 const className = (element.className || '').toString().toLowerCase();
 const id = (element.id || '').toLowerCase();
 const title = (element.title || '').toLowerCase();
 const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
 const dataAttr = element.getAttribute('data-download') || element.getAttribute('data-pdf') || '';

 let score = 0;
 let reasons = [];

 // ✅ DEMO PORTAL: Extract PDF URL from onclick handlers (e.g., downloadInvoice('001') -> /demo/invoice-001.pdf)
 if (!href && onclick) {
 // Match patterns like: downloadInvoice('001'), downloadInvoice("002"), download('invoice-001.pdf')
 const invoiceIdMatch = onclick.match(/downloadInvoice\(['"]([^'"]+)['"]\)/i) ||
 onclick.match(/download\(['"]([^'"]+)['"]\)/i) ||
 onclick.match(/['"]([^'"]*invoice[^'"]*\.pdf)['"]/i);
 if (invoiceIdMatch) {
 const invoiceId = invoiceIdMatch[1];
 // Construct PDF URL - check if it already includes .pdf or needs it
 if (invoiceId.includes('.pdf')) {
 href = window.location.origin + (invoiceId.startsWith('/') ? invoiceId : '/' + invoiceId);
 } else {
 // Assume demo portal structure: /demo/invoice-{id}.pdf
 const basePath = window.location.pathname.split('/demo')[0] || '';
 href = window.location.origin + basePath + '/demo/invoice-' + invoiceId + '.pdf';
 }
 reasons.push('Extracted from onclick handler');
 score += 0.4; // Boost score for extracted URLs
 }
 }

 // ✅ SEAMLESS UX: Enhanced URL-based scoring
 if (href.includes('.pdf') || href.includes('/pdf/') || href.includes('/download/')) {
 score += 0.5;
 reasons.push('URL pattern suggests PDF');
 }

 if (href.includes('download') || onclick.includes('download') || dataAttr.includes('download')) {
 score += 0.25;
 reasons.push('Download indicator found');
 }

 if (href.includes('invoice') || onclick.includes('invoice') || text.includes('invoice')) {
 score += 0.3;
 reasons.push('Invoice-related content');
 }

 // ✅ SEAMLESS UX: Enhanced text-based scoring with more keywords
 const pdfKeywords = ['pdf', 'download', 'invoice', 'receipt', 'bill', 'statement', 'report', 'document', 'file'];
 const downloadKeywords = ['download', 'get', 'save', 'export', 'print', 'fetch', 'retrieve'];
 const invoiceKeywords = ['invoice', 'receipt', 'bill', 'statement', 'payment'];

 pdfKeywords.forEach(keyword => {
 if (text.includes(keyword) || title.includes(keyword) || ariaLabel.includes(keyword) ||
 className.includes(keyword) || id.includes(keyword)) {
 score += 0.2;
 reasons.push(`Contains "${keyword}"`);
 }
 });

 downloadKeywords.forEach(keyword => {
 if (text.includes(keyword) || title.includes(keyword) || ariaLabel.includes(keyword)) {
 score += 0.15;
 reasons.push(`Action: ${keyword}`);
 }
 });

 invoiceKeywords.forEach(keyword => {
 if (text.includes(keyword) || title.includes(keyword) || ariaLabel.includes(keyword)) {
 score += 0.25;
 reasons.push(`Invoice-related: ${keyword}`);
 }
 });

 // ✅ SEAMLESS UX: Enhanced class/attribute-based scoring
 const downloadClasses = ['download', 'pdf', 'file', 'invoice', 'document', 'export', 'save'];
 downloadClasses.forEach(cls => {
 if (className.includes(cls) || id.includes(cls)) {
 score += 0.2;
 reasons.push('CSS class/id suggests download');
 }
 });

 // Icon-based detection (more comprehensive)
 const hasDownloadIcon = element.querySelector('[class*="download"], [class*="pdf"], [class*="file"], [class*="invoice"]') ||
 element.innerHTML.includes('⬇') || element.innerHTML.includes('📄') ||
 element.innerHTML.includes('📥') || element.innerHTML.includes('💾');
 if (hasDownloadIcon) {
 score += 0.2;
 reasons.push('Has download/file icon');
 }

 // ✅ SEAMLESS UX: Data attribute detection
 if (dataAttr) {
 score += 0.3;
 reasons.push('Has download data attribute');
 }

 // ✅ SEAMLESS UX: Lower threshold for better discovery (was 0.3, now 0.25)
 if (score >= 0.25 && (href || onclick || dataAttr)) {
 const linkText = element.textContent?.trim() || element.title || ariaLabel || 'PDF Link';
 const linkHref = href || onclick || dataAttr;

 // Avoid duplicates
 if (!results.find(r => r.href === linkHref && r.text === linkText)) {
 results.push({
 href: linkHref,
 text: linkText,
 selector: 'auto-detected',
 score: Math.min(score, 1.0),
 reasons: reasons,
 method: 'auto-detect'
 });
 }
 }
 });

 // ✅ SEAMLESS UX: Sort by confidence score (highest first)
 const sortedResults = results.sort((a, b) => b.score - a.score);

 // ✅ SEAMLESS UX: Deduplicate similar links
 const uniqueResults = [];
 const seenUrls = new Set();
 for (const link of sortedResults) {
 const normalizedUrl = link.href.split('?')[0]; // Remove query params for comparison
 if (!seenUrls.has(normalizedUrl)) {
 seenUrls.add(normalizedUrl);
 uniqueResults.push(link);
 }
 }

 return {
 pdfLinks: uniqueResults,
 allLinksFound: allLinksCount
 };
 });

 logger.info(`[LinkDiscovery] Auto-detected ${result.pdfLinks.length} potential PDF links out of ${result.allLinksFound} total links`);
 const validatedLinks = this._validatePdfLinks(result.pdfLinks);

 return {
 pdfLinks: validatedLinks,
 allLinksFound: result.allLinksFound
 };

 } catch (error) {
 logger.error('[LinkDiscovery] Auto-detection failed:', error);
 return { pdfLinks: [], allLinksFound: 0 };
 }
 }

 /**
 * Validate and filter PDF links
 */
 _validatePdfLinks(links) {
 return links.filter(link => {
 // Filter out obvious non-PDF links
 const href = link.href?.toLowerCase() || '';
 const text = link.text?.toLowerCase() || '';

 // Exclude common false positives
 const excludePatterns = [
 'javascript:void',
 'mailto:',
 'tel:',
 '#',
 'login',
 'signup',
 'register'
 ];

 const isExcluded = excludePatterns.some(pattern => href.includes(pattern));
 if (isExcluded) return false;

 // Must have either .pdf in URL or PDF-related text
 const hasPdfUrl = href.includes('.pdf');
 const hasPdfText = text.includes('pdf') || text.includes('download') || text.includes('invoice');

 return hasPdfUrl || hasPdfText;
 });
 }

 /**
 * Launch browser with optimal settings
 */
 async _launchBrowser() {
 return await puppeteer.launch({
 headless: true,
 args: [
 '--no-sandbox',
 '--disable-setuid-sandbox',
 '--disable-dev-shm-usage',
 '--disable-web-security',
 '--disable-features=VizDisplayCompositor'
 ]
 });
 }
}

module.exports = { LinkDiscoveryService };
