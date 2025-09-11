const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

class WorkflowExecutor {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
  }

  async startExecution(config) {
    const { workflowId, userId, triggeredBy = 'manual', triggerData = {}, inputData = {} } = config;
    
    try {
      console.log(`[WorkflowExecutor] Starting execution for workflow ${workflowId}`);
      
      // Get workflow definition
      const { data: workflow, error: workflowError } = await this.supabase
        .from('workflows')
        .select(`
          *,
          workflow_steps(*),
          workflow_connections(*)
        `)
        .eq('id', workflowId)
        .single();
        
      if (workflowError || !workflow) {
        throw new Error(`Workflow not found: ${workflowError?.message}`);
      }
      
      if (workflow.status !== 'active') {
        throw new Error(`Workflow is not active (status: ${workflow.status})`);
      }
      
      // Create workflow execution record
      const { data: execution, error: executionError } = await this.supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          user_id: userId,
          status: 'running',
          started_at: new Date().toISOString(),
          input_data: inputData,
          triggered_by: triggeredBy,
          trigger_data: triggerData,
          steps_total: workflow.workflow_steps.length
        })
        .select()
        .single();
        
      if (executionError) {
        throw new Error(`Failed to create execution: ${executionError.message}`);
      }
      
      console.log(`[WorkflowExecutor] Created execution ${execution.id}`);
      
      // Start execution asynchronously
      this.executeWorkflow(execution, workflow).catch(error => {
        console.error(`[WorkflowExecutor] Execution ${execution.id} failed:`, error);
        this.failExecution(execution.id, error.message);
      });
      
      return execution;
      
    } catch (error) {
      console.error('[WorkflowExecutor] Failed to start execution:', error);
      throw error;
    }
  }

  async executeWorkflow(execution, workflow) {
    const startTime = Date.now();
    let currentData = execution.input_data || {};
    let stepsExecuted = 0;
    
    try {
      console.log(`[WorkflowExecutor] Executing workflow ${workflow.name} (${execution.id})`);
      
      // Find the start step
      const startStep = workflow.workflow_steps.find(step => step.step_type === 'start');
      if (!startStep) {
        throw new Error('No start step found in workflow');
      }
      
      // Execute workflow steps
      const result = await this.executeStep(execution, startStep, currentData, workflow);
      
      if (result.success) {
        await this.completeExecution(execution.id, result.data, stepsExecuted, startTime);
      } else {
        await this.failExecution(execution.id, result.error, result.errorStepId);
      }
      
    } catch (error) {
      console.error(`[WorkflowExecutor] Workflow execution failed:`, error);
      await this.failExecution(execution.id, error.message);
    }
  }

  async executeStep(execution, step, inputData, workflow, visitedSteps = new Set()) {
    try {
      // Prevent infinite loops
      if (visitedSteps.has(step.id)) {
        throw new Error(`Circular dependency detected at step: ${step.name}`);
      }
      visitedSteps.add(step.id);
      
      console.log(`[WorkflowExecutor] Executing step: ${step.name} (${step.step_type})`);
      
      // Create step execution record
      const stepExecution = await this.createStepExecution(execution.id, step.id, inputData);
      
      let result = { success: true, data: inputData };
      
      // Execute based on step type
      switch (step.step_type) {
        case 'start':
          result = await this.executeStartStep(step, inputData);
          break;
        case 'action':
          result = await this.executeActionStep(step, inputData);
          break;
        case 'condition':
          result = await this.executeConditionStep(step, inputData);
          break;
        case 'end':
          result = await this.executeEndStep(step, inputData);
          break;
        default:
          throw new Error(`Unknown step type: ${step.step_type}`);
      }
      
      // Update step execution
      await this.updateStepExecution(stepExecution.id, result);
      
      if (!result.success) {
        return { success: false, error: result.error, errorStepId: step.id };
      }
      
      // Handle end step
      if (step.step_type === 'end') {
        return { success: true, data: result.data };
      }
      
      // Find next step(s)
      const nextSteps = await this.getNextSteps(step, result.data, workflow);
      
      if (nextSteps.length === 0) {
        // No more steps, workflow complete
        return { success: true, data: result.data };
      }
      
      // Execute next step(s)
      // For now, we only handle sequential execution (single next step)
      const nextStep = nextSteps[0];
      return await this.executeStep(execution, nextStep, result.data, workflow, visitedSteps);
      
    } catch (error) {
      console.error(`[WorkflowExecutor] Step execution failed: ${step.name}`, error);
      return { success: false, error: error.message, errorStepId: step.id };
    }
  }

  async executeStartStep(step, inputData) {
    // Start step just passes data through
    return { success: true, data: inputData };
  }

  async executeActionStep(step, inputData) {
    try {
      const { action_type, config } = step;
      
      // Get action definition
      const { data: actionDef, error } = await this.supabase
        .from('action_definitions')
        .select('*')
        .eq('action_type', action_type)
        .single();
        
      if (error || !actionDef) {
        throw new Error(`Action definition not found: ${action_type}`);
      }
      
      // Execute based on action type
      switch (action_type) {
        case 'web_scrape':
          return await this.executeWebScrapeAction(config, inputData);
        case 'api_call':
          return await this.executeApiCallAction(config, inputData);
        case 'data_transform':
          return await this.executeDataTransformAction(config, inputData);
        case 'file_upload':
          return await this.executeFileUploadAction(config, inputData);
        case 'email':
          return await this.executeEmailAction(config, inputData);
        case 'delay':
          return await this.executeDelayAction(config, inputData);
        default:
          throw new Error(`Unsupported action type: ${action_type}`);
      }
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeConditionStep(step, inputData) {
    try {
      const { conditions } = step;
      
      // Simple condition evaluation
      // In production, you'd want a more robust expression evaluator
      for (const condition of conditions) {
        const { field, operator, value } = condition;
        const fieldValue = this.getNestedValue(inputData, field);
        
        let conditionMet = false;
        switch (operator) {
          case 'equals':
            conditionMet = fieldValue === value;
            break;
          case 'not_equals':
            conditionMet = fieldValue !== value;
            break;
          case 'greater_than':
            conditionMet = fieldValue > value;
            break;
          case 'less_than':
            conditionMet = fieldValue < value;
            break;
          case 'contains':
            conditionMet = String(fieldValue).includes(value);
            break;
          case 'exists':
            conditionMet = fieldValue !== undefined && fieldValue !== null;
            break;
          default:
            throw new Error(`Unsupported condition operator: ${operator}`);
        }
        
        if (conditionMet) {
          return { success: true, data: inputData, conditionResult: true, matchedCondition: condition };
        }
      }
      
      return { success: true, data: inputData, conditionResult: false };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeEndStep(step, inputData) {
    const { config } = step;
    const success = config.success !== false;
    const message = config.message || (success ? 'Workflow completed successfully' : 'Workflow ended with error');
    
    return { 
      success, 
      data: { 
        ...inputData, 
        workflowResult: { success, message }
      }
    };
  }

  // Action implementations
  async executeWebScrapeAction(config, inputData) {
    try {
      // This is a placeholder - integrate with your existing scraping service
      const { url, selectors, timeout = 30 } = config;
      
      console.log(`[WorkflowExecutor] Web scraping: ${url}`);
      
      // Call your existing automation service
      const axios = require('axios');
      const response = await axios.post(`${process.env.AUTOMATION_SERVICE_URL}/scrape`, {
        url,
        selectors,
        timeout
      }, {
        timeout: timeout * 1000
      });
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          scraped_data: response.data 
        }
      };
      
    } catch (error) {
      return { success: false, error: `Web scraping failed: ${error.message}` };
    }
  }

  async executeApiCallAction(config, inputData) {
    try {
      const { method, url, headers = {}, body, timeout = 30 } = config;
      
      console.log(`[WorkflowExecutor] API call: ${method} ${url}`);
      
      const axios = require('axios');
      const response = await axios({
        method,
        url,
        headers,
        data: body,
        timeout: timeout * 1000
      });
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          api_response: response.data,
          api_status: response.status 
        }
      };
      
    } catch (error) {
      return { success: false, error: `API call failed: ${error.message}` };
    }
  }

  async executeDataTransformAction(config, inputData) {
    try {
      const { transformations, output_format = 'json' } = config;
      
      let transformedData = inputData;
      
      // Apply transformations
      for (const transform of transformations) {
        const { type, source_field, target_field, operation } = transform;
        
        switch (type) {
          case 'map':
            transformedData[target_field] = this.getNestedValue(transformedData, source_field);
            break;
          case 'filter':
            if (Array.isArray(transformedData[source_field])) {
              transformedData[target_field] = transformedData[source_field].filter(item => 
                this.evaluateFilterCondition(item, operation)
              );
            }
            break;
          case 'aggregate':
            if (Array.isArray(transformedData[source_field])) {
              transformedData[target_field] = this.performAggregation(
                transformedData[source_field], 
                operation
              );
            }
            break;
        }
      }
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          transformed_data: transformedData 
        }
      };
      
    } catch (error) {
      return { success: false, error: `Data transformation failed: ${error.message}` };
    }
  }

  async executeFileUploadAction(config, inputData) {
    try {
      const { destination, overwrite = false, public: isPublic = false } = config;
      
      // This is a placeholder - integrate with your file upload service
      console.log(`[WorkflowExecutor] File upload to: ${destination}`);
      
      // In production, implement actual file upload logic
      const fileId = uuidv4();
      const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${destination}/${fileId}`;
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          uploaded_file: { 
            file_id: fileId, 
            file_url: fileUrl 
          }
        }
      };
      
    } catch (error) {
      return { success: false, error: `File upload failed: ${error.message}` };
    }
  }

  async executeEmailAction(config, inputData) {
    try {
      const { to, subject, template, variables = {} } = config;
      
      console.log(`[WorkflowExecutor] Sending email to: ${to}`);
      
      // This is a placeholder - integrate with your email service
      const messageId = `msg_${uuidv4()}`;
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          email_result: { 
            message_id: messageId, 
            status: 'sent' 
          }
        }
      };
      
    } catch (error) {
      return { success: false, error: `Email sending failed: ${error.message}` };
    }
  }

  async executeDelayAction(config, inputData) {
    try {
      const { duration_seconds, duration_type = 'fixed' } = config;
      
      let waitTime = duration_seconds;
      if (duration_type === 'random') {
        waitTime = Math.floor(Math.random() * duration_seconds) + 1;
      }
      
      console.log(`[WorkflowExecutor] Waiting for ${waitTime} seconds`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          delay_result: { 
            waited_seconds: waitTime 
          }
        }
      };
      
    } catch (error) {
      return { success: false, error: `Delay failed: ${error.message}` };
    }
  }

  // Utility methods
  async getNextSteps(currentStep, data, workflow) {
    try {
      // Find connections from current step
      const connections = workflow.workflow_connections.filter(
        conn => conn.source_step_id === currentStep.id
      );
      
      const nextSteps = [];
      
      for (const connection of connections) {
        let shouldFollow = false;
        
        switch (connection.connection_type) {
          case 'next':
            shouldFollow = true;
            break;
          case 'success':
            shouldFollow = data.success !== false;
            break;
          case 'error':
            shouldFollow = data.success === false;
            break;
          case 'condition':
            shouldFollow = data.conditionResult === true;
            break;
          default:
            shouldFollow = true;
        }
        
        if (shouldFollow) {
          const nextStep = workflow.workflow_steps.find(
            step => step.id === connection.target_step_id
          );
          if (nextStep) {
            nextSteps.push(nextStep);
          }
        }
      }
      
      return nextSteps;
      
    } catch (error) {
      console.error('[WorkflowExecutor] Error finding next steps:', error);
      return [];
    }
  }

  async createStepExecution(workflowExecutionId, stepId, inputData) {
    const { data, error } = await this.supabase
      .from('step_executions')
      .insert({
        workflow_execution_id: workflowExecutionId,
        step_id: stepId,
        status: 'running',
        started_at: new Date().toISOString(),
        input_data: inputData,
        execution_order: 1 // TODO: Calculate proper execution order
      })
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to create step execution: ${error.message}`);
    }
    
    return data;
  }

  async updateStepExecution(stepExecutionId, result) {
    const updateData = {
      completed_at: new Date().toISOString(),
      status: result.success ? 'completed' : 'failed',
      output_data: result.data,
      result: result
    };
    
    if (!result.success) {
      updateData.error_message = result.error;
    }
    
    const { error } = await this.supabase
      .from('step_executions')
      .update(updateData)
      .eq('id', stepExecutionId);
      
    if (error) {
      console.error('Failed to update step execution:', error);
    }
  }

  async completeExecution(executionId, outputData, stepsExecuted, startTime) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    const { error } = await this.supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
        output_data: outputData,
        steps_executed: stepsExecuted
      })
      .eq('id', executionId);
      
    if (error) {
      console.error('Failed to complete execution:', error);
    }
    
    console.log(`[WorkflowExecutor] Execution ${executionId} completed in ${duration}s`);
  }

  async failExecution(executionId, errorMessage, errorStepId = null) {
    const { error } = await this.supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        error_step_id: errorStepId
      })
      .eq('id', executionId);
      
    if (error) {
      console.error('Failed to update execution status:', error);
    }
    
    console.error(`[WorkflowExecutor] Execution ${executionId} failed: ${errorMessage}`);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  evaluateFilterCondition(item, condition) {
    // Simple filter condition evaluation
    // In production, implement a more robust expression evaluator
    return true;
  }

  performAggregation(array, operation) {
    switch (operation.type) {
      case 'count':
        return array.length;
      case 'sum':
        return array.reduce((sum, item) => sum + (item[operation.field] || 0), 0);
      case 'average':
        const sum = array.reduce((sum, item) => sum + (item[operation.field] || 0), 0);
        return array.length > 0 ? sum / array.length : 0;
      default:
        return array;
    }
  }
}

module.exports = { WorkflowExecutor };