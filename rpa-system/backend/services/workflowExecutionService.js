/**
 * Workflow Execution Service
 * High-level service for workflow execution operations
 */

const { getWorkflowQueue } = require('./workflowQueue');
const { STATES, WorkflowStateMachine } = require('./workflowStateMachine');
const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');

class WorkflowExecutionService {
  constructor() {
    this.queue = getWorkflowQueue();
    this.supabase = getSupabase();
  }

  /**
   * Create and queue a workflow execution
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} - Created execution
   */
  async createAndQueueExecution(params) {
    const {
      workflowId,
      userId,
      inputData = {},
      triggeredBy = 'manual',
      triggerData = {},
      executionMode = 'balanced',
      maxRetries = 3
    } = params;

    // Create execution record in PENDING state
    const { v4: uuidv4 } = require('uuid');
    const executionId = uuidv4();

    const { data: execution, error: executionError } = await this.supabase
      .from('workflow_executions')
      .insert({
        id: executionId,
        workflow_id: workflowId,
        user_id: userId,
        state: STATES.PENDING,
        status: 'queued', // Backward compatibility
        input_data: inputData,
        triggered_by: triggeredBy,
        trigger_data: triggerData,
        execution_mode: executionMode,
        max_retries: maxRetries,
        retry_count: 0,
        // Failure memory fields initialized
        last_error: null,
        last_error_at: null,
        error_category: null
      })
      .select()
      .single();

    if (executionError) {
      logger.error('Failed to create execution', {
        workflow_id: workflowId,
        user_id: userId,
        error: executionError.message
      });
      throw new Error(`Failed to create execution: ${executionError.message}`);
    }

    // Enqueue execution job
    const priority = executionMode === 'realtime' ? 10 : 5;
    await this.queue.enqueueExecution({
      executionId,
      workflowId,
      userId,
      inputData,
      triggeredBy,
      triggerData,
      executionMode
    }, { priority });

    return execution;
  }

  /**
   * Get execution status
   * @param {string} executionId - Execution ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} - Execution status
   */
  async getExecutionStatus(executionId, userId) {
    const { data: execution, error } = await this.supabase
      .from('workflow_executions')
      .select('*, workflows(name)')
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (error || !execution) {
      return null;
    }

    // Get job status if job_id exists
    let jobStatus = null;
    if (execution.job_id) {
      try {
        jobStatus = await this.queue.getJobStatus(execution.job_id);
      } catch (jobError) {
        logger.warn('Failed to get job status', {
          execution_id: executionId,
          job_id: execution.job_id,
          error: jobError.message
        });
      }
    }

    return {
      execution,
      job_status: jobStatus,
      state: execution.state || STATES.PENDING,
      is_terminal: WorkflowStateMachine.isTerminal(execution.state || STATES.PENDING),
      is_active: WorkflowStateMachine.isActive(execution.state || STATES.PENDING)
    };
  }

  /**
   * Retry a failed execution
   * @param {string} executionId - Execution ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - New execution
   */
  async retryExecution(executionId, userId) {
    // Get original execution
    const { data: originalExecution, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (error || !originalExecution) {
      throw new Error('Execution not found');
    }

    // Support retrying from FAILED or other terminal states
    const terminalStates = ['FAILED', 'COMPLETED', 'CANCELLED'];
    if (!terminalStates.includes(originalExecution.state)) {
      throw new Error(`Cannot retry execution in ${originalExecution.state} state`);
    }

    // Check retry limit - for FAILED jobs, check retry_count against max_retries
    if (originalExecution.state === 'FAILED' && 
        (originalExecution.retry_count || 0) >= (originalExecution.max_retries || 3)) {
      throw new Error('Maximum retry limit reached - job is in DLQ. Use replay instead.');
    }

    // Create new execution with original payload
    return await this.createAndQueueExecution({
      workflowId: originalExecution.workflow_id,
      userId,
      inputData: originalExecution.input_data || {},
      triggeredBy: 'retry',
      triggerData: {
        retry_of: executionId,
        original_error: originalExecution.last_error,
        original_error_category: originalExecution.error_category
      },
      executionMode: originalExecution.execution_mode || 'balanced',
      maxRetries: originalExecution.max_retries || 3
    });
  }

  /**
   * Record a job failure using RPC function
   * Handles bounded retries and DLQ transition
   * @param {string} executionId - Execution ID
   * @param {Error} error - The error that occurred
   * @param {string} errorCategory - Error category
   * @returns {Promise<Object>} - Updated execution
   */
  async recordJobFailure(executionId, error, errorCategory) {
    try {
      // Try to use the RPC function
      const { data, error: rpcError } = await this.supabase
        .rpc('record_job_failure', {
          p_execution_id: executionId,
          p_error_message: error.message,
          p_error_category: errorCategory,
          p_max_retries: 3
        });

      if (rpcError) {
        // Fallback to direct update if RPC doesn't exist
        logger.warn('RPC function not available, using direct update', { rpcError });
        return await this._fallbackRecordFailure(executionId, error, errorCategory);
      }

      return data;
    } catch (err) {
      logger.error('Failed to record job failure', { executionId, error: err.message });
      throw err;
    }
  }

  /**
   * Fallback failure recording when RPC is not available
   */
  async _fallbackRecordFailure(executionId, error, errorCategory) {
    // Get current execution to determine retry state
    const { data: execution } = await this.supabase
      .from('workflow_executions')
      .select('retry_count, max_retries')
      .eq('id', executionId)
      .single();

    const retryCount = (execution?.retry_count || 0) + 1;
    const maxRetries = execution?.max_retries || 3;
    const isTerminal = retryCount >= maxRetries;

    const updateData = {
      last_error: error.message,
      last_error_at: new Date().toISOString(),
      error_category: errorCategory,
      retry_count: retryCount,
      updated_at: new Date().toISOString()
    };

    if (isTerminal) {
      updateData.state = 'FAILED';
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error: updateError } = await this.supabase
      .from('workflow_executions')
      .update(updateData)
      .eq('id', executionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return data;
  }

  /**
   * Replay a job from the DLQ (creates new execution)
   * @param {string} executionId - Original failed execution ID
   * @param {string} userId - User ID
   * @param {Object} newInputData - Optional new input data
   * @returns {Promise<Object>} - New execution
   */
  async replayFromDLQ(executionId, userId, newInputData = {}) {
    // Get original execution from DLQ
    const { data: failedExecution, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .eq('user_id', userId)
      .eq('state', 'FAILED')
      .single();

    if (error || !failedExecution) {
      throw new Error('DLQ entry not found');
    }

    // Create new execution with same config
    return await this.createAndQueueExecution({
      workflowId: failedExecution.workflow_id,
      userId,
      inputData: { ...failedExecution.input_data, ...newInputData },
      triggeredBy: 'dlq_replay',
      triggerData: {
        replay_of: executionId,
        original_error: failedExecution.last_error,
        original_error_category: failedExecution.error_category,
        original_failed_at: failedExecution.last_error_at
      },
      executionMode: failedExecution.execution_mode || 'balanced',
      maxRetries: failedExecution.max_retries || 3
    });
  }

  /**
   * Get DLQ statistics for monitoring
   * @param {string} userId - User ID for filtering
   * @param {string} workflowId - Optional workflow filter
   * @returns {Promise<Object>} - DLQ stats
   */
  async getDLQStats(userId, workflowId = null) {
    let query = this.supabase
      .from('workflow_executions')
      .select('error_category', { count: 'exact' })
      .eq('state', 'FAILED')
      .eq('user_id', userId);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Group by error category
    const stats = {};
    let total = 0;
    data.forEach(row => {
      const category = row.error_category || 'unknown';
      stats[category] = (stats[category] || 0) + 1;
      total++;
    });

    return {
      total_failed: total,
      by_category: stats
    };
  }
}

module.exports = {
  WorkflowExecutionService
};

