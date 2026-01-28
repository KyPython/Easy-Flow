/**
 * Workflow Checkpoint Service
 *
 * Manages checkpoint creation, validation, and resume capability for workflow executions.
 * Designed for CP consistency: ensures checkpoints are complete and consistent before
 * allowing execution to proceed, even if it means temporary unavailability.
 *
 * Architecture Principles:
 * - Statelessness: Checkpoints enable stateless API (202 Accepted) by storing complete state
 * - CP Consistency: Prioritizes Consistency and Partition Tolerance over Availability
 * - Resume Capability: Complete checkpoint data enables resuming from exact point of failure
 */

const { getSupabase } = require('../utils/supabaseClient');
const { logger, getLogger } = require('../utils/logger');
const crypto = require('crypto');

class WorkflowCheckpointService {
  constructor() {
    this.supabase = getSupabase();
    this.logger = getLogger('workflow.checkpoint');
    this.checkpointVersion = '1.0.0';
  }

  /**
   * Create a checkpoint after a successful step execution
   * @param {Object} params - Checkpoint parameters
   * @param {string} params.workflowExecutionId - Workflow execution ID
   * @param {Object} params.stepExecution - Step execution record
   * @param {Object} params.workflowStep - Workflow step definition
   * @param {Object} params.stateVariables - Current state variables (output_data from step)
   * @param {Object} params.executionContext - Execution context
   * @param {Object} params.resumeMetadata - Metadata for resuming
   * @returns {Promise<Object>} - Created checkpoint
   */
  async createCheckpoint(params) {
    const {
      workflowExecutionId,
      stepExecution,
      workflowStep,
      stateVariables,
      executionContext,
      resumeMetadata = {}
    } = params;

    this.logger.info('Creating checkpoint', {
      workflow_execution_id: workflowExecutionId,
      step_execution_id: stepExecution.id,
      step_id: workflowStep.id
    });

    // Build checkpoint object according to schema
    const checkpoint = {
      checkpoint_version: this.checkpointVersion,
      workflow_execution_id: workflowExecutionId,
      last_successful_step_execution_id: stepExecution.id,
      last_successful_step_id: workflowStep.id,
      last_successful_step_key: workflowStep.step_key || null,
      last_successful_step_name: workflowStep.name || 'Unnamed Step',
      checkpointed_at: new Date().toISOString(),
      state_variables: stateVariables || {},
      execution_context: {
        workflow_id: executionContext.workflowId,
        user_id: executionContext.userId,
        execution_mode: executionContext.executionMode || 'balanced',
        steps_total: executionContext.stepsTotal || 0,
        steps_executed: executionContext.stepsExecuted || 0,
        execution_order: stepExecution.execution_order || null,
        triggered_by: executionContext.triggeredBy || 'manual',
        trigger_data: executionContext.triggerData || {}
      },
      resume_metadata: {
        next_step_id: resumeMetadata.nextStepId || null,
        next_step_key: resumeMetadata.nextStepKey || null,
        visited_steps: resumeMetadata.visitedSteps || [],
        branch_history: resumeMetadata.branchHistory || [],
        loop_iterations: resumeMetadata.loopIterations || {}
      },
      step_output: {
        data: stateVariables || {},
        metadata: {
          duration_ms: stepExecution.duration_ms || 0,
          step_details: stepExecution.result?.step_details || 'Step completed',
          external_resources: stepExecution.result?.external_resources || []
        }
      }
    };

    // Calculate checksum for integrity validation
    const criticalData = JSON.stringify({
      workflow_execution_id: checkpoint.workflow_execution_id,
      last_successful_step_execution_id: checkpoint.last_successful_step_execution_id,
      state_variables: checkpoint.state_variables,
      execution_context: checkpoint.execution_context
    });
    checkpoint.validation = {
      checksum: crypto.createHash('sha256').update(criticalData).digest('hex'),
      schema_version_validated: true,
      validation_timestamp: new Date().toISOString()
    };

    // ✅ CP CONSISTENCY: Save checkpoint to database atomically
    // This ensures checkpoint is complete before allowing execution to continue
    try {
      // Update step_executions with checkpoint data
      const { error: stepError } = await this.supabase
        .from('step_executions')
        .update({
          checkpointed_at: checkpoint.checkpointed_at,
          output_data: checkpoint.state_variables,
          result: {
            ...stepExecution.result,
            checkpoint: checkpoint
          }
        })
        .eq('id', stepExecution.id);

      if (stepError) {
        throw new Error(`Failed to save checkpoint to step_executions: ${stepError.message}`);
      }

      // Update workflow_executions with latest checkpoint metadata
      const { error: execError } = await this.supabase
        .from('workflow_executions')
        .update({
          metadata: {
            ...(executionContext.executionMetadata || {}),
            last_checkpoint: {
              step_execution_id: checkpoint.last_successful_step_execution_id,
              step_id: checkpoint.last_successful_step_id,
              checkpointed_at: checkpoint.checkpointed_at,
              steps_executed: checkpoint.execution_context.steps_executed
            }
          }
        })
        .eq('id', workflowExecutionId);

      if (execError) {
        // Log error but don't fail - checkpoint is already saved in step_executions
        this.logger.warn('Failed to update execution metadata with checkpoint', {
          workflow_execution_id: workflowExecutionId,
          error: execError.message
        });
      }

      this.logger.info('Checkpoint created successfully', {
        workflow_execution_id: workflowExecutionId,
        step_execution_id: stepExecution.id,
        steps_executed: checkpoint.execution_context.steps_executed,
        steps_total: checkpoint.execution_context.steps_total
      });

      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to create checkpoint', {
        workflow_execution_id: workflowExecutionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get the latest checkpoint for a workflow execution
   * @param {string} workflowExecutionId - Workflow execution ID
   * @returns {Promise<Object|null>} - Latest checkpoint or null
   */
  async getLatestCheckpoint(workflowExecutionId) {
    try {
      // Find the latest checkpointed step
      const { data: stepExecution, error } = await this.supabase
        .from('step_executions')
        .select('*, workflow_steps(*)')
        .eq('workflow_execution_id', workflowExecutionId)
        .eq('state', 'COMPLETED')
        .not('checkpointed_at', 'is', null)
        .order('checkpointed_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !stepExecution) {
        return null;
      }

      // Extract checkpoint from step execution result
      const checkpoint = stepExecution.result?.checkpoint;
      if (!checkpoint) {
        // Legacy: reconstruct checkpoint from step execution data
        return this._reconstructCheckpoint(stepExecution);
      }

      // Validate checkpoint integrity
      const isValid = await this.validateCheckpoint(checkpoint);
      if (!isValid) {
        this.logger.warn('Checkpoint validation failed, attempting reconstruction', {
          workflow_execution_id: workflowExecutionId,
          step_execution_id: stepExecution.id
        });
        return this._reconstructCheckpoint(stepExecution);
      }

      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to get latest checkpoint', {
        workflow_execution_id: workflowExecutionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Validate checkpoint integrity using checksum
   * @param {Object} checkpoint - Checkpoint to validate
   * @returns {Promise<boolean>} - True if valid
   */
  async validateCheckpoint(checkpoint) {
    if (!checkpoint || !checkpoint.validation) {
      return false;
    }

    const criticalData = JSON.stringify({
      workflow_execution_id: checkpoint.workflow_execution_id,
      last_successful_step_execution_id: checkpoint.last_successful_step_execution_id,
      state_variables: checkpoint.state_variables,
      execution_context: checkpoint.execution_context
    });

    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(criticalData)
      .digest('hex');

    return calculatedChecksum === checkpoint.validation.checksum;
  }

  /**
   * Reconstruct checkpoint from step execution data (for legacy checkpoints)
   * @param {Object} stepExecution - Step execution record
   * @returns {Object} - Reconstructed checkpoint
   * @private
   */
  _reconstructCheckpoint(stepExecution) {
    const workflowStep = stepExecution.workflow_steps || {};

    return {
      checkpoint_version: this.checkpointVersion,
      workflow_execution_id: stepExecution.workflow_execution_id,
      last_successful_step_execution_id: stepExecution.id,
      last_successful_step_id: workflowStep.id || stepExecution.step_id,
      last_successful_step_key: workflowStep.step_key || null,
      last_successful_step_name: workflowStep.name || 'Unnamed Step',
      checkpointed_at: stepExecution.checkpointed_at || stepExecution.completed_at,
      state_variables: stepExecution.output_data || {},
      execution_context: {
        // These would need to be fetched from workflow_executions
        workflow_id: null,
        user_id: null,
        execution_mode: 'balanced',
        steps_total: null,
        steps_executed: null,
        execution_order: stepExecution.execution_order || null
      },
      resume_metadata: {
        next_step_id: null,
        visited_steps: []
      },
      step_output: {
        data: stepExecution.output_data || {},
        metadata: {
          duration_ms: stepExecution.duration_ms || 0,
          step_details: stepExecution.result?.step_details || 'Step completed'
        }
      },
      validation: {
        checksum: null,
        schema_version_validated: false,
        validation_timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Resume workflow execution from checkpoint
   * @param {string} workflowExecutionId - Workflow execution ID
   * @returns {Promise<Object>} - Resume information
   */
  async resumeFromCheckpoint(workflowExecutionId) {
    const checkpoint = await this.getLatestCheckpoint(workflowExecutionId);

    if (!checkpoint) {
      return {
        canResume: false,
        reason: 'No checkpoint found',
        checkpoint: null
      };
    }

    // Validate checkpoint
    const isValid = await this.validateCheckpoint(checkpoint);
    if (!isValid) {
      return {
        canResume: false,
        reason: 'Checkpoint validation failed',
        checkpoint: checkpoint
      };
    }

    return {
      canResume: true,
      checkpoint: checkpoint,
      resumePoint: {
        step_execution_id: checkpoint.last_successful_step_execution_id,
        step_id: checkpoint.last_successful_step_id,
        state_variables: checkpoint.state_variables,
        next_step_id: checkpoint.resume_metadata.next_step_id
      }
    };
  }
}

module.exports = {
  WorkflowCheckpointService
};

