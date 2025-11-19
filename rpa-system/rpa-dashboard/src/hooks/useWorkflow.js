import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { buildApiUrl } from '../utils/config';
import { api } from '../utils/api';

export const useWorkflow = (workflowId) => {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load workflow data
  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    const loadWorkflow = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('workflows')
          .select(`
            *,
            workflow_steps(*),
            workflow_connections(*),
            workflow_executions(
              id,
              status,
              started_at,
              completed_at,
              duration_seconds
            )
          `)
          .eq('id', workflowId)
          .single();

        if (error) throw error;

        setWorkflow(data);
        setError(null);
      } catch (err) {
        console.error('Error loading workflow:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [workflowId]);

  // Update workflow
  const updateWorkflow = useCallback(async (updates) => {
    if (!workflowId) return;

    try {
      setSaving(true);
      // sanitize updates to only include valid columns
      const {
        name,
        description,
        status,
        canvas_config,
        total_executions,
        successful_executions,
        failed_executions,
        last_executed_at,
        // exclude relations/unknown keys
        workflow_steps: _relSteps,
        workflow_connections: _relConns,
        workflow_executions: _relExecs,
        steps: _steps,
        connections: _connections,
        ..._rest
      } = updates || {};

      const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const payload = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(canvas_config !== undefined ? { canvas_config } : {}),
        ...(finite(total_executions) !== undefined ? { total_executions: finite(total_executions) } : {}),
        ...(finite(successful_executions) !== undefined ? { successful_executions: finite(successful_executions) } : {}),
        ...(finite(failed_executions) !== undefined ? { failed_executions: finite(failed_executions) } : {}),
        ...(last_executed_at !== undefined ? { last_executed_at } : {}),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('workflows')
        .update(payload)
        .eq('id', workflowId)
        .select()
        .single();

      if (error) throw error;

      setWorkflow(prev => ({ ...prev, ...data }));
      return data;
    } catch (err) {
      console.error('Error updating workflow:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workflowId]);

  // Save workflow with steps and connections
  const saveWorkflow = async (workflowData) => {
    try {
      setSaving(true);
      
      // Sanitize payload: only send valid columns with correct types
      const {
        name,
        description,
        status,
        canvas_config,
        total_executions,
        successful_executions,
        failed_executions,
        last_executed_at,
        // relational/aux data not sent in main update
        steps,
        connections,
        workflow_steps: _relSteps,
        workflow_connections: _relConns,
        workflow_executions: _relExecs,
        ...rest
      } = workflowData || {};

      // helper to include only finite numbers
      const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const updatePayload = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(canvas_config !== undefined ? { canvas_config } : {}),
        ...(finite(total_executions) !== undefined ? { total_executions: finite(total_executions) } : {}),
        ...(finite(successful_executions) !== undefined ? { successful_executions: finite(successful_executions) } : {}),
        ...(finite(failed_executions) !== undefined ? { failed_executions: finite(failed_executions) } : {}),
        ...(last_executed_at !== undefined ? { last_executed_at } : {}),
        updated_at: new Date().toISOString(),
      };

      // Update main workflow (exclude unknown keys like relation arrays)
      const { data: updatedWorkflow, error: workflowError } = await supabase
        .from('workflows')
        .update(updatePayload)
        .eq('id', workflowId)
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Update workflow steps if provided
      if (steps) {
        // Delete existing steps
        await supabase
          .from('workflow_steps')
          .delete()
          .eq('workflow_id', workflowId);

        // Insert new steps
        if (steps.length > 0) {
          const { error: stepsError } = await supabase
            .from('workflow_steps')
            .insert(steps.map(step => ({
              ...step,
              workflow_id: workflowId
            })));

          if (stepsError) throw stepsError;
        }
      }

      // Update workflow connections if provided
      if (connections) {
        // Delete existing connections
        await supabase
          .from('workflow_connections')
          .delete()
          .eq('workflow_id', workflowId);

        // Insert new connections
        if (connections.length > 0) {
          const { error: connectionsError } = await supabase
            .from('workflow_connections')
            .insert(connections.map(conn => ({
              ...conn,
              workflow_id: workflowId
            })));

          if (connectionsError) throw connectionsError;
        }
      }

      // Reload the complete workflow
      const { data: reloadedWorkflow, error: reloadError } = await supabase
        .from('workflows')
        .select(`
          *,
          workflow_steps(*),
          workflow_connections(*),
          workflow_executions(
            id,
            status,
            started_at,
            completed_at,
            duration_seconds
          )
        `)
        .eq('id', workflowId)
        .single();

      if (reloadError) throw reloadError;

      setWorkflow(reloadedWorkflow);
      return reloadedWorkflow;
    } catch (err) {
      console.error('Error saving workflow:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Create new workflow
  const createWorkflow = async (workflowData) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          ...workflowData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setWorkflow(data);
      return data;
    } catch (err) {
      console.error('Error creating workflow:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Delete workflow
  const deleteWorkflow = async () => {
    if (!workflowId) return;

    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId);

      if (error) throw error;

      setWorkflow(null);
      return true;
    } catch (err) {
      console.error('Error deleting workflow:', err);
      throw err;
    }
  };

  // Execute workflow
  const executeWorkflow = async (inputData = {}) => {
    if (!workflowId) return;

    try {
      const { data: result } = await api.post(buildApiUrl('/api/workflows/execute'), {
        workflowId,
        inputData
      });
      return result;
    } catch (err) {
      console.error('Error executing workflow:', err);
      throw err;
    }
  };

  // Get workflow executions
  const getExecutions = async (limit = 50, offset = 0) => {
    if (!workflowId) return [];

    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          step_executions(*)
        `)
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error loading executions:', err);
      throw err;
    }
  };

  // Duplicate workflow
  const duplicateWorkflow = async (newName) => {
    if (!workflow) return;

    try {
      setSaving(true);
      
      // Create new workflow
      const { data: newWorkflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          ...workflow,
          id: undefined,
          name: newName || `${workflow.name} (Copy)`,
          status: 'draft',
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          last_executed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Duplicate steps
      if (workflow.workflow_steps?.length > 0) {
        const { error: stepsError } = await supabase
          .from('workflow_steps')
          .insert(workflow.workflow_steps.map(step => ({
            ...step,
            id: undefined,
            workflow_id: newWorkflow.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })));

        if (stepsError) throw stepsError;
      }

      // Duplicate connections
      if (workflow.workflow_connections?.length > 0) {
        const { error: connectionsError } = await supabase
          .from('workflow_connections')
          .insert(workflow.workflow_connections.map(conn => ({
            ...conn,
            id: undefined,
            workflow_id: newWorkflow.id,
            created_at: new Date().toISOString()
          })));

        if (connectionsError) throw connectionsError;
      }

      return newWorkflow;
    } catch (err) {
      console.error('Error duplicating workflow:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    workflow,
    loading,
    error,
    saving,
    updateWorkflow,
    saveWorkflow,
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    getExecutions,
    duplicateWorkflow
  };
};