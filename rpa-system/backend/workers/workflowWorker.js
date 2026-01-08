/**
 * Workflow Execution Worker
 * Processes workflow execution jobs from the queue
 */

const { getWorkflowQueue } = require('../services/workflowQueue');
const { WorkflowExecutor } = require('../services/workflowExecutor');
const { getSupabase } = require('../utils/supabaseClient');
const { STATES, WorkflowStateMachine } = require('../services/workflowStateMachine');
const { logger, getLogger } = require('../utils/logger');

class WorkflowWorker {
  constructor() {
    this.queue = getWorkflowQueue().getQueue();
    this.executor = new WorkflowExecutor(getLogger('workflow.worker'));
    this.supabase = getSupabase();
    this.isProcessing = false;
  }

  /**
   * Start the worker
   */
  start() {
    logger.info('Starting workflow execution worker...');

    // Process jobs with concurrency control
    const concurrency = parseInt(process.env.WORKFLOW_WORKER_CONCURRENCY || '5', 10);
    
    this.queue.process('*', concurrency, async (job) => {
      return await this.processWorkflowExecution(job);
    });

    logger.info('Workflow execution worker started', {
      concurrency,
      queue_name: this.queue.name
    });
  }

  /**
   * Process a workflow execution job
   * @param {Bull.Job} job - Bull job
   * @returns {Promise<Object>} - Execution result
   */
  async processWorkflowExecution(job) {
    const { executionId, workflowId, userId, inputData, triggeredBy, triggerData, executionMode } = job.data;
    
    const executionLogger = getLogger('workflow.worker.execution', {
      execution_id: executionId,
      workflow_id: workflowId,
      job_id: job.id
    });

    executionLogger.info('Processing workflow execution job', {
      execution_id: executionId,
      workflow_id: workflowId,
      user_id: userId,
      attempts: job.attemptsMade
    });

    try {
      // Update job progress
      await job.progress(10);

      // Validate execution exists and is in PENDING state
      const { data: execution, error: execError } = await this.supabase
        .from('workflow_executions')
        .select('*, workflows(*)')
        .eq('id', executionId)
        .single();

      if (execError || !execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      // Validate state transition
      if (execution.state && execution.state !== STATES.PENDING && execution.state !== STATES.RETRYING) {
        const canRetry = WorkflowStateMachine.canTransition(execution.state, STATES.RETRYING);
        if (!canRetry && execution.state !== STATES.RETRYING) {
          throw new Error(`Execution is in ${execution.state} state and cannot be processed`);
        }
      }

      // Transition to RUNNING state
      const newState = execution.state === STATES.RETRYING ? STATES.RUNNING : STATES.RUNNING;
      const transitionValidation = WorkflowStateMachine.validateTransition(execution.state || STATES.PENDING, newState);
      
      if (!transitionValidation.valid) {
        throw new Error(transitionValidation.error);
      }

      // Update execution state to RUNNING
      await this.supabase
        .from('workflow_executions')
        .update({
          state: newState,
          status: 'running', // Keep status for backward compatibility
          started_at: new Date().toISOString(),
          retry_count: execution.state === STATES.RETRYING ? (execution.retry_count || 0) + 1 : execution.retry_count || 0,
          last_retry_at: execution.state === STATES.RETRYING ? new Date().toISOString() : execution.last_retry_at
        })
        .eq('id', executionId);

      await job.progress(20);

      // Get workflow
      const workflow = execution.workflows;
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Execute workflow
      executionLogger.info('Executing workflow', {
        workflow_name: workflow.name,
        steps_count: workflow.workflow_steps?.length || 0
      });

      await job.progress(30);

      // Create execution object with updated state
      const executionObject = {
        ...execution,
        state: newState,
        status: 'running',
        started_at: new Date().toISOString()
      };

      // Execute workflow with checkpointing enabled
      const result = await this.executor.executeWorkflow(
        executionObject,
        workflow,
        {
          executionMode: executionMode || execution.execution_mode || 'balanced',
          enableCheckpointing: true, // Enable checkpointing
          job: job // Pass job for progress updates
        }
      );

      await job.progress(100);

      executionLogger.info('Workflow execution completed successfully', {
        execution_id: executionId,
        status: result.status || 'completed'
      });

      return {
        success: true,
        execution_id: executionId,
        status: result.status || 'completed'
      };
    } catch (error) {
      executionLogger.error('Workflow execution failed', {
        error: error.message,
        stack: error.stack,
        attempts: job.attemptsMade
      });

      // Check if we should retry
      const shouldRetry = job.attemptsMade < job.opts.attempts;
      
      if (shouldRetry) {
        // Update to RETRYING state
        await this.supabase
          .from('workflow_executions')
          .update({
            state: STATES.RETRYING,
            status: 'retrying',
            error_message: error.message,
            last_retry_at: new Date().toISOString()
          })
          .eq('id', executionId);

        executionLogger.info('Workflow execution will be retried', {
          execution_id: executionId,
          attempt: job.attemptsMade + 1,
          max_attempts: job.opts.attempts
        });
      } else {
        // Update to FAILED state
        await this.supabase
          .from('workflow_executions')
          .update({
            state: STATES.FAILED,
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', executionId);

        executionLogger.error('Workflow execution failed permanently', {
          execution_id: executionId,
          attempts: job.attemptsMade
        });
      }

      throw error; // Re-throw to let Bull handle retry logic
    }
  }

  /**
   * Stop the worker
   */
  async stop() {
    logger.info('Stopping workflow execution worker...');
    await this.queue.close();
    logger.info('Workflow execution worker stopped');
  }
}

module.exports = {
  WorkflowWorker
};

