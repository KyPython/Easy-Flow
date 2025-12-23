/**
 * Scrape Queue Manager
 * 
 * Manages queue system for domain lists with:
 * - Concurrent scraping with rate limits
 * - Domain-specific rate limiting
 * - Priority queuing
 * - Retry logic
 * - Distributed scraping architecture support
 */

const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../utils/appConfig');

const logger = createLogger('service.scrapeQueue');

class ScrapeQueueManager {
  constructor() {
    this.queue = [];
    this.processing = new Map(); // domain -> { startTime, attempts }
    this.rateLimits = new Map(); // domain -> { lastRequest, requestCount, windowStart }
    this.domainConfigs = new Map(); // domain -> { rateLimit, priority, retries }
    
    // Configuration
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SCRAPES || '10', 10);
    this.defaultRateLimit = parseInt(process.env.DEFAULT_RATE_LIMIT || '60', 10); // requests per minute
    this.defaultRetries = parseInt(process.env.DEFAULT_SCRAPE_RETRIES || '3', 10);
    this.rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
    
    // Statistics
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalSucceeded: 0,
      averageWaitTime: 0
    };
  }

  /**
   * Add domain to queue
   */
  async enqueue(domain, options = {}) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      domain,
      priority: options.priority || 0,
      retries: options.retries || this.defaultRetries,
      attempts: 0,
      createdAt: new Date(),
      scheduledFor: options.scheduledFor || new Date(),
      config: options.config || {},
      metadata: options.metadata || {}
    };

    this.queue.push(job);
    this.queue.sort((a, b) => {
      // Sort by priority (higher first), then by scheduled time
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.scheduledFor - b.scheduledFor;
    });

    this.stats.totalQueued++;
    logger.info('Domain queued for scraping', { jobId, domain, priority: job.priority });

    // Initialize domain config if not exists
    if (!this.domainConfigs.has(domain)) {
      this.domainConfigs.set(domain, {
        rateLimit: options.rateLimit || this.defaultRateLimit,
        priority: options.priority || 0,
        retries: options.retries || this.defaultRetries
      });
    }

    return jobId;
  }

  /**
   * Add multiple domains to queue
   */
  async enqueueBatch(domains, options = {}) {
    const jobIds = [];
    for (const domain of domains) {
      const jobId = await this.enqueue(domain, options);
      jobIds.push(jobId);
    }
    return jobIds;
  }

  /**
   * Get next job from queue (respecting rate limits and concurrency)
   */
  getNextJob() {
    const now = new Date();
    
    // Filter jobs that are ready to process
    const readyJobs = this.queue.filter(job => {
      // Check if scheduled time has passed
      if (job.scheduledFor > now) {
        return false;
      }

      // Check if domain is already being processed
      if (this.processing.has(job.domain)) {
        return false;
      }

      // Check rate limit for domain
      if (!this._canProcessDomain(job.domain)) {
        return false;
      }

      return true;
    });

    if (readyJobs.length === 0) {
      return null;
    }

    // Check concurrency limit
    if (this.processing.size >= this.maxConcurrent) {
      return null;
    }

    // Get highest priority ready job
    const job = readyJobs[0];
    
    // Remove from queue
    this.queue = this.queue.filter(j => j.id !== job.id);
    
    // Mark as processing
    this.processing.set(job.domain, {
      startTime: now,
      attempts: job.attempts
    });

    // Update rate limit tracking
    this._updateRateLimit(job.domain);

    return job;
  }

  /**
   * Check if domain can be processed (rate limit check)
   */
  _canProcessDomain(domain) {
    const limit = this.domainConfigs.get(domain)?.rateLimit || this.defaultRateLimit;
    const rateLimit = this.rateLimits.get(domain);

    if (!rateLimit) {
      return true; // No previous requests
    }

    const now = Date.now();
    const windowStart = rateLimit.windowStart || now;
    const windowElapsed = now - windowStart;

    // Reset window if it's been more than the window duration
    if (windowElapsed >= this.rateLimitWindow) {
      return true; // New window, can process
    }

    // Check if under rate limit
    return rateLimit.requestCount < limit;
  }

  /**
   * Update rate limit tracking for domain
   */
  _updateRateLimit(domain) {
    const now = Date.now();
    const rateLimit = this.rateLimits.get(domain) || {
      lastRequest: 0,
      requestCount: 0,
      windowStart: now
    };

    const windowElapsed = now - rateLimit.windowStart;

    // Reset window if expired
    if (windowElapsed >= this.rateLimitWindow) {
      rateLimit.requestCount = 1;
      rateLimit.windowStart = now;
    } else {
      rateLimit.requestCount++;
    }

    rateLimit.lastRequest = now;
    this.rateLimits.set(domain, rateLimit);
  }

  /**
   * Mark job as completed
   */
  markCompleted(domain, success = true, result = null) {
    this.processing.delete(domain);
    this.stats.totalProcessed++;
    
    if (success) {
      this.stats.totalSucceeded++;
    } else {
      this.stats.totalFailed++;
    }

    logger.info('Scrape job completed', { domain, success, result: result ? 'data received' : 'no data' });
  }

  /**
   * Mark job as failed (will retry if attempts remaining)
   */
  async markFailed(domain, error, jobId = null) {
    const processing = this.processing.get(domain);
    if (!processing) {
      logger.warn('Attempted to mark unknown domain as failed', { domain });
      return;
    }

    // Find original job in queue or create retry job
    const originalJob = jobId ? this.queue.find(j => j.id === jobId) : null;
    
    if (originalJob && originalJob.attempts < originalJob.retries) {
      // Retry job
      originalJob.attempts++;
      originalJob.scheduledFor = new Date(Date.now() + (originalJob.attempts * 60000)); // Exponential backoff
      this.queue.push(originalJob);
      this.queue.sort((a, b) => b.priority - a.priority || a.scheduledFor - b.scheduledFor);
      
      logger.info('Scrape job will retry', { 
        domain, 
        attempt: originalJob.attempts, 
        maxRetries: originalJob.retries,
        nextAttempt: originalJob.scheduledFor
      });
    } else {
      // Max retries reached or no job found
      this.stats.totalFailed++;
      logger.error('Scrape job failed permanently', { 
        domain, 
        error: error.message,
        attempts: processing.attempts
      });
    }

    this.processing.delete(domain);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      maxConcurrent: this.maxConcurrent,
      domainsInQueue: new Set(this.queue.map(j => j.domain)).size,
      domainsProcessing: Array.from(this.processing.keys())
    };
  }

  /**
   * Get domain-specific statistics
   */
  getDomainStats(domain) {
    const config = this.domainConfigs.get(domain);
    const rateLimit = this.rateLimits.get(domain);
    const processing = this.processing.get(domain);

    return {
      domain,
      config: config || {},
      rateLimit: rateLimit ? {
        requestsInWindow: rateLimit.requestCount,
        windowStart: new Date(rateLimit.windowStart),
        lastRequest: new Date(rateLimit.lastRequest)
      } : null,
      isProcessing: !!processing,
      processingSince: processing ? new Date(processing.startTime) : null
    };
  }

  /**
   * Clear queue (use with caution)
   */
  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    logger.warn('Queue cleared', { removedJobs: count });
    return count;
  }

  /**
   * Update domain configuration
   */
  updateDomainConfig(domain, config) {
    const existing = this.domainConfigs.get(domain) || {};
    this.domainConfigs.set(domain, { ...existing, ...config });
    logger.info('Domain config updated', { domain, config });
  }

  /**
   * Load scrape jobs from database (for persistence)
   */
  async loadJobsFromDatabase(userId = null) {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        logger.warn('Supabase not available, cannot load jobs from database');
        return;
      }

      let query = supabase
        .from('scrape_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('next_run', new Date().toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: jobs, error } = await query;

      if (error) {
        logger.error('Failed to load scrape jobs from database', { error: error.message });
        return;
      }

      for (const job of jobs || []) {
        await this.enqueue(job.domain, {
          priority: job.priority || 0,
          retries: job.max_retries || this.defaultRetries,
          scheduledFor: new Date(job.next_run),
          config: job.config || {},
          metadata: { dbJobId: job.id }
        });
      }

      logger.info('Loaded scrape jobs from database', { count: jobs?.length || 0 });
    } catch (error) {
      logger.error('Error loading jobs from database', { error: error.message });
    }
  }
}

// Singleton instance
let queueManagerInstance = null;

function getScrapeQueueManager() {
  if (!queueManagerInstance) {
    queueManagerInstance = new ScrapeQueueManager();
  }
  return queueManagerInstance;
}

module.exports = {
  ScrapeQueueManager,
  getScrapeQueueManager
};

