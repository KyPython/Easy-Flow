import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { buildApiUrl } from '../utils/config';

export const useWorkflowExecutions = (workflowId) => {
  const [executions, setExecutions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    cancelled: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load executions for the workflow
  const loadExecutions = useCallback(async () => {
    if (!workflowId) {
      setExecutions([]);
      setStats({ total: 0, completed: 0, failed: 0, running: 0, cancelled: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('workflow_executions')
        .select(`
          id,
          execution_number,
          status,
          started_at,
          completed_at,
          duration_seconds,
          input_data,
          output_data,
          error_message,
          error_step_id,
          triggered_by,
          trigger_data,
          steps_executed,
          steps_total,
          created_at
        `)
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      setExecutions(data || []);

      // Calculate stats
      const newStats = {
        total: data?.length || 0,
        completed: data?.filter(e => e.status === 'completed').length || 0,
        failed: data?.filter(e => e.status === 'failed').length || 0,
        running: data?.filter(e => e.status === 'running').length || 0,
        cancelled: data?.filter(e => e.status === 'cancelled').length || 0
      };
      setStats(newStats);

    } catch (err) {
      console.error('Error loading executions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Get detailed execution information including step executions
  const getExecutionDetails = async (executionId) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
  const resp = await fetch(buildApiUrl(`/api/executions/${executionId}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const json = await resp.json();
          return json.execution;
        }
      }
      // Fallback to direct Supabase if REST fails
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          step_executions(
            id,
            step_id,
            execution_order,
            status,
            started_at,
            completed_at,
            duration_ms,
            input_data,
            output_data,
            result,
            error_message,
            retry_count,
            workflow_steps(
              step_key,
              name,
              step_type,
              action_type
            )
          )
        `)
        .eq('id', executionId)
        .single();
      if (execError) throw execError;
      return execution;
    } catch (err) {
      console.error('Error loading execution details:', err);
      throw err;
    }
  };

  // Start a new workflow execution
  const startExecution = async (inputData = {}) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl('/api/workflows/execute'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflowId,
          inputData,
          triggeredBy: 'manual'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start execution');
      }

      const result = await response.json();
      
      // Refresh executions to include the new one
      await loadExecutions();
      
      return result;
    } catch (err) {
      console.error('Error starting execution:', err);
      throw err;
    }
  };

  // Cancel a running execution
  const cancelExecution = async (executionId) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl(`/api/executions/${executionId}/cancel`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel execution');
      }

      // Update the execution status locally
      setExecutions(prev => 
        prev.map(execution =>
          execution.id === executionId
            ? { ...execution, status: 'cancelled' }
            : execution
        )
      );

      // Update stats
      setStats(prev => ({
        ...prev,
        running: Math.max(0, prev.running - 1),
        cancelled: prev.cancelled + 1
      }));

      return true;
    } catch (err) {
      console.error('Error cancelling execution:', err);
      throw err;
    }
  };

  // Retry a failed execution
  const retryExecution = async (executionId) => {
    try {
      // Get the original execution details
      const originalExecution = executions.find(e => e.id === executionId);
      if (!originalExecution) {
        throw new Error('Execution not found');
      }

      // Start a new execution with the same input data
      return await startExecution(originalExecution.input_data);
    } catch (err) {
      console.error('Error retrying execution:', err);
      throw err;
    }
  };

  // Get execution logs
  const getExecutionLogs = async (executionId) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
  const resp = await fetch(buildApiUrl(`/api/executions/${executionId}/steps`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const json = await resp.json();
          return json.steps || [];
        }
      }
      // Fallback to direct Supabase if REST fails
      const { data, error } = await supabase
        .from('step_executions')
        .select(`
          id,
          execution_order,
          status,
          started_at,
          completed_at,
          duration_ms,
          retry_count,
          error_message,
          result,
          workflow_steps(
            step_key,
            name,
            step_type,
            action_type
          )
        `)
        .eq('workflow_execution_id', executionId)
        .order('execution_order', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error loading execution logs:', err);
      throw err;
    }
  };

  // Export executions data
  const exportExecutions = async (format = 'json', filters = {}) => {
    try {
      let filteredExecutions = executions;

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        filteredExecutions = filteredExecutions.filter(e => e.status === filters.status);
      }

      if (filters.dateFrom) {
        filteredExecutions = filteredExecutions.filter(
          e => new Date(e.started_at) >= new Date(filters.dateFrom)
        );
      }

      if (filters.dateTo) {
        filteredExecutions = filteredExecutions.filter(
          e => new Date(e.started_at) <= new Date(filters.dateTo)
        );
      }

      if (format === 'json') {
        const dataStr = JSON.stringify(filteredExecutions, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `workflow-executions-${workflowId}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        const csvHeader = [
          'Execution Number',
          'Status',
          'Started At',
          'Completed At',
          'Duration (seconds)',
          'Steps Executed',
          'Steps Total',
          'Triggered By',
          'Error Message'
        ].join(',');

        const csvRows = filteredExecutions.map(execution => [
          execution.execution_number,
          execution.status,
          execution.started_at,
          execution.completed_at || '',
          execution.duration_seconds || '',
          execution.steps_executed || 0,
          execution.steps_total || 0,
          execution.triggered_by || '',
          execution.error_message ? `"${execution.error_message.replace(/"/g, '""')}"` : ''
        ].join(','));

        const csvContent = [csvHeader, ...csvRows].join('\n');
        const dataBlob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `workflow-executions-${workflowId}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        URL.revokeObjectURL(url);
      }

      return true;
    } catch (err) {
      console.error('Error exporting executions:', err);
      throw err;
    }
  };

  // Refresh executions
  const refreshExecutions = useCallback(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Load executions on mount or when workflowId changes
  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Set up real-time subscription for execution updates
  useEffect(() => {
    if (!workflowId) return;

    const subscription = supabase
      .channel('workflow_executions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
          filter: `workflow_id=eq.${workflowId}`
        },
        (payload) => {
          console.log('Execution change detected:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              setExecutions(prev => [payload.new, ...prev]);
              setStats(prev => ({
                ...prev,
                total: prev.total + 1,
                [payload.new.status]: (prev[payload.new.status] || 0) + 1
              }));
              break;
              
            case 'UPDATE':
              setExecutions(prev =>
                prev.map(execution =>
                  execution.id === payload.new.id ? payload.new : execution
                )
              );
              
              // Recalculate stats when status changes
              if (payload.old.status !== payload.new.status) {
                setStats(prev => ({
                  ...prev,
                  [payload.old.status]: Math.max(0, (prev[payload.old.status] || 0) - 1),
                  [payload.new.status]: (prev[payload.new.status] || 0) + 1
                }));
              }
              break;
              
            case 'DELETE':
              setExecutions(prev =>
                prev.filter(execution => execution.id !== payload.old.id)
              );
              setStats(prev => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
                [payload.old.status]: Math.max(0, (prev[payload.old.status] || 0) - 1)
              }));
              break;
              
            default:
              break;
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workflowId]);

  return {
    executions,
    stats,
    loading,
    error,
    refreshExecutions,
    getExecutionDetails,
    startExecution,
    cancelExecution,
    retryExecution,
    getExecutionLogs,
    exportExecutions,
    loadExecutions
  };
};