// Workflow Recovery Routes
// Allows resuming failed workflows from last successful step

const express = require('express');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');
const { WorkflowExecutor } = require('../services/workflowExecutor');
const { logger } = require('../utils/logger');

const router = express.Router();

// Resume a failed workflow execution
router.post('/:executionId/resume', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { executionId } = req.params;
    const { inputData = {} } = req.body;

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get the failed execution
    const { data: failedExecution, error: fetchError } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow:workflows(*),
        step_executions(*)
      `)
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !failedExecution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (failedExecution.status !== 'failed') {
      return res.status(400).json({ 
        error: `Cannot resume execution with status: ${failedExecution.status}` 
      });
    }

    // Find last successful step
    const successfulSteps = (failedExecution.step_executions || [])
      .filter(step => step.status === 'completed')
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    if (successfulSteps.length === 0) {
      return res.status(400).json({ 
        error: 'No successful steps found to resume from' 
      });
    }

    const lastSuccessfulStep = successfulSteps[0];
    const resumeData = lastSuccessfulStep.output_data || failedExecution.output_data || {};

    // Get workflow
    const workflow = failedExecution.workflow;
    if (!workflow || workflow.status !== 'active') {
      return res.status(400).json({ 
        error: 'Workflow is not active' 
      });
    }

    // Start new execution with resume data
    const executor = new WorkflowExecutor();
    const newExecution = await executor.startExecution({
      workflowId: workflow.id,
      userId: userId,
      triggeredBy: 'resume',
      triggerData: {
        resumed_from: executionId,
        last_successful_step: lastSuccessfulStep.step_id
      },
      inputData: {
        ...resumeData,
        ...inputData,
        _resumed_from: executionId,
        _resume_note: `Resumed from failed execution ${executionId} after step: ${lastSuccessfulStep.step_id}`
      },
      resumeFromExecutionId: executionId
    });

    // Mark original execution as resumed
    await supabase
      .from('workflow_executions')
      .update({
        metadata: JSON.stringify({
          ...(failedExecution.metadata ? JSON.parse(failedExecution.metadata) : {}),
          resumed_to: newExecution.id,
          resumed_at: new Date().toISOString()
        })
      })
      .eq('id', executionId);

    res.json({
      message: 'Workflow resumed successfully',
      original_execution_id: executionId,
      new_execution_id: newExecution.id,
      resumed_from_step: lastSuccessfulStep.step_id,
      resume_data: resumeData
    });

  } catch (error) {
    logger.error('[WorkflowRecovery] Resume error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to resume workflow' 
    });
  }
});

// Get recovery options for a failed execution
router.get('/:executionId/recovery-options', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { executionId } = req.params;
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get the failed execution with step details
    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow:workflows(*),
        step_executions(*)
      `)
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (error || !execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (execution.status !== 'failed') {
      return res.json({
        can_resume: false,
        reason: `Execution status is ${execution.status}, not failed`
      });
    }

    // Find successful steps
    const successfulSteps = (execution.step_executions || [])
      .filter(step => step.status === 'completed')
      .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

    const failedSteps = (execution.step_executions || [])
      .filter(step => step.status === 'failed')
      .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

    // Get partial results from metadata
    let partialResults = [];
    if (execution.metadata) {
      try {
        const metadata = typeof execution.metadata === 'string' 
          ? JSON.parse(execution.metadata) 
          : execution.metadata;
        partialResults = metadata.partial_results || [];
      } catch (_) {}
    }

    res.json({
      can_resume: successfulSteps.length > 0,
      execution_id: executionId,
      workflow_id: execution.workflow_id,
      workflow_name: execution.workflow?.name,
      successful_steps: successfulSteps.length,
      failed_steps: failedSteps.length,
      total_steps: execution.step_executions?.length || 0,
      last_successful_step: successfulSteps.length > 0 ? {
        step_id: successfulSteps[successfulSteps.length - 1].step_id,
        step_name: successfulSteps[successfulSteps.length - 1].step_id, // Would need step name lookup
        output_data: successfulSteps[successfulSteps.length - 1].output_data
      } : null,
      first_failed_step: failedSteps.length > 0 ? {
        step_id: failedSteps[0].step_id,
        error_message: failedSteps[0].error_message
      } : null,
      partial_results: partialResults,
      error_category: execution.metadata ? (() => {
        try {
          const meta = typeof execution.metadata === 'string' 
            ? JSON.parse(execution.metadata) 
            : execution.metadata;
          return meta.error_category || null;
        } catch {
          return null;
        }
      })() : null
    });

  } catch (error) {
    logger.error('[WorkflowRecovery] Recovery options error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get recovery options' 
    });
  }
});

module.exports = router;

