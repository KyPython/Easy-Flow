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
      executionMode = 'balanced'
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
        max_retries: 3,
        retry_count: 0
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

    if (originalExecution.state !== STATES.FAILED) {
      throw new Error(`Cannot retry execution in ${originalExecution.state} state`);
    }

    // Check retry limit
    if (originalExecution.retry_count >= (originalExecution.max_retries || 3)) {
      throw new Error('Maximum retry limit reached');
    }

    // Create new execution
    return await this.createAndQueueExecution({
      workflowId: originalExecution.workflow_id,
      userId,
      inputData: originalExecution.input_data || {},
      triggeredBy: 'retry',
      triggerData: {
        retry_of: executionId,
        original_error: originalExecution.error_message
      },
      executionMode: originalExecution.execution_mode || 'balanced'
    });
  }
}

module.exports = {
  WorkflowExecutionService
};

