/**
 * Proxy Management Service
 *
 * Manages rotating proxy pool with health checks, automatic rotation,
 * and cost optimization for large-scale scraping operations.
 *
 * Supports multiple proxy providers:
 * - Bright Data (Luminati)
 * - Oxylabs
 * - Smartproxy
 * - Custom proxy lists
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const { config } = require('../utils/appConfig');

const logger = createLogger('service.proxyManager');

class ProxyManager {
 constructor() {
 this.proxyPool = [];
 this.healthStatus = new Map(); // proxy -> { healthy: boolean, lastCheck: Date, failures: number }
 this.usageStats = new Map(); // proxy -> { requests: number, cost: number, lastUsed: Date }
 this.currentIndex = 0;

 // Configuration from environment
 this.provider = process.env.PROXY_PROVIDER || 'none'; // 'brightdata', 'oxylabs', 'smartproxy', 'custom', 'none'
 this.proxyConfig = this._loadProxyConfig();

 // Health check settings
 this.healthCheckInterval = parseInt(process.env.PROXY_HEALTH_CHECK_INTERVAL || '300000', 10); // 5 minutes
 this.maxFailures = parseInt(process.env.PROXY_MAX_FAILURES || '3', 10);
 this.healthCheckTimeout = parseInt(process.env.PROXY_HEALTH_CHECK_TIMEOUT || '10000', 10); // 10 seconds

 // Start health check loop if proxies are configured
 if (this.provider !== 'none' && this.proxyPool.length > 0) {
 this._startHealthCheckLoop();
 }
 }

 /**
 * Load proxy configuration from environment variables
 */
 _loadProxyConfig() {
 const config = {
 provider: this.provider,
 credentials: {},
 options: {}
 };

 switch (this.provider) {
 case 'brightdata':
 config.credentials = {
 username: process.env.BRIGHTDATA_USERNAME,
 password: process.env.BRIGHTDATA_PASSWORD,
 endpoint: process.env.BRIGHTDATA_ENDPOINT || 'zproxy.lum-superproxy.io:22225'
 };
 config.options = {
 type: process.env.BRIGHTDATA_PROXY_TYPE || 'residential', // 'residential', 'datacenter'
 country: process.env.BRIGHTDATA_COUNTRY || 'us'
 };
 break;

 case 'oxylabs':
 config.credentials = {
 username: process.env.OXYLABS_USERNAME,
 password: process.env.OXYLABS_PASSWORD,
 endpoint: process.env.OXYLABS_ENDPOINT || 'pr.oxylabs.io:7777'
 };
 config.options = {
 type: process.env.OXYLABS_PROXY_TYPE || 'residential',
 country: process.env.OXYLABS_COUNTRY || 'us'
 };
 break;

 case 'smartproxy':
 config.credentials = {
 username: process.env.SMARTPROXY_USERNAME,
 password: process.env.SMARTPROXY_PASSWORD,
 endpoint: process.env.SMARTPROXY_ENDPOINT || 'gate.smartproxy.com:7000'
 };
 config.options = {
 type: process.env.SMARTPROXY_PROXY_TYPE || 'residential',
 country: process.env.SMARTPROXY_COUNTRY || 'us'
 };
 break;

 case 'custom': {
 // Load custom proxy list from environment or file
 const customProxies = process.env.CUSTOM_PROXY_LIST;
 if (customProxies) {
 this.proxyPool = customProxies.split(',').map(proxy => {
 const [host, port, username, password] = proxy.split(':');
 return {
 host,
 port: parseInt(port, 10),
 username,
 password,
 type: 'custom',
 provider: 'custom'
 };
 });
 }
 break;
 }

 default:
 logger.info('No proxy provider configured - scraping will use direct connections');
 }

 return config;
 }

 /**
 * Initialize proxy pool based on provider
 */
 async initialize() {
 if (this.provider === 'none') {
 logger.info('Proxy management disabled - using direct connections');
 return;
 }

 try {
 switch (this.provider) {
 case 'brightdata':
 case 'oxylabs':
 case 'smartproxy':
 // For managed proxy services, we use session-based rotation
 // Each request gets a new session ID for rotation
 this.proxyPool = [{
 provider: this.provider,
 config: this.proxyConfig,
 type: this.proxyConfig.options.type,
 country: this.proxyConfig.options.country
 }];
 logger.info(`Initialized ${this.provider} proxy pool`, {
 type: this.proxyConfig.options.type,
 country: this.proxyConfig.options.country
 });
 break;

 case 'custom':
 if (this.proxyPool.length === 0) {
 throw new Error('Custom proxy list is empty');
 }
 logger.info(`Initialized custom proxy pool with ${this.proxyPool.length} proxies`);
 // Perform initial health checks
 await this._healthCheckAll();
 break;

 default:
 logger.warn(`Unknown proxy provider: ${this.provider}`);
 }
 } catch (error) {
 logger.error('Failed to initialize proxy pool', { error: error.message });
 throw error;
 }
 }

 /**
 * Get next proxy from pool (with rotation)
 */
 getNextProxy() {
 if (this.proxyPool.length === 0) {
 return null;
 }

 // For managed services (Bright Data, Oxylabs, Smartproxy), return config
 if (this.provider !== 'custom') {
 return this.proxyPool[0];
 }

 // For custom proxies, rotate through healthy ones
 const healthyProxies = this.proxyPool.filter(proxy => {
 const health = this.healthStatus.get(proxy.host);
 return !health || health.healthy !== false;
 });

 if (healthyProxies.length === 0) {
 logger.warn('No healthy proxies available, using any proxy');
 // Fallback to any proxy if all are marked unhealthy
 const proxy = this.proxyPool[this.currentIndex % this.proxyPool.length];
 this.currentIndex++;
 return proxy;
 }

 const proxy = healthyProxies[this.currentIndex % healthyProxies.length];
 this.currentIndex++;

 // Update usage stats
 this._updateUsageStats(proxy);

 return proxy;
 }

 /**
 * Get proxy configuration for HTTP client
 */
 getProxyConfig(proxy) {
 if (!proxy) {
 return null;
 }

 // Managed proxy services use session-based authentication
 if (proxy.provider && ['brightdata', 'oxylabs', 'smartproxy'].includes(proxy.provider)) {
 const { credentials, options } = proxy.config;
 const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

 return {
 protocol: 'http',
 host: credentials.endpoint.split(':')[0],
 port: parseInt(credentials.endpoint.split(':')[1], 10),
 auth: {
 username: `${credentials.username}-session-${sessionId}`,
 password: credentials.password
 },
 headers: {
 'X-Proxy-Country': options.country
 }
 };
 }

 // Custom proxy configuration
 if (proxy.host && proxy.port) {
 const config = {
 protocol: 'http',
 host: proxy.host,
 port: proxy.port
 };

 if (proxy.username && proxy.password) {
 config.auth = {
 username: proxy.username,
 password: proxy.password
 };
 }

 return config;
 }

 return null;
 }

 /**
 * Mark proxy as failed (for health tracking)
 */
 markProxyFailed(proxy) {
 if (!proxy || !proxy.host) return;

 const key = proxy.host;
 const health = this.healthStatus.get(key) || { healthy: true, failures: 0, lastCheck: new Date() };

 health.failures++;
 health.lastCheck = new Date();

 if (health.failures >= this.maxFailures) {
 health.healthy = false;
 logger.warn(`Proxy marked as unhealthy: ${key}`, { failures: health.failures });
 }

 this.healthStatus.set(key, health);
 }

 /**
 * Mark proxy as successful (for health tracking)
 */
 markProxySuccess(proxy) {
 if (!proxy || !proxy.host) return;

 const key = proxy.host;
 const health = this.healthStatus.get(key) || { healthy: true, failures: 0, lastCheck: new Date() };

 health.healthy = true;
 health.failures = 0;
 health.lastCheck = new Date();

 this.healthStatus.set(key, health);
 }

 /**
 * Health check a single proxy
 */
 async _healthCheckProxy(proxy) {
 try {
 const proxyConfig = this.getProxyConfig(proxy);
 if (!proxyConfig) return false;

 const testUrl = 'https://httpbin.org/ip';
 const response = await axios.get(testUrl, {
 proxy: proxyConfig,
 timeout: this.healthCheckTimeout,
 validateStatus: () => true // Accept any status for health check
 });

 const isHealthy = response.status === 200;
 this.markProxySuccess(proxy);
 return isHealthy;
 } catch (error) {
 this.markProxyFailed(proxy);
 return false;
 }
 }

 /**
 * Health check all proxies
 */
 async _healthCheckAll() {
 if (this.provider === 'custom' && this.proxyPool.length > 0) {
 logger.info(`Running health checks on ${this.proxyPool.length} proxies`);
 const checks = this.proxyPool.map(proxy => this._healthCheckProxy(proxy));
 await Promise.allSettled(checks);

 const healthyCount = Array.from(this.healthStatus.values()).filter(h => h.healthy !== false).length;
 logger.info(`Health check complete: ${healthyCount}/${this.proxyPool.length} proxies healthy`);
 }
 }

 /**
 * Start periodic health check loop
 */
 _startHealthCheckLoop() {
 setInterval(() => {
 this._healthCheckAll().catch(err => {
 logger.error('Health check loop error', { error: err.message });
 });
 }, this.healthCheckInterval);
 }

 /**
 * Update usage statistics
 */
 _updateUsageStats(proxy) {
 if (!proxy || !proxy.host) return;

 const key = proxy.host;
 const stats = this.usageStats.get(key) || { requests: 0, cost: 0, lastUsed: new Date() };

 stats.requests++;
 stats.lastUsed = new Date();

 // Calculate cost based on provider pricing
 // This is a placeholder - actual costs depend on provider pricing model
 if (this.provider === 'brightdata') {
 stats.cost += 0.001; // Example: $0.001 per request
 } else if (this.provider === 'oxylabs') {
 stats.cost += 0.0008; // Example: $0.0008 per request
 } else if (this.provider === 'smartproxy') {
 stats.cost += 0.0005; // Example: $0.0005 per request
 }

 this.usageStats.set(key, stats);
 }

 /**
 * Get proxy statistics
 */
 getStats() {
 const healthyCount = this.provider === 'custom'
 ? Array.from(this.healthStatus.values()).filter(h => h.healthy !== false).length
 : 1;

 const totalRequests = Array.from(this.usageStats.values())
 .reduce((sum, stats) => sum + stats.requests, 0);

 const totalCost = Array.from(this.usageStats.values())
 .reduce((sum, stats) => sum + stats.cost, 0);

 return {
 provider: this.provider,
 totalProxies: this.proxyPool.length,
 healthyProxies: healthyCount,
 totalRequests,
 totalCost: totalCost.toFixed(4),
 averageCostPerRequest: totalRequests > 0 ? (totalCost / totalRequests).toFixed(6) : 0
 };
 }

 /**
 * Reset proxy health status (for testing/recovery)
 */
 resetProxyHealth(proxyHost) {
 if (proxyHost) {
 this.healthStatus.delete(proxyHost);
 logger.info(`Reset health status for proxy: ${proxyHost}`);
 } else {
 this.healthStatus.clear();
 logger.info('Reset health status for all proxies');
 }
 }
}

// Singleton instance
let proxyManagerInstance = null;

function getProxyManager() {
 if (!proxyManagerInstance) {
 proxyManagerInstance = new ProxyManager();
 }
 return proxyManagerInstance;
}

module.exports = {
 ProxyManager,
 getProxyManager
};

