import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

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
  const updateWorkflow = async (updates) => {
    if (!workflowId) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('workflows')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
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
  };

  // Save workflow with steps and connections
  const saveWorkflow = async (workflowData) => {
    try {
      setSaving(true);
      
      // Update main workflow
      const { data: updatedWorkflow, error: workflowError } = await supabase
        .from('workflows')
        .update({
          ...workflowData,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId)
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Update workflow steps if provided
      if (workflowData.steps) {
        // Delete existing steps
        await supabase
          .from('workflow_steps')
          .delete()
          .eq('workflow_id', workflowId);

        // Insert new steps
        if (workflowData.steps.length > 0) {
          const { error: stepsError } = await supabase
            .from('workflow_steps')
            .insert(workflowData.steps.map(step => ({
              ...step,
              workflow_id: workflowId
            })));

          if (stepsError) throw stepsError;
        }
      }

      // Update workflow connections if provided
      if (workflowData.connections) {
        // Delete existing connections
        await supabase
          .from('workflow_connections')
          .delete()
          .eq('workflow_id', workflowId);

        // Insert new connections
        if (workflowData.connections.length > 0) {
          const { error: connectionsError } = await supabase
            .from('workflow_connections')
            .insert(workflowData.connections.map(conn => ({
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
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          workflowId,
          inputData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute workflow');
      }

      const result = await response.json();
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