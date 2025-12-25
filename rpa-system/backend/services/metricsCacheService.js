const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('service.metricsCache');

/**
 * Metrics Cache Service
 * Reads metrics from easyflow-metrics/latest_metrics.json
 * This is the source of truth for batch metrics (updated daily by morning_metrics.py)
 */
class MetricsCacheService {
  constructor() {
    // Path to the metrics file (can be overridden via env var)
    this.metricsPath = process.env.EASYFLOW_METRICS_PATH || 
      '/Users/ky/easyflow-metrics/latest_metrics.json';
    
    this.cache = null;
    this.cacheTimestamp = 0;
    this.cacheDuration = 60 * 1000; // 1 minute cache
  }

  /**
   * Load metrics from latest_metrics.json
   * Returns cached version if available and fresh, otherwise reads from file
   */
  async getMetrics() {
    try {
      const now = Date.now();
      
      // Return cached version if fresh
      if (this.cache && (now - this.cacheTimestamp) < this.cacheDuration) {
        return this.cache;
      }

      // Read from file
      const fileContent = await fs.readFile(this.metricsPath, 'utf8');
      const metrics = JSON.parse(fileContent);

      // Update cache
      this.cache = metrics;
      this.cacheTimestamp = now;

      logger.debug('Loaded metrics from file', { 
        path: this.metricsPath,
        timestamp: new Date(this.cacheTimestamp).toISOString()
      });

      return metrics;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('Metrics file not found, returning null', { 
          path: this.metricsPath,
          hint: 'Run morning_metrics.py to generate latest_metrics.json'
        });
        return null;
      }

      logger.error('Error loading metrics from file:', { 
        error: error.message,
        path: this.metricsPath
      });
      return null;
    }
  }

  /**
   * Get specific metric value
   * @param {string} path - Dot-separated path to metric (e.g., 'signups.today', 'funnel_rates.visit_to_signup')
   */
  async getMetric(path) {
    const metrics = await this.getMetrics();
    if (!metrics) return null;

    const keys = path.split('.');
    let value = metrics;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Check if metrics file exists and is readable
   */
  async isAvailable() {
    try {
      await fs.access(this.metricsPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      cached: !!this.cache,
      timestamp: this.cacheTimestamp ? new Date(this.cacheTimestamp).toISOString() : null,
      age: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      filePath: this.metricsPath
    };
  }
}

module.exports = new MetricsCacheService();

