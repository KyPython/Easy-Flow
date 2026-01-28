/**
 * Anti-Bot Service
 *
 * Provides anti-bot measures for web scraping:
 * - User-agent rotation
 * - Header rotation
 * - CAPTCHA solving (2Captcha, AntiCaptcha)
 * - Cookie management
 * - Browser fingerprint randomization
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const { config } = require('../utils/appConfig');

const logger = createLogger('service.antiBot');

class AntiBotService {
 constructor() {
 // User-agent pool (realistic browser user agents)
 this.userAgents = [
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
 ];

 // CAPTCHA solver configuration
 this.captchaConfig = {
 provider: process.env.CAPTCHA_PROVIDER || 'none', // '2captcha', 'anticaptcha', 'none'
 apiKey: process.env.CAPTCHA_API_KEY || '',
 serviceUrl: this._getCaptchaServiceUrl()
 };

 // Cookie storage (domain -> cookies)
 this.cookieStore = new Map();

 // Header rotation patterns
 this.headerTemplates = this._generateHeaderTemplates();
 }

 /**
 * Get CAPTCHA service URL based on provider
 */
 _getCaptchaServiceUrl() {
 switch (this.captchaConfig.provider) {
 case '2captcha':
 return 'https://2captcha.com';
 case 'anticaptcha':
 return 'https://api.anti-captcha.com';
 default:
 return null;
 }
 }

 /**
 * Generate header templates for rotation
 */
 _generateHeaderTemplates() {
 return [
 {
 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
 'Accept-Language': 'en-US,en;q=0.9',
 'Accept-Encoding': 'gzip, deflate, br',
 'DNT': '1',
 'Connection': 'keep-alive',
 'Upgrade-Insecure-Requests': '1',
 'Sec-Fetch-Dest': 'document',
 'Sec-Fetch-Mode': 'navigate',
 'Sec-Fetch-Site': 'none'
 },
 {
 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
 'Accept-Language': 'en-US,en;q=0.5',
 'Accept-Encoding': 'gzip, deflate',
 'DNT': '1',
 'Connection': 'keep-alive',
 'Upgrade-Insecure-Requests': '1'
 },
 {
 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
 'Accept-Language': 'en-US,en;q=0.9',
 'Accept-Encoding': 'gzip, deflate, br',
 'Connection': 'keep-alive',
 'Upgrade-Insecure-Requests': '1',
 'Sec-Fetch-Dest': 'document',
 'Sec-Fetch-Mode': 'navigate',
 'Sec-Fetch-Site': 'none',
 'Cache-Control': 'max-age=0'
 }
 ];
 }

 /**
 * Get random user agent
 */
 getRandomUserAgent() {
 return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
 }

 /**
 * Get rotated headers with user agent
 */
 getRotatedHeaders(customHeaders = {}) {
 const template = this.headerTemplates[Math.floor(Math.random() * this.headerTemplates.length)];
 const userAgent = this.getRandomUserAgent();

 return {
 ...template,
 'User-Agent': userAgent,
 ...customHeaders
 };
 }

 /**
 * Get cookies for a domain
 */
 getCookies(domain) {
 return this.cookieStore.get(domain) || [];
 }

 /**
 * Set cookies for a domain
 */
 setCookies(domain, cookies) {
 if (Array.isArray(cookies)) {
 this.cookieStore.set(domain, cookies);
 } else if (typeof cookies === 'string') {
 // Parse Set-Cookie header string
 const cookieArray = cookies.split(',').map(c => c.trim());
 this.cookieStore.set(domain, cookieArray);
 }
 }

 /**
 * Clear cookies for a domain
 */
 clearCookies(domain) {
 this.cookieStore.delete(domain);
 }

 /**
 * Solve CAPTCHA using configured provider
 */
 async solveCaptcha(captchaImageUrl, captchaType = 'image') {
 if (this.captchaConfig.provider === 'none' || !this.captchaConfig.apiKey) {
 throw new Error('CAPTCHA solving not configured');
 }

 try {
 switch (this.captchaConfig.provider) {
 case '2captcha':
 return await this._solveWith2Captcha(captchaImageUrl, captchaType);
 case 'anticaptcha':
 return await this._solveWithAntiCaptcha(captchaImageUrl, captchaType);
 default:
 throw new Error(`Unsupported CAPTCHA provider: ${this.captchaConfig.provider}`);
 }
 } catch (error) {
 logger.error('CAPTCHA solving failed', { error: error.message, provider: this.captchaConfig.provider });
 throw error;
 }
 }

 /**
 * Solve CAPTCHA using 2Captcha
 */
 async _solveWith2Captcha(imageUrl, captchaType) {
 // Step 1: Submit CAPTCHA
 const submitResponse = await axios.post('https://2captcha.com/in.php', null, {
 params: {
 key: this.captchaConfig.apiKey,
 method: 'base64',
 body: imageUrl, // Base64 encoded image
 json: 1
 }
 });

 if (submitResponse.data.status !== 1) {
 throw new Error(`2Captcha submission failed: ${submitResponse.data.request}`);
 }

 const captchaId = submitResponse.data.request;
 logger.info('CAPTCHA submitted to 2Captcha', { captchaId });

 // Step 2: Poll for result (max 2 minutes)
 const maxAttempts = 120; // 2 minutes with 1 second intervals
 for (let attempt = 0; attempt < maxAttempts; attempt++) {
 await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

 const resultResponse = await axios.get('https://2captcha.com/res.php', {
 params: {
 key: this.captchaConfig.apiKey,
 action: 'get',
 id: captchaId,
 json: 1
 }
 });

 if (resultResponse.data.status === 1) {
 logger.info('CAPTCHA solved', { captchaId, solution: resultResponse.data.request });
 return resultResponse.data.request; // The solution text
 }

 if (resultResponse.data.request === 'CAPCHA_NOT_READY') {
 continue; // Still processing
 }

 throw new Error(`2Captcha solving failed: ${resultResponse.data.request}`);
 }

 throw new Error('CAPTCHA solving timeout');
 }

 /**
 * Solve CAPTCHA using AntiCaptcha
 */
 async _solveWithAntiCaptcha(imageUrl, captchaType) {
 // Step 1: Create task
 const createTaskResponse = await axios.post('https://api.anti-captcha.com/createTask', {
 clientKey: this.captchaConfig.apiKey,
 task: {
 type: 'ImageToTextTask',
 body: imageUrl, // Base64 encoded image
 case: false,
 numeric: 0
 }
 });

 if (createTaskResponse.data.errorId !== 0) {
 throw new Error(`AntiCaptcha task creation failed: ${createTaskResponse.data.errorDescription}`);
 }

 const taskId = createTaskResponse.data.taskId;
 logger.info('CAPTCHA task created with AntiCaptcha', { taskId });

 // Step 2: Poll for result (max 2 minutes)
 const maxAttempts = 120;
 for (let attempt = 0; attempt < maxAttempts; attempt++) {
 await new Promise(resolve => setTimeout(resolve, 1000));

 const resultResponse = await axios.post('https://api.anti-captcha.com/getTaskResult', {
 clientKey: this.captchaConfig.apiKey,
 taskId: taskId
 });

 if (resultResponse.data.status === 'ready') {
 logger.info('CAPTCHA solved', { taskId, solution: resultResponse.data.solution.text });
 return resultResponse.data.solution.text;
 }

 if (resultResponse.data.status === 'processing') {
 continue;
 }

 throw new Error(`AntiCaptcha solving failed: ${resultResponse.data.errorDescription || 'Unknown error'}`);
 }

 throw new Error('CAPTCHA solving timeout');
 }

 /**
 * Generate browser fingerprint randomization
 */
 getRandomizedFingerprint() {
 return {
 screenResolution: this._getRandomScreenResolution(),
 timezone: this._getRandomTimezone(),
 language: this._getRandomLanguage(),
 platform: this._getRandomPlatform(),
 plugins: this._getRandomPlugins()
 };
 }

 _getRandomScreenResolution() {
 const resolutions = [
 '1920x1080', '1366x768', '1536x864', '1440x900', '1280x720',
 '2560x1440', '3840x2160', '1600x900', '1024x768'
 ];
 return resolutions[Math.floor(Math.random() * resolutions.length)];
 }

 _getRandomTimezone() {
 const timezones = ['America/New_York', 'America/Los_Angeles', 'America/Chicago',
 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
 return timezones[Math.floor(Math.random() * timezones.length)];
 }

 _getRandomLanguage() {
 const languages = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'fr-FR', 'de-DE', 'es-ES'];
 return languages[Math.floor(Math.random() * languages.length)];
 }

 _getRandomPlatform() {
 const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
 return platforms[Math.floor(Math.random() * platforms.length)];
 }

 _getRandomPlugins() {
 const pluginSets = [
 ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client'],
 ['PDF Viewer', 'Chrome PDF Plugin'],
 ['PDF Viewer']
 ];
 return pluginSets[Math.floor(Math.random() * pluginSets.length)];
 }

 /**
 * Get complete anti-bot configuration for a request
 */
 getAntiBotConfig(domain) {
 return {
 userAgent: this.getRandomUserAgent(),
 headers: this.getRotatedHeaders(),
 cookies: this.getCookies(domain),
 fingerprint: this.getRandomizedFingerprint()
 };
 }
}

// Singleton instance
let antiBotInstance = null;

function getAntiBotService() {
 if (!antiBotInstance) {
 antiBotInstance = new AntiBotService();
 }
 return antiBotInstance;
}

module.exports = {
 AntiBotService,
 getAntiBotService
};

