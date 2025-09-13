import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';

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

  // Execute a test scenario
  const executeTestScenario = async (scenarioId) => {
    try {
      setExecuting(true);
      const scenario = testScenarios.find(s => s.id === scenarioId);
      if (!scenario) throw new Error('Test scenario not found');

      // Start test execution
      const executionStart = Date.now();
      const testResult = await runTestExecution(scenario);
      const executionTime = Date.now() - executionStart;

      // Save test result
      const { data, error } = await supabase
        .from('workflow_test_results')
        .insert({
          scenario_id: scenarioId,
          workflow_id: workflowId,
          status: testResult.success ? 'passed' : 'failed',
          execution_time: executionTime,
          step_results: testResult.stepResults,
          error_message: testResult.error,
          actual_outputs: testResult.outputs,
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

  // Mock execution engine for testing
  const runTestExecution = async (scenario) => {
    const stepResults = [];
    const outputs = {};
    let success = true;
    let error = null;

    try {
      // Simulate workflow execution with test data
      for (const step of scenario.test_steps || []) {
        const stepStart = Date.now();
        
        // Execute step with mock data
        const stepResult = await executeTestStep(step, scenario.input_data, scenario.mock_config);
        
        stepResults.push({
          stepId: step.id,
          stepType: step.type,
          status: stepResult.success ? 'passed' : 'failed',
          executionTime: Date.now() - stepStart,
          input: stepResult.input,
          output: stepResult.output,
          expectedOutput: step.expectedOutput,
          error: stepResult.error,
          assertions: stepResult.assertions
        });

        if (!stepResult.success) {
          success = false;
          error = stepResult.error;
        }

        // Collect outputs
        if (stepResult.output) {
          outputs[step.id] = stepResult.output;
        }
      }

      // Validate final outputs against expected outputs
      if (scenario.expected_outputs) {
        const validationResult = validateOutputs(outputs, scenario.expected_outputs);
        if (!validationResult.success) {
          success = false;
          error = validationResult.error;
        }
      }

      return {
        success,
        error,
        stepResults,
        outputs
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        stepResults,
        outputs
      };
    }
  };

  // Execute individual test step
  const executeTestStep = async (step, inputData, mockConfig) => {
    try {
      switch (step.type) {
        case 'api_call':
          return await executeApiCallTest(step, inputData, mockConfig);
        case 'data_transform':
          return await executeDataTransformTest(step, inputData);
        case 'condition':
          return await executeConditionTest(step, inputData);
        case 'email':
          return await executeEmailTest(step, inputData, mockConfig);
        case 'delay':
          return await executeDelayTest(step);
        default:
          return {
            success: true,
            input: inputData,
            output: inputData,
            assertions: []
          };
      }
    } catch (err) {
      return {
        success: false,
        error: err.message,
        input: inputData,
        output: null,
        assertions: []
      };
    }
  };

  // Mock API call execution
  const executeApiCallTest = async (step, inputData, mockConfig) => {
    const mockResponse = mockConfig?.apiResponses?.[step.id];
    
    if (mockResponse) {
      // Use mock response
      return {
        success: true,
        input: inputData,
        output: mockResponse,
        assertions: [
          {
            type: 'api_call',
            expected: step.expectedOutput,
            actual: mockResponse,
            passed: JSON.stringify(mockResponse) === JSON.stringify(step.expectedOutput)
          }
        ]
      };
    }

    // For testing, simulate API call without actually making it
    return {
      success: true,
      input: inputData,
      output: { status: 'mocked', data: 'test_response' },
      assertions: []
    };
  };

  // Mock data transformation execution
  const executeDataTransformTest = async (step, inputData) => {
    // Simulate data transformation
    const transformedData = { ...inputData, transformed: true, step: step.id };
    
    return {
      success: true,
      input: inputData,
      output: transformedData,
      assertions: [
        {
          type: 'data_transform',
          expected: step.expectedOutput,
          actual: transformedData,
          passed: step.expectedOutput ? 
            JSON.stringify(transformedData) === JSON.stringify(step.expectedOutput) : 
            true
        }
      ]
    };
  };

  // Mock condition execution
  const executeConditionTest = async (step, inputData) => {
    const conditionResult = evaluateCondition(step.condition, inputData);
    
    return {
      success: true,
      input: inputData,
      output: { conditionResult, path: conditionResult ? 'true' : 'false' },
      assertions: [
        {
          type: 'condition',
          expected: step.expectedOutput,
          actual: conditionResult,
          passed: step.expectedOutput ? conditionResult === step.expectedOutput : true
        }
      ]
    };
  };

  // Mock email execution
  const executeEmailTest = async (step, inputData, mockConfig) => {
    const emailSent = mockConfig?.emailConfig?.simulate !== false;
    
    return {
      success: emailSent,
      input: inputData,
      output: { 
        emailSent, 
        recipient: inputData.email || 'test@example.com',
        subject: step.subject || 'Test Email'
      },
      assertions: [
        {
          type: 'email',
          expected: 'email_sent',
          actual: emailSent ? 'email_sent' : 'email_failed',
          passed: emailSent
        }
      ]
    };
  };

  // Mock delay execution (instant for testing)
  const executeDelayTest = async (step) => {
    return {
      success: true,
      input: { delay: step.duration || '1s' },
      output: { delayed: true, duration: step.duration || '1s' },
      assertions: [
        {
          type: 'delay',
          expected: 'completed',
          actual: 'completed',
          passed: true
        }
      ]
    };
  };

  // Evaluate condition logic
  const evaluateCondition = (condition, data) => {
    if (!condition || !data) return false;
    
    // Simple condition evaluation for testing
    const { field, operator, value } = condition;
    const fieldValue = data[field];
    
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'contains':
        return String(fieldValue).includes(value);
      default:
        return false;
    }
  };

  // Validate final outputs
  const validateOutputs = (actualOutputs, expectedOutputs) => {
    try {
      for (const [key, expectedValue] of Object.entries(expectedOutputs)) {
        if (!(key in actualOutputs)) {
          return {
            success: false,
            error: `Missing expected output: ${key}`
          };
        }
        
        if (JSON.stringify(actualOutputs[key]) !== JSON.stringify(expectedValue)) {
          return {
            success: false,
            error: `Output mismatch for ${key}. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(actualOutputs[key])}`
          };
        }
      }
      
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Validation error: ${err.message}`
      };
    }
  };

  // Run all test scenarios
  const runAllTests = async () => {
    const results = [];
    
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
    deleteTestScenario
  };
};