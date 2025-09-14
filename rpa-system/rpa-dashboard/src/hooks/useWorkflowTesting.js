import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

export const useWorkflowTesting = (workflowId) => {
  const [testScenarios, setTestScenarios] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);

  // Load test scenarios for a workflow
  const loadTestScenarios = useCallback(async () => {
    console.log('loadTestScenarios called with workflowId:', workflowId);
    if (!workflowId) {
      console.log('No workflowId provided, skipping load');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Querying workflow_test_scenarios table...');
      const { data, error } = await supabase
        .from('workflow_test_scenarios')
        .select(`
          *,
          workflow_test_results(
            id,
            status,
            execution_time,
            created_at,
            error_message,
            step_results,
            actual_outputs
          )
        `)
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: false });

      console.log('Query result:', { data, error });
      if (error) throw error;
      setTestScenarios(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading test scenarios:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Create a new test scenario
  const createTestScenario = async (scenarioData) => {
    try {
      console.log('createTestScenario called with:', scenarioData);
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      if (!user) throw new Error('User must be authenticated');

      console.log('Inserting test scenario...');
      const { data, error } = await supabase
        .from('workflow_test_scenarios')
        .insert({
          workflow_id: workflowId,
          user_id: user.id,
          name: scenarioData.name,
          description: scenarioData.description,
          input_data: scenarioData.inputData,
          expected_outputs: scenarioData.expectedOutputs,
          test_steps: scenarioData.testSteps,
          mock_config: scenarioData.mockConfig,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      console.log('Insert result:', { data, error });
      if (error) throw error;
      
      // Reload scenarios
      console.log('Reloading test scenarios...');
      await loadTestScenarios();
      return data;
    } catch (err) {
      console.error('Error creating test scenario:', err);
      throw err;
    }
  };

  // Execute a test scenario using real automation endpoints
  const executeTestScenario = async (scenarioId) => {
    try {
      setExecuting(true);
      const scenario = testScenarios.find(s => s.id === scenarioId);
      if (!scenario) throw new Error('Test scenario not found');

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      // Execute workflow using real automation endpoint
      const executionStart = Date.now();
      const response = await fetch('/api/automation/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          test_scenario_id: scenarioId,
          input_data: scenario.input_data,
          test_mode: true,
          expected_outputs: scenario.expected_outputs
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - executionStart;

      // Save test result to database
      const { data, error } = await supabase
        .from('workflow_test_results')
        .insert({
          scenario_id: scenarioId,
          workflow_id: workflowId,
          status: result.success ? 'passed' : 'failed',
          execution_time: executionTime,
          step_results: result.step_results || [],
          error_message: result.error,
          actual_outputs: result.outputs || {},
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Reload scenarios to get updated results
      await loadTestScenarios();
      return data;
    } catch (err) {
      console.error('Error executing test scenario:', err);
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  // Get real execution results from backend
  const getExecutionResults = async (executionId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch(`/api/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get execution results: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error getting execution results:', err);
      throw err;
    }
  };

  // Execute workflow step using real automation
  const executeWorkflowStep = async (stepId, stepConfig, inputData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch('/api/workflows/execute-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          step_id: stepId,
          step_config: stepConfig,
          input_data: inputData,
          workflow_id: workflowId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error executing workflow step:', err);
      return {
        success: false,
        error: err.message,
        input: inputData,
        output: null
      };
    }
  };

  // Get workflow execution status
  const getWorkflowExecutionStatus = async (executionId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch(`/api/executions/${executionId}/steps`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get execution status: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error getting workflow execution status:', err);
      throw err;
    }
  };

  // Cancel workflow execution
  const cancelWorkflowExecution = async (executionId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch(`/api/executions/${executionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel execution: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error canceling workflow execution:', err);
      throw err;
    }
  };

  // Run all test scenarios using real automation
  const runAllTests = async () => {
    const results = [];
    setExecuting(true);
    
    try {
      for (const scenario of testScenarios) {
        try {
          const result = await executeTestScenario(scenario.id);
          results.push(result);
        } catch (err) {
          results.push({
            scenario_id: scenario.id,
            status: 'failed',
            error: err.message
          });
        }
      }
      
      return results;
    } finally {
      setExecuting(false);
    }
  };

  // Delete test scenario
  const deleteTestScenario = async (scenarioId) => {
    try {
      const { error } = await supabase
        .from('workflow_test_scenarios')
        .delete()
        .eq('id', scenarioId);

      if (error) throw error;
      
      await loadTestScenarios();
    } catch (err) {
      console.error('Error deleting test scenario:', err);
      throw err;
    }
  };

  return {
    testScenarios,
    testResults,
    loading,
    error,
    executing,
    loadTestScenarios,
    createTestScenario,
    executeTestScenario,
    runAllTests,
    deleteTestScenario,
    getExecutionResults,
    getWorkflowExecutionStatus,
    cancelWorkflowExecution,
    executeWorkflowStep
  };
};