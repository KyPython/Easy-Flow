import { useState, useCallback } from 'react';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { usePlan } from './usePlan';

export const useWorkflowValidation = () => {
  const [validationErrors, setValidationErrors] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const { planData, canRunAutomation, canCreateWorkflow } = usePlan();

  const validateWorkflowExecution = useCallback(async (workflowId) => {
    setIsValidating(true);
    setValidationErrors([]);
    const errors = [];

    try {
      // Check plan limits first
      if (!canRunAutomation()) {
        errors.push({
          type: 'plan_limit',
          message: 'You have reached your monthly automation runs limit. Please upgrade your plan to continue.',
          action: 'upgrade'
        });
      }

      // Get workflow details and steps
      const client = await initSupabase();
      const { data: workflow, error: workflowError } = await client
        .from('workflows')
        .select(`
          *,
          workflow_steps (
            id,
            step_type,
            step_key,
            name,
            execution_order,
            is_enabled,
            config
          )
        `)
        .eq('id', workflowId)
        .single();

      if (workflowError) {
        errors.push({
          type: 'workflow_not_found',
          message: 'Workflow not found or you do not have permission to access it.'
        });
        return { isValid: false, errors };
      }

      // Check if workflow is active
      if (workflow.status === 'archived') {
        errors.push({
          type: 'workflow_archived',
          message: 'This workflow is archived and cannot be executed.'
        });
      }

      if (workflow.status === 'paused') {
        errors.push({
          type: 'workflow_paused',
          message: 'This workflow is paused. Please activate it before running.'
        });
      }

      // Check for start step
      const steps = workflow.workflow_steps || [];
      const startSteps = steps.filter(step => 
        step.step_type === 'start' || 
        step.step_type === 'trigger' ||
        step.step_key === 'start' ||
        step.execution_order === 0
      );

      if (startSteps.length === 0) {
        errors.push({
          type: 'no_start_step',
          message: 'This workflow has no start step. Please add a start step before executing.',
          action: 'edit_workflow',
          workflowId: workflowId
        });
      }

      // Check for enabled steps
      const enabledSteps = steps.filter(step => step.is_enabled !== false);
      if (enabledSteps.length === 0) {
        errors.push({
          type: 'no_enabled_steps',
          message: 'This workflow has no enabled steps. Please enable at least one step.'
        });
      }

      // Check step configurations
      for (const step of steps) {
        if (!step.is_enabled) continue;

        // Validate step configuration based on step type
        if (step.step_type === 'web_scraping' || step.step_type === 'data_extraction') {
          const config = step.config || {};
          if (!config.url && !config.target_url) {
            errors.push({
              type: 'invalid_step_config',
              message: `Step "${step.name}" is missing required URL configuration.`,
              stepId: step.id
            });
          }
        }

        if (step.step_type === 'file_operation') {
          const config = step.config || {};
          if (!config.operation_type) {
            errors.push({
              type: 'invalid_step_config',
              message: `Step "${step.name}" is missing file operation type.`,
              stepId: step.id
            });
          }
        }

        if (step.step_type === 'api_call') {
          const config = step.config || {};
          if (!config.url && !config.endpoint) {
            errors.push({
              type: 'invalid_step_config',
              message: `Step "${step.name}" is missing API endpoint configuration.`,
              stepId: step.id
            });
          }
        }
      }

      // Check workflow connections if using visual workflow builder
      if (workflow.canvas_config) {
        const canvasConfig = typeof workflow.canvas_config === 'string' 
          ? JSON.parse(workflow.canvas_config) 
          : workflow.canvas_config;

        if (canvasConfig.nodes && canvasConfig.edges) {
          const nodeIds = canvasConfig.nodes.map(node => node.id);
          const connectedNodes = new Set();
          
          canvasConfig.edges.forEach(edge => {
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
          });

          const isolatedNodes = nodeIds.filter(nodeId => !connectedNodes.has(nodeId));
          if (isolatedNodes.length > 1) { // Allow one isolated node (could be start)
            errors.push({
              type: 'isolated_steps',
              message: 'Some workflow steps are not connected. Please connect all steps.',
              action: 'edit_workflow',
              workflowId: workflowId
            });
          }
        }
      }

      setValidationErrors(errors);
      return {
        isValid: errors.length === 0,
        errors,
        workflow
      };

    } catch (error) {
      console.error('Workflow validation error:', error);
      const systemError = {
        type: 'system_error',
        message: 'Unable to validate workflow. Please try again.'
      };
      setValidationErrors([systemError]);
      return {
        isValid: false,
        errors: [systemError]
      };
    } finally {
      setIsValidating(false);
    }
  }, [canRunAutomation]);

  const validateWorkflowSave = useCallback(async (workflowData) => {
    const errors = [];

    // Check workflow creation limits first
    if (!canCreateWorkflow()) {
      errors.push({
        type: 'workflow_limit',
        message: `You've reached your workflow limit (${planData?.usage?.workflows || 0}/${planData?.limits?.workflows || 0}). Please upgrade your plan to create more workflows.`,
        action: 'upgrade'
      });
    }

    // Basic validation
    if (!workflowData.name || workflowData.name.trim().length === 0) {
      errors.push({
        type: 'missing_name',
        message: 'Workflow name is required.'
      });
    }

    if (workflowData.name && workflowData.name.length > 100) {
      errors.push({
        type: 'name_too_long',
        message: 'Workflow name must be less than 100 characters.'
      });
    }

    // Check steps
    const steps = workflowData.workflow_steps || [];
    if (steps.length === 0) {
      errors.push({
        type: 'no_steps',
        message: 'Workflow must have at least one step.'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [canCreateWorkflow, planData]);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return {
    validateWorkflowExecution,
    validateWorkflowSave,
    validationErrors,
    isValidating,
    clearValidationErrors
  };
};