/**
 * DLQ (Dead Letter Queue) Service
 * Provides inspection and replay capabilities for failed workflow executions
 * 
 * This service enables operators to:
 * - View all failed jobs in the DLQ
 * - Inspect failure details (error message, category, timestamps)
 * - Replay jobs intentionally
 * - Get DLQ statistics for monitoring
 */

const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');
const { WorkflowExecutionService } = require('./workflowExecutionService');

class DLQService {
  constructor() {
    this.supabase = getSupabase();
    this.executionService = new WorkflowExecutionService();
  }

  /**
   * Get all FAILED jobs (Dead Letter Queue)
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of results (default: 50)
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @param {string} options.workflowId - Filter by workflow ID
   * @param {string} options.category - Filter by error category
   * @param {string} options.userId - Filter by user ID (required)
   * @returns {Promise<Object>} - List of failed jobs
   */
  async getFailedJobs(options = {}) {
    const {
      limit = 50,
      offset = 0,
      workflowId,
      category,
      userId
    } = options;

    if (!userId) {
      throw new Error('userId is required for DLQ queries');
    }

    let query = this.supabase
      .from('workflow_executions')
      .select(`
        id,
        workflow_id,
        workflows(name),
        state,
        retry_count,
        max_retries,
        last_error,
        last_error_at,
        error_category,
        created_at,
        completed_at,
        input_data,
        worker_id,
        execution_mode,
        triggered_by,
        trigger_data
      `)
      .eq('state', 'FAILED')
      .eq('user_id', userId)
      .order('last_error_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }
    if (category) {
      query = query.eq('error_category', category);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch DLQ jobs', { error: error.message });
      throw error;
    }

    return {
      jobs: data || [],
      count: data?.length || 0,
      has_more: (data?.length || 0) >= limit
    };
  }

  /**
   * Get single failed job details with full context
   * @param {string} jobId - Job/Execution ID
   * @param {string} userId - User ID for authorization
   * @returns {Promise<Object>} - Failed job details
   */
  async getFailedJobDetails(jobId, userId) {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select(`
        *,
        workflows(*),
        step_executions(*)
      `)
      .eq('id', jobId)
      .eq('user_id', userId)
      .eq('state', 'FAILED')
      .single();

    if (error || !data) {
      throw new Error('Failed job not found');
    }

    return data;
  }

  /**
   * Replay a failed job (creates new execution from original payload)
   * @param {string} jobId - Failed job ID
   * @param {string} userId - User ID
   * @param {Object} newInputData - Optional new input data to override
   * @returns {Promise<Object>} - New execution
   */
  async replayFailedJob(jobId, userId, newInputData = {}) {
    logger.info('Replaying failed job from DLQ', { job_id: jobId, user_id: userId });

    try {
      const newExecution = await this.executionService.replayFromDLQ(
        jobId,
        userId,
        newInputData
      );

      logger.info('Successfully replayed job from DLQ', {
        original_job_id: jobId,
        new_execution_id: newExecution.id
      });

      return newExecution;
    } catch (error) {
      logger.error('Failed to replay job from DLQ', {
        job_id: jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Bulk replay multiple failed jobs
   * @param {string[]} jobIds - Array of job IDs to replay
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @param {Object} options.newInputData - Optional new input data for all jobs
   * @returns {Promise<Object>} - Bulk replay results
   */
  async bulkReplay(jobIds, userId, options = {}) {
    logger.info('Starting bulk replay from DLQ', {
      job_count: jobIds.length,
      user_id: userId
    });

    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process jobs sequentially to avoid overwhelming the system
    for (const jobId of jobIds) {
      try {
        await this.replayFailedJob(jobId, userId, options.newInputData);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          job_id: jobId,
          error: error.message
        });
      }

      // Small delay between jobs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Bulk replay completed', {
      successful: results.successful,
      failed: results.failed,
      total: jobIds.length
    });

    return results;
  }

  /**
   * Get DLQ statistics for monitoring and alerting
   * @param {string} userId - User ID for filtering
   * @param {string} workflowId - Optional workflow filter
   * @returns {Promise<Object>} - DLQ statistics
   */
  async getDLQStats(userId, workflowId = null) {
    try {
      const stats = await this.executionService.getDLQStats(userId, workflowId);

      // Get additional stats
      const { count: totalDLQ } = await this.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .eq('state', 'FAILED')
        .eq('user_id', userId);

      const { count: recentFailures } = await this.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .eq('state', 'FAILED')
        .eq('user_id', userId)
        .gte('last_error_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return {
        ...stats,
        total_dlq: totalDLQ || 0,
        recent_failures_24h: recentFailures || 0
      };
    } catch (error) {
      logger.error('Failed to get DLQ stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get list of available error categories for filtering
   * @param {string} userId - User ID
   * @returns {Promise<string[]>} - List of error categories
   */
  async getErrorCategories(userId) {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select('error_category')
      .eq('state', 'FAILED')
      .eq('user_id', userId)
      .not('error_category', 'is', null);

    if (error) {
      throw error;
    }

    // Get unique categories
    const categories = [...new Set(data.map(row => row.error_category))];
    return categories.sort();
  }

  /**
   * Archive old DLQ entries (move to cold storage conceptually)
   * Note: In production, this might export to S3/Blob storage
   * @param {string} userId - User ID
   * @param {number} olderThanDays - Archive entries older than this many days
   * @returns {Promise<Object>} - Archive results
   */
  async archiveOldEntries(userId, olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // First, export the data (in production, this would go to S3)
    const { data: oldEntries } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('state', 'FAILED')
      .eq('user_id', userId)
      .lt('created_at', cutoffDate.toISOString());

    if (!oldEntries || oldEntries.length === 0) {
      return { archived: 0, message: 'No entries to archive' };
    }

    // In production: upload to S3/blob storage
    logger.info('Archiving DLQ entries', {
      count: oldEntries.length,
      oldest_date: oldEntries[0]?.created_at,
      user_id: userId
    });

    // For now, just mark them as archived in metadata
    const archiveData = oldEntries.map(entry => ({
      ...entry,
      archived_at: new Date().toISOString(),
      metadata: {
        ...(entry.metadata ? JSON.parse(entry.metadata) : {}),
        archived: true,
        archive_date: new Date().toISOString()
      }
    }));

    // Update all entries (in production, you might delete or move)
    const { error } = await this.supabase
      .from('workflow_executions')
      .update({ metadata: JSON.stringify(archiveData[0]?.metadata) })
      .eq('state', 'FAILED')
      .eq('user_id', userId)
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw error;
    }

    return {
      archived: oldEntries.length,
      message: `Archived ${oldEntries.length} entries older than ${olderThanDays} days`
    };
  }
}

module.exports = {
  DLQService
};
