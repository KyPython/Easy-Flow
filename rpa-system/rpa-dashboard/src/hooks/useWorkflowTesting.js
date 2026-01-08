import { useState, useCallback } from 'react';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { api } from '../utils/api';

export const useWorkflowTesting = (workflowId) => {
 const [testScenarios, setTestScenarios] = useState([]);
 const [testResults, setTestResults] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const [executing, setExecuting] = useState(false);

 // Load test scenarios for a workflow
 const loadTestScenarios = useCallback(async () => {
 if (!workflowId) {
 return;
 }
 try {
 setLoading(true);
 const client = await initSupabase();
 const { data, error } = await client
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
 if (error) throw error;
 setTestScenarios(data || []);
 setError(null);
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 }, [workflowId]);

 // Create a new test scenario
 const createTestScenario = async (scenarioData) => {
 try {
 const client2 = await initSupabase();
 const { data: { user } } = await client2.auth.getUser();
 if (!user) throw new Error('User must be authenticated');
 const { data, error } = await client2
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
 if (error) throw error;
 // Reload scenarios
 await loadTestScenarios();
 return data;
 } catch (err) {
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
 const client3 = await initSupabase();
 const { data: { session } } = await client3.auth.getSession();
 if (!session) throw new Error('Authentication required');
 // Execute workflow using real automation endpoint
 const executionStart = Date.now();
      // ✅ PHASE 1: Use new REST endpoint
      const { data: result } = await api.post('/api/automation/executions', {
 workflow_id: workflowId,
 test_scenario_id: scenarioId,
 input_data: scenario.input_data,
 test_mode: true,
 expected_outputs: scenario.expected_outputs
 });
 const executionTime = Date.now() - executionStart;
 // Save test result to database
 const client4 = await initSupabase();
 const { data, error } = await client4
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
 throw err;
 } finally {
 setExecuting(false);
 }
 };

 // Get real execution results from backend
 const getExecutionResults = async (executionId) => {
 try {
 const client5 = await initSupabase();
 const { data: { session } } = await client5.auth.getSession();
 if (!session) throw new Error('Authentication required');
 const { data } = await api.get(`/api/executions/${executionId}`);
 return data;
 } catch (err) {
 throw err;
 }
 };

 // Execute workflow step using real automation
 const executeWorkflowStep = async (stepId, stepConfig, inputData) => {
 try {
 const client6 = await initSupabase();
 const { data: { session } } = await client6.auth.getSession();
 if (!session) throw new Error('Authentication required');
 const { data } = await api.post('/api/workflows/execute-step', {
 step_id: stepId,
 step_config: stepConfig,
 input_data: inputData,
 workflow_id: workflowId
 });
 return data;
 } catch (err) {
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
 const client7 = await initSupabase();
 const { data: { session } } = await client7.auth.getSession();
 if (!session) throw new Error('Authentication required');
 const { data } = await api.get(`/api/executions/${executionId}/steps`);
 return data;
 } catch (err) {
 throw err;
 }
 };

 // Cancel workflow execution
 const cancelWorkflowExecution = async (executionId) => {
 try {
 const client8 = await initSupabase();
 const { data: { session } } = await client8.auth.getSession();
 if (!session) throw new Error('Authentication required');
 const { data } = await api.post(`/api/executions/${executionId}/cancel`);
 return data;
 } catch (err) {
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
 const client8 = await initSupabase();
 const { error } = await client8
 .from('workflow_test_scenarios')
 .delete()
 .eq('id', scenarioId);
 if (error) throw error;
 await loadTestScenarios();
 } catch (err) {
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