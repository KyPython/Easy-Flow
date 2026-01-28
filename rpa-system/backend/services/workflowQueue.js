/**
 * Workflow Execution Queue Service
 * Uses Bull.js for job queue management
 */

const Bull = require('bull');
const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');
const { STATES } = require('./workflowStateMachine');

class WorkflowQueue {
  constructor() {
    this.redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
    this.queueName = 'workflow-executions';

    // Create Bull queue
    this.queue = new Bull(this.queueName, {
      redis: {
        url: this.redisUrl,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: null
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100 // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 86400 // Keep failed jobs for 24 hours
        }
      }
    });

    // Setup event listeners
    this._setupEventListeners();

    logger.info('Workflow queue initialized', {
      queue_name: this.queueName,
      redis_url: this.redisUrl.replace(/:[^:@]+@/, ':****@') // Mask password
    });
  }

  /**
   * Setup Bull queue event listeners for monitoring
   */
  _setupEventListeners() {
    this.queue.on('completed', (job, result) => {
      logger.info('Workflow job completed', {
        job_id: job.id,
        execution_id: job.data.executionId,
        duration: Date.now() - job.timestamp
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error('Workflow job failed', {
        job_id: job.id,
        execution_id: job.data?.executionId,
        error: err.message,
        attempts: job.attemptsMade
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn('Workflow job stalled', {
        job_id: job.id,
        execution_id: job.data?.executionId
      });
    });

    this.queue.on('error', (error) => {
      logger.error('Queue error', { error: error.message });
    });
  }

  /**
   * Add workflow execution to queue
   * @param {Object} executionData - Execution data
   * @param {string} executionData.executionId - Execution ID
   * @param {string} executionData.workflowId - Workflow ID
   * @param {string} executionData.userId - User ID
   * @param {Object} executionData.inputData - Input data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} - Bull job
   */
  async enqueueExecution(executionData, options = {}) {
    const {
      executionId,
      workflowId,
      userId,
      inputData = {},
      triggeredBy = 'manual',
      triggerData = {},
      executionMode = 'balanced',
      priority = 5 // Default priority (1-10, higher is more urgent)
    } = executionData;

    const jobData = {
      executionId,
      workflowId,
      userId,
      inputData,
      triggeredBy,
      triggerData,
      executionMode
    };

    const jobOptions = {
      priority,
      jobId: `exec-${executionId}`, // Use execution ID as job ID for idempotency
      ...options
    };

    try {
      const job = await this.queue.add(jobData, jobOptions);

      logger.info('Workflow execution enqueued', {
        job_id: job.id,
        execution_id: executionId,
        workflow_id: workflowId,
        priority
      });

      // Update execution record with job ID
      const supabase = getSupabase();
      if (supabase) {
        await supabase
          .from('workflow_executions')
          .update({ job_id: job.id.toString() })
          .eq('id', executionId);
      }

      return job;
    } catch (error) {
      logger.error('Failed to enqueue workflow execution', {
        execution_id: executionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Job status
   */
  async getJobStatus(jobId) {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      return {
        status: state,
        job_id: job.id,
        data: job.data,
        progress: job.progress(),
        attempts: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        job_id: jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} - Success
   */
  async cancelJob(jobId) {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();

      logger.info('Workflow job cancelled', {
        job_id: jobId,
        execution_id: job.data?.executionId
      });

      return true;
    } catch (error) {
      logger.error('Failed to cancel job', {
        job_id: jobId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} - Queue stats
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean old jobs
   * @param {number} maxAge - Maximum age in seconds
   * @returns {Promise<number>} - Number of jobs cleaned
   */
  async cleanOldJobs(maxAge = 86400) {
    try {
      const cleaned = await this.queue.clean(maxAge, 1000, 'completed');
      const cleanedFailed = await this.queue.clean(maxAge, 1000, 'failed');

      logger.info('Cleaned old jobs', {
        completed: cleaned.length,
        failed: cleanedFailed.length
      });

      return cleaned.length + cleanedFailed.length;
    } catch (error) {
      logger.error('Failed to clean old jobs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the queue instance (for worker registration)
   * @returns {Bull.Queue}
   */
  getQueue() {
    return this.queue;
  }

  /**
   * Close queue connection
   */
  async close() {
    await this.queue.close();
    logger.info('Workflow queue closed');
  }
}

// Singleton instance
let queueInstance = null;

/**
 * Get singleton queue instance
 * @returns {WorkflowQueue}
 */
function getWorkflowQueue() {
  if (!queueInstance) {
    queueInstance = new WorkflowQueue();
  }
  return queueInstance;
}

module.exports = {
  WorkflowQueue,
  getWorkflowQueue
};

