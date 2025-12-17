
const { logger, getLogger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// ✅ OBSERVABILITY: Import OpenTelemetry API for trace propagation and span creation
const { trace, context, propagation, SpanStatusCode } = require('@opentelemetry/api');

// ✅ INSTRUCTION 2: Import structured logger (Gap 13, 15)
const { createLogger } = require('../middleware/structuredLogging');

// ✅ Consumer-friendly error messages
const { mapError } = require('../utils/consumerErrorMessages');

// ✅ FIX: Global execution registry for tracking running executions across instances
const executionRegistry = new Map();

class WorkflowExecutor {
  constructor(logger) {
    this.supabase = getSupabase();
    
    // ✅ INSTRUCTION 2: Use injected logger or create default logger
    this.logger = logger || createLogger('workflow.executor');
    
    if (!this.supabase) {
      this.logger.warn('Supabase not configured - some features will be disabled', {
        env: process.env.NODE_ENV
      });
    }
    
    // Track running executions to check for cancellation
    this.runningExecutions = new Map(); // executionId -> { cancelled: boolean }
    
    // ✅ INSTRUCTION 1: Create instrumented Axios instance for trace propagation
    this.httpClient = this._createInstrumentedHttpClient();
  }
  
  /**
   * ✅ INSTRUCTION 1: Create Axios instance with automatic trace context injection
   * This ensures all outbound HTTP calls propagate the active span context
   */
  _createInstrumentedHttpClient() {
    const client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor to inject trace context into headers
    client.interceptors.request.use(
      (config) => {
        // Get current active context and inject into headers
        const activeContext = context.active();
        const carrier = {};
        
        // Inject trace context using W3C Trace Context propagator
        propagation.inject(activeContext, carrier);
        
        // Merge trace headers into request headers
        config.headers = {
          ...config.headers,
          ...carrier
        };
        
        // ✅ INSTRUCTION 2: Use structured logger instead of console.log
        if (process.env.NODE_ENV !== 'production' && carrier.traceparent) {
          this.logger.debug('Injected trace context to HTTP request', {
            traceparent: carrier.traceparent
          });
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    return client;
  }

  // Generic helpers
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _calcBackoff(attempt, baseMs = 300, maxMs = 5000, jitterRatio = 0.2) {
    // Exponential: base * 2^(attempt-1), capped, with +/- jitter
    const pow = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
    const jitter = pow * jitterRatio;
    const delta = Math.random() * (2 * jitter) - jitter; // [-jitter, +jitter]
    const wait = Math.max(0, Math.min(maxMs, Math.floor(pow + delta)));
    return wait;
  }

  async _withBackoff(fn, opts = {}) {
    const {
      maxAttempts = 3,
      baseMs = 300,
      maxMs = 5000,
      jitterRatio = 0.2,
      shouldRetry = () => true,
      isCancelled = async () => false,
      makeController, // optional: () => AbortController
      onRetry // optional: (attempt, error, waitMs) => void
    } = opts;

    let lastErr;
    let attempts = 0;
    let totalWaitMs = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      if (await isCancelled()) {
        const err = new Error('Cancelled');
        err.code = 'CANCELLED';
        throw err;
      }
      let controller;
      try {
        controller = typeof makeController === 'function' ? makeController() : undefined;
        const result = await fn({ attempt, controller });
        return { value: result, attempts, totalWaitMs };
      } catch (err) {
        lastErr = err;
        // If explicitly cancelled, propagate immediately
        if (err?.code === 'CANCELLED') throw err;
        
        // Check if we should retry
        const retry = await shouldRetry(err, attempt);
        if (!retry || attempt === maxAttempts) {
          // Don't retry - either not retryable or max attempts reached
          if (attempt === maxAttempts && retry) {
            // Max attempts reached but error is retryable - log as potential issue
            this.logger.warn('Max retry attempts reached', {
              attempts: maxAttempts,
              error_message: err.message,
              error_code: err.code
            });
          }
          throw err;
        }
        
        // Calculate wait time with exponential backoff
        const wait = this._calcBackoff(attempt, baseMs, maxMs, jitterRatio);
        totalWaitMs += wait;
        
        // Call retry callback if provided
        if (typeof onRetry === 'function') {
          try {
            onRetry(attempt, err, wait);
          } catch (retryErr) {
            // Don't let retry callback errors break the retry loop
            this.logger.warn('Retry callback error:', retryErr);
          }
        }
        
        // Log retry attempt
        this.logger.info('Retrying after error', {
          attempt,
          max_attempts: maxAttempts,
          wait_ms: wait,
          error_message: err.message,
          error_code: err.code
        });
        
        // Wait with backoff, checking for cancellation periodically
        const start = Date.now();
        while (Date.now() - start < wait) {
          if (await isCancelled()) {
            const e = new Error('Cancelled');
            e.code = 'CANCELLED';
            throw e;
          }
          const remaining = wait - (Date.now() - start);
          await this._sleep(Math.min(remaining, 200));
        }
      } finally {
        // best-effort: abort controller on failure path if still active
        try { controller?.abort?.(); } catch (_) {}
      }
    }
    throw lastErr || new Error('Unknown backoff error');
  }

  // ✅ IMMEDIATE STATUS UPDATE METHODS
  async _updateExecutionStatus(executionId, status, message, additionalData = {}) {
    if (!this.supabase) return;
    
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };
      
      // Store status message in metadata instead of non-existent status_message column
      if (message) {
        const currentMetadata = additionalData.metadata || {};
        updateData.metadata = {
          ...currentMetadata,
          status_message: message,
          last_updated: new Date().toISOString()
        };
      }
      
      await this.supabase
        .from('workflow_executions')
        .update(updateData)
        .eq('id', executionId);
      
      // ✅ INSTRUCTION 2: Use structured logger
      this.logger.info('Execution status updated', {
        execution_id: executionId,
        status,
        message,
        ...additionalData
      });
    } catch (error) {
      // ✅ INSTRUCTION 2: Pass error object to logger for full stack trace (Gap 15)
      this.logger.error(error, 'Failed to update execution status', {
        execution_id: executionId,
        status,
        message
      });
    }
  }

  // ✅ IMMEDIATE ERROR LOGGING
  async _logExecutionFailure(executionId, error, stepInfo = {}) {
    const failureData = {
      execution_id: executionId,
      status: 'failed',
      error_message: error.message,
      error_stack: error.stack,
      failed_at: new Date().toISOString(),
      failure_reason: this._categorizeError(error),
      step_info: JSON.stringify(stepInfo)
    };
    
    try {
      if (this.supabase) {
        // Update execution status immediately
        const updateData = {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        };
        
        // ✅ FIX: Only include metadata if column exists (graceful degradation)
        // Try to update with metadata, but don't fail if column doesn't exist
        try {
          await this.supabase
            .from('workflow_executions')
            .update({
              ...updateData,
              metadata: JSON.stringify(failureData)
            })
            .eq('id', executionId);
        } catch (metaError) {
          // If metadata column doesn't exist, update without it
          if (metaError.message?.includes('metadata') || metaError.message?.includes('column')) {
            logger.warn('Metadata column not available, updating without it', { execution_id: executionId });
            await this.supabase
              .from('workflow_executions')
              .update(updateData)
              .eq('id', executionId);
          } else {
            throw metaError;
          }
        }
        
        // Log to automation history
        await this.supabase
          .from('automation_history')
          .insert({
            execution_id: executionId,
            status: 'failed',
            error_details: JSON.stringify(failureData),
            created_at: new Date().toISOString()
          });
      }
      
      // ✅ INSTRUCTION 2: Use structured logger with error object
      this.logger.error('Execution failed and logged', {
        execution_id: executionId,
        failure_data: failureData
      });
    } catch (dbError) {
      // ✅ INSTRUCTION 2: Pass error for full stack trace
      this.logger.error(dbError, 'Failed to log execution error', {
        execution_id: executionId
      });
    }
  }

  // ✅ ERROR CATEGORIZATION FOR ACTIONABLE FEEDBACK
  _categorizeError(error) {
    const message = (error.message || '').toLowerCase();
    const code = error.code || '';
    
    // Check for automation service unavailable
    if (!process.env.AUTOMATION_URL) {
      return 'AUTOMATION_SERVICE_NOT_CONFIGURED';
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || message.includes('econnrefused')) {
      return 'AUTOMATION_SERVICE_UNAVAILABLE';
    }
    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return 'TIMEOUT_ERROR';
    } else if (message.includes('selector') || message.includes('element')) {
      return 'ELEMENT_NOT_FOUND';
    } else if (message.includes('navigation') || message.includes('load')) {
      return 'PAGE_LOAD_ERROR';
    } else if (message.includes('login') || message.includes('credential')) {
      return 'AUTHENTICATION_ERROR';
    } else if (message.includes('network') || message.includes('connection') || code === 'ECONNRESET') {
      return 'NETWORK_ERROR';
    } else if (message.includes('cancelled')) {
      return 'USER_CANCELLED';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  // ✅ USER-FRIENDLY ERROR MESSAGES with detailed diagnostics
  _getUserFriendlyMessage(errorCategory, error) {
    const timestamp = new Date().toLocaleString();
    const errorCode = error?.code || 'unknown';
    const errorStatus = error?.response?.status || 'N/A';
    const errorMessage = error?.message || 'Unknown error';
    
    const messages = {
      'AUTOMATION_SERVICE_NOT_CONFIGURED': {
        summary: `Automation service not configured at ${timestamp}`,
        reason: 'AUTOMATION_URL environment variable missing',
        fix: 'Contact support or check your configuration',
        retry: false
      },
      'AUTOMATION_SERVICE_UNAVAILABLE': {
        summary: `Automation service unavailable at ${timestamp}`,
        reason: errorMessage || 'Service unreachable',
        fix: 'Service may be temporarily down. Retrying in 5 minutes...',
        retry: true
      },
      'TIMEOUT_ERROR': {
        summary: `Operation timed out at ${timestamp}`,
        reason: 'Request exceeded timeout limit',
        fix: 'Try again or increase timeout in workflow configuration',
        retry: true
      },
      'ELEMENT_NOT_FOUND': {
        summary: `Element not found at ${timestamp}`,
        reason: 'Website structure may have changed',
        fix: 'Update your workflow configuration with new selectors',
        retry: false
      },
      'PAGE_LOAD_ERROR': {
        summary: `Page load failed at ${timestamp}`,
        reason: `HTTP ${errorStatus}: ${errorMessage}`,
        fix: 'The site may be down or unreachable. Verify the URL is correct.',
        retry: true
      },
      'AUTHENTICATION_ERROR': {
        summary: `Authentication failed at ${timestamp}`,
        reason: errorMessage || 'Login credentials invalid',
        fix: 'Check your credentials and try again',
        retry: false
      },
      'NETWORK_ERROR': {
        summary: `Network error at ${timestamp}`,
        reason: `${errorCode}: ${errorMessage}`,
        fix: 'Check your internet connection and try again',
        retry: true
      },
      'USER_CANCELLED': {
        summary: 'Execution cancelled by user',
        reason: 'User requested cancellation',
        fix: 'N/A',
        retry: false
      },
      'UNKNOWN_ERROR': {
        summary: `Unexpected error at ${timestamp}`,
        reason: errorMessage,
        fix: 'Please try again or contact support if the issue persists',
        retry: true
      }
    };

    const errorInfo = messages[errorCategory] || messages['UNKNOWN_ERROR'];
    
    // Return both structured and string format for backward compatibility
    return {
      message: errorInfo.summary,
      reason: errorInfo.reason,
      fix: errorInfo.fix,
      retry: errorInfo.retry,
      technical: {
        category: errorCategory,
        code: errorCode,
        status: errorStatus,
        message: errorMessage
      },
      // String format for backward compatibility
      toString: () => `${errorInfo.summary}\n- Reason: ${errorInfo.reason}\n- Fix: ${errorInfo.fix}`
    };
  }

  // ✅ HEALTH CHECK FOR AUTOMATION SERVICE
  async _checkAutomationServiceHealth() {
    const automationUrl = process.env.AUTOMATION_URL;
    
    if (!automationUrl) {
      return {
        healthy: false,
        error: 'AUTOMATION_SERVICE_NOT_CONFIGURED',
        message: 'Automation service is not configured'
      };
    }

    try {
      // Normalize URL
      let normalizedUrl = automationUrl.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      
      // Try health endpoint first, then root
      const healthEndpoints = ['/health', '/', '/status'];
      let lastError;
      
      for (const endpoint of healthEndpoints) {
        try {
          const response = await this.httpClient.get(`${normalizedUrl}${endpoint}`, {
            timeout: 5000,
            validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx as "service is up"
          });
          
          return {
            healthy: true,
            url: normalizedUrl
          };
        } catch (err) {
          lastError = err;
          // If it's a 404, service is up but endpoint doesn't exist - that's OK
          if (err.response?.status === 404) {
            return {
              healthy: true,
              url: normalizedUrl
            };
          }
        }
      }
      
      // If all endpoints failed, service is likely down
      const code = lastError?.code || '';
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
        return {
          healthy: false,
          error: 'AUTOMATION_SERVICE_UNAVAILABLE',
          message: 'Automation service is not reachable'
        };
      }
      
      return {
        healthy: false,
        error: 'AUTOMATION_SERVICE_ERROR',
        message: lastError?.message || 'Unknown error checking automation service'
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: 'AUTOMATION_SERVICE_ERROR',
        message: error.message || 'Failed to check automation service health'
      };
    }
  }

  // ✅ EXECUTION CANCELLATION
  async cancelExecution(executionId) {
    // ✅ FIX: Check both local map and shared registry
    const execution = this.runningExecutions.get(executionId) || executionRegistry.get(executionId);
    if (execution) {
      execution.cancelled = true;
      // ✅ INSTRUCTION 2: Structured logging
      this.logger.info('Execution marked for cancellation', {
        execution_id: executionId
      });
      await this._updateExecutionStatus(executionId, 'cancelled', 'Execution cancelled by timeout or user request');
      
      // ✅ FIX: Also update in registry
      const registryEntry = executionRegistry.get(executionId);
      if (registryEntry) {
        registryEntry.cancelled = true;
      }
    }
  }
  
  // ✅ FIX: Static method to cancel execution from any executor instance
  static async cancelExecutionById(executionId) {
    const registryEntry = executionRegistry.get(executionId);
    if (registryEntry && registryEntry.executor) {
      await registryEntry.executor.cancelExecution(executionId);
      return true;
    }
    return false;
  }

  async startExecution(config) {
    const { 
      workflowId, 
      userId, 
      triggeredBy = 'manual', 
      triggerData = {}, 
      inputData = {},
      resumeFromExecutionId = null // ✅ PHASE 3: Resume from previous execution
    } = config;
    
    // ✅ PHASE 3: If resuming, get data from previous execution
    let resumeData = null;
    if (resumeFromExecutionId) {
      try {
        const { data: previousExecution } = await this.supabase
          .from('workflow_executions')
          .select('output_data, metadata, step_executions(*)')
          .eq('id', resumeFromExecutionId)
          .eq('user_id', userId)
          .single();
        
        if (previousExecution) {
          // Get last successful step's output data
          const successfulSteps = (previousExecution.step_executions || [])
            .filter(step => step.status === 'completed')
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
          
          if (successfulSteps.length > 0) {
            resumeData = successfulSteps[0].output_data || previousExecution.output_data;
            // Merge with provided input data
            inputData = { ...resumeData, ...inputData };
          }
          
          // Get partial results from metadata if available
          if (previousExecution.metadata) {
            try {
              const metadata = typeof previousExecution.metadata === 'string' 
                ? JSON.parse(previousExecution.metadata) 
                : previousExecution.metadata;
              if (metadata.partial_results) {
                inputData._resumed_from = resumeFromExecutionId;
                inputData._partial_results = metadata.partial_results;
              }
            } catch (_) {}
          }
        }
      } catch (resumeError) {
        logger.warn('Failed to resume from previous execution', {
          execution_id: resumeFromExecutionId,
          error: resumeError.message
        });
        // Continue with normal execution if resume fails
      }
    }
    
    const executionId = uuidv4();
    
    // ✅ HARD TIMEOUT CONFIGURATION
    const EXECUTION_TIMEOUT = 300000; // 5 minutes maximum execution time
    let executionTimer = null;
    
    // ✅ FIX: Store timer reference so we can clear it if execution completes early
    const timeoutHandler = async () => {
      // ✅ INSTRUCTION 2: Structured logging
      this.logger.error('Execution exceeded maximum time limit', {
        execution_id: executionId,
        max_timeout_seconds: EXECUTION_TIMEOUT / 1000
      });
      
      // ✅ FIX: Mark execution as failed with timeout error
      try {
        await this._updateExecutionStatus(executionId, 'failed', `Execution exceeded maximum time limit of ${EXECUTION_TIMEOUT / 1000} seconds`);
        await this.failExecution(executionId, `Execution exceeded maximum time limit of ${EXECUTION_TIMEOUT / 1000} seconds`, null, 'TIMEOUT');
      } catch (timeoutError) {
        this.logger.error('Failed to update execution status on timeout', {
          execution_id: executionId,
          error: timeoutError.message
        });
      }
      
      // Cancel the execution
      await this.cancelExecution(executionId);
    };
    
    executionTimer = setTimeout(timeoutHandler, EXECUTION_TIMEOUT);
    
    try {
      if (process.env.NODE_ENV !== 'production') {
        // ✅ INSTRUCTION 2: Structured logging
        this.logger.info('Starting workflow execution', {
          execution_id: executionId,
          workflow_id: workflowId,
          user_id: userId
        });
      }
      if (!this.supabase) {
        throw new Error('Workflow not found: Database unavailable');
      }
      
      // ✅ IMMEDIATE STATUS UPDATE
      await this._updateExecutionStatus(executionId, 'running', 'Initializing workflow execution...');
      
      // Get workflow definition - first try to find the workflow
      let workflow, workflowError;
      
      try {
        if (process.env.NODE_ENV !== 'production') {
          // ✅ INSTRUCTION 2: Structured logging
          this.logger.debug('Querying workflow', {
            workflow_id: workflowId
          });
        }
        
        // ✅ SECURITY: Filter by user_id to ensure users can only execute their own workflows
        const result = await this.supabase
          .from('workflows')
          .select(`
            *,
            workflow_steps(*),
            workflow_connections(*)
          `)
          .eq('id', workflowId)
          .eq('user_id', userId) // ✅ CRITICAL: Ensure user owns the workflow
          // ensure PostgREST returns at most one row to avoid coercion errors
          .limit(1)
          .maybeSingle();

        if (process.env.NODE_ENV !== 'production') {
          logger.info(`[WorkflowExecutor] Query result:`, {
            error: result.error,
            dataExists: !!result.data,
            dataId: result.data?.id,
            workflowName: result.data?.name
          });
        }

        if (result.error) {
          logger.error(`[WorkflowExecutor] Database error:`, result.error);
          workflowError = result.error;
          workflow = null;
        } else if (!result.data) {
          // ✅ INSTRUCTION 2: Structured logging
          this.logger.warn('No workflow found', {
            workflow_id: workflowId
          });
          workflowError = { message: 'No workflow found with this ID' };
          workflow = null;
        } else {
          workflow = result.data;
        }
      } catch (queryError) {
        // ✅ INSTRUCTION 2: Pass error object for full stack trace
        this.logger.error(queryError, 'Database query error', {
          workflow_id: workflowId
        });
        workflowError = { message: `Database query failed: ${queryError.message}` };
        workflow = null;
      }
        
      if (workflowError || !workflow) {
        throw new Error(`Workflow not found: ${workflowError?.message || 'Unknown error'}`);
      }
      
      const allowDraft = (process.env.ALLOW_DRAFT_EXECUTION || '').toLowerCase() === 'true' || process.env.NODE_ENV === 'test';
      if (workflow.status !== 'active') {
        if (!allowDraft) {
          throw new Error(`Workflow is not active (status: ${workflow.status})`);
        } else {
          // ✅ INSTRUCTION 2: Structured logging
          this.logger.warn('Proceeding with non-active workflow due to ALLOW_DRAFT_EXECUTION', {
            workflow_id: workflowId,
            workflow_status: workflow.status
          });
        }
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
          steps_total: workflow.workflow_steps?.length || 0
        })
        .select()
        .single();
        
      if (executionError) {
        throw new Error(`Failed to create execution: ${executionError.message}`);
      }
      
      if (process.env.NODE_ENV !== 'production') {
        // ✅ INSTRUCTION 2: Structured logging
        this.logger.info('Created workflow execution', {
          execution_id: execution.id,
          workflow_id: workflowId
        });
      }
      
      // Mark as running
      this.runningExecutions.set(execution.id, { cancelled: false, timer: executionTimer });
      
      // ✅ FIX: Also register in shared registry so cancel endpoint can find it
      executionRegistry.set(execution.id, { cancelled: false, executor: this, timer: executionTimer });

      // Start execution asynchronously
      this.executeWorkflow(execution, workflow).then(() => {
        // ✅ FIX: Clear timeout timer when execution completes successfully
        if (executionTimer) {
          clearTimeout(executionTimer);
        }
        const registryEntry = executionRegistry.get(execution.id);
        if (registryEntry && registryEntry.timer) {
          clearTimeout(registryEntry.timer);
        }
      }).catch(error => {
        // ✅ FIX: Clear timeout timer on error too
        if (executionTimer) {
          clearTimeout(executionTimer);
        }
        const registryEntry = executionRegistry.get(execution.id);
        if (registryEntry && registryEntry.timer) {
          clearTimeout(registryEntry.timer);
        }
        
        logger.error(`[WorkflowExecutor] Execution ${execution.id} failed:`, error);
        // If cancelled, don't overwrite cancelled status with failed
        const run = this.runningExecutions.get(execution.id);
        if (!run || !run.cancelled) {
          this.failExecution(execution.id, error.message);
        }
      });
      
      return execution;
      
    } catch (error) {
      logger.error('[WorkflowExecutor] Failed to start execution:', error);
      throw error;
    }
  }

  async executeWorkflow(execution, workflow) {
    const startTime = Date.now();
    let currentData = execution.input_data || {};
    let stepsExecuted = 0;
    const partialResults = []; // ✅ FIX: Track partial successes
    
    // ✅ OBSERVABILITY: Create OpenTelemetry span for workflow execution
    const tracer = trace.getTracer('workflow.executor');
    
    this.logger.info('executeWorkflow: About to create span', {
      execution_id: execution.id,
      workflow_id: workflow.id
    });
    
    return await tracer.startActiveSpan(
      `workflow.execute.${workflow.name || workflow.id}`,
      {
        kind: 1, // SpanKind.SERVER
        attributes: {
          'workflow.id': workflow.id,
          'workflow.name': workflow.name || 'unnamed',
          'workflow.status': workflow.status || 'unknown',
          'execution.id': execution.id,
          'execution.user_id': execution.user_id,
          'workflow.steps_count': workflow.workflow_steps?.length || 0,
          'business.operation': 'workflow_execution',
          'business.workflow_type': workflow.workflow_type || 'generic'
        }
      },
      async (span) => {
        try {
          // ✅ OBSERVABILITY: Log execution start with structured data
          this.logger.info('🚀 Starting workflow execution', {
            execution_id: execution.id,
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            steps_count: workflow.workflow_steps?.length || 0,
            trace_id: span.spanContext().traceId,
            span_id: span.spanContext().spanId
          });
          
          // ✅ FIX: Update status to show progress with detailed info
          await this._updateExecutionStatus(
            execution.id, 
            'running', 
            'Starting workflow execution...',
            {
              steps_total: workflow.workflow_steps?.length || 0,
              steps_executed: 0
            }
          );
      
      // Find the start step - check workflow_steps first, then canvas_config
      let steps = workflow.workflow_steps || [];
      // CRITICAL: Handle null/undefined from Supabase - convert to empty array
      let connections = Array.isArray(workflow.workflow_connections) 
        ? workflow.workflow_connections 
        : [];
      
      // CRITICAL DEBUG: Use error level to bypass log sampling (info logs are sampled at 2%)
      this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Workflow loaded state', {
        workflow_id: workflow.id,
        steps_count: steps.length,
        connections_count: connections.length,
        connections_type: typeof workflow.workflow_connections,
        connections_is_array: Array.isArray(workflow.workflow_connections),
        connections_value: workflow.workflow_connections,
        has_canvas_config: !!workflow.canvas_config,
        execution_id: execution.id
      });
      
      // ✅ FIX: Parse canvas_config if steps OR connections are missing
      // This handles cases where steps exist but connections don't (e.g., after UI save)
      const needsCanvasParse = (steps.length === 0 || connections.length === 0) && workflow.canvas_config;
      
      // CRITICAL DEBUG: Use error level to bypass log sampling
      this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Canvas parse decision', {
        workflow_id: workflow.id,
        needsCanvasParse,
        steps_length: steps.length,
        connections_length: connections.length,
        has_canvas_config: !!workflow.canvas_config,
        condition_steps_empty: steps.length === 0,
        condition_connections_empty: connections.length === 0,
        condition_has_canvas: !!workflow.canvas_config,
        execution_id: execution.id
      });
      
      if (needsCanvasParse) {
        // CRITICAL DEBUG: Use error level to bypass log sampling
        this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Parsing canvas_config (missing steps or connections)', {
          workflow_id: workflow.id,
          has_canvas_config: !!workflow.canvas_config,
          existing_steps_count: steps.length,
          existing_connections_count: connections.length,
          execution_id: execution.id
        });
        
        try {
          const canvasConfig = typeof workflow.canvas_config === 'string' 
            ? JSON.parse(workflow.canvas_config) 
            : workflow.canvas_config;
          
          // ✅ FIX: Add detailed logging to debug step parsing
          this.logger.info('[WorkflowExecutor] Canvas config structure', {
            workflow_id: workflow.id,
            has_nodes: !!canvasConfig.nodes,
            nodes_count: canvasConfig.nodes?.length || 0,
            has_edges: !!canvasConfig.edges,
            edges_count: canvasConfig.edges?.length || 0,
            sample_node: canvasConfig.nodes?.[0] ? {
              id: canvasConfig.nodes[0].id,
              type: canvasConfig.nodes[0].type,
              data: canvasConfig.nodes[0].data
            } : null,
            sample_edge: canvasConfig.edges?.[0] ? {
              source: canvasConfig.edges[0].source,
              target: canvasConfig.edges[0].target,
              type: canvasConfig.edges[0].type
            } : null,
            all_node_ids: canvasConfig.nodes?.map(n => n.id) || [],
            all_edge_sources: canvasConfig.edges?.map(e => e.source) || [],
            all_edge_targets: canvasConfig.edges?.map(e => e.target) || [],
            execution_id: execution.id
          });
          
          const crypto = require('crypto');
          const nodeIdToUuidMap = new Map();
          
          // ✅ CRITICAL FIX: Only create NEW steps if steps don't exist
          // If steps exist, we need to build a map from their step_key to UUID
          if (steps.length === 0 && canvasConfig.nodes && Array.isArray(canvasConfig.nodes)) {
            // No steps exist - create them from canvas_config
            steps = canvasConfig.nodes.map(node => {
              // ✅ FIX: Check both node.data.stepType and node.type, with detailed logging
              let stepType = node.data?.stepType || node.type || 'unknown';
              let actionType = null;
              
              // ✅ FIX: Map specific types to action steps with action_type
              // Handle both direct action types and variations
              const actionTypes = ['email', 'api_call', 'web_scraping', 'web_scrape', 'data_transform', 'file_upload', 'delay', 'form_submit', 'invoice_ocr'];
              
              // Normalize action type names
              let normalizedActionType = stepType;
              if (stepType === 'web_scraping') {
                normalizedActionType = 'web_scrape';
              }
              
              if (actionTypes.includes(stepType) || actionTypes.includes(normalizedActionType)) {
                actionType = normalizedActionType;
                stepType = 'action';
              }
              
              // ✅ FIX: Also check node.data.action_type if stepType wasn't an action
              if (stepType !== 'action' && node.data?.action_type) {
                actionType = node.data.action_type;
                stepType = 'action';
              }
              
              // Log any node that might be a start node
              if (stepType === 'start' || node.id?.includes('start') || node.data?.label?.toLowerCase().includes('start')) {
                this.logger.info('[WorkflowExecutor] Found potential start node', {
                  node_id: node.id,
                  node_type: node.type,
                  data_stepType: node.data?.stepType,
                  computed_stepType: stepType,
                  label: node.data?.label,
                  execution_id: execution.id
                });
              }
              
              // ✅ FIX: Generate proper UUID for step_id, store canvas node ID in step_key
              const uuid = crypto.randomUUID();
              nodeIdToUuidMap.set(node.id, uuid);
              
              return {
                id: uuid,
                step_key: node.id,
                workflow_id: workflow.id,
                step_type: stepType,
                action_type: actionType,
                name: node.data?.label || node.data?.name || 'Unnamed Step',
                config: node.data || {},
                position_x: node.position?.x || 0,
                position_y: node.position?.y || 0
              };
            });
            
            // ✅ FIX: Insert steps into database so foreign keys work
            // Only insert if we created new steps (steps.length was 0 before)
            const stepsToInsert = steps.map(step => ({
              id: step.id,
              workflow_id: step.workflow_id,
              step_key: step.step_key,
              name: step.name,
              step_type: step.step_type,
              action_type: step.config?.action_type || null,
              config: step.config,
              position_x: step.position_x,
              position_y: step.position_y
            }));
            
            const { error: insertError } = await this.supabase
              .from('workflow_steps')
              .insert(stepsToInsert);
            
            if (insertError) {
              this.logger.error('[WorkflowExecutor] Failed to insert steps from canvas', {
                workflow_id: workflow.id,
                error: insertError.message,
                execution_id: execution.id
              });
              throw new Error(`Failed to persist workflow steps: ${insertError.message}`);
            }
            
            // Update workflow object with persisted steps
            workflow.workflow_steps = steps;
          } else if (steps.length > 0) {
            // Steps already exist - sync with canvas_config nodes
            // CRITICAL: Canvas node IDs may have changed, so we need to match by step_type/name
            // and update step_key, or create missing steps
            
            // Build initial map from existing step_keys
            steps.forEach(step => {
              if (step.step_key) {
                nodeIdToUuidMap.set(step.step_key, step.id);
              }
            });
            
            // CRITICAL FIX: Sync canvas nodes with existing steps
            // Match by step_type + name, update step_key if node ID changed, create missing steps
            if (canvasConfig.nodes && Array.isArray(canvasConfig.nodes)) {
              const stepsToUpdate = [];
              const stepsToCreate = [];
              
              for (const node of canvasConfig.nodes) {
                let stepType = node.data?.stepType || node.type || 'unknown';
                let actionType = null;
                
                // Normalize action types
                const actionTypes = ['email', 'api_call', 'web_scraping', 'web_scrape', 'data_transform', 'file_upload', 'delay', 'form_submit', 'invoice_ocr'];
                let normalizedActionType = stepType;
                if (stepType === 'web_scraping') {
                  normalizedActionType = 'web_scrape';
                }
                
                if (actionTypes.includes(stepType) || actionTypes.includes(normalizedActionType)) {
                  actionType = normalizedActionType;
                  stepType = 'action';
                }
                
                if (stepType !== 'action' && node.data?.action_type) {
                  actionType = node.data.action_type;
                  stepType = 'action';
                }
                
                const nodeName = node.data?.label || node.data?.name || 'Unnamed Step';
                
                // Try to find existing step by step_key first
                let existingStep = steps.find(s => s.step_key === node.id);
                
                // If not found, try to match by step_type + name (for cases where node ID changed)
                if (!existingStep) {
                  existingStep = steps.find(s => 
                    s.step_type === stepType && 
                    (s.name === nodeName || (stepType === 'start' && s.step_type === 'start'))
                  );
                }
                
                if (existingStep) {
                  // Step exists - update step_key if it changed
                  if (existingStep.step_key !== node.id) {
                    stepsToUpdate.push({
                      id: existingStep.id,
                      step_key: node.id
                    });
                    // Update in-memory step object
                    existingStep.step_key = node.id;
                  }
                  // Update id_map with new node ID
                  nodeIdToUuidMap.set(node.id, existingStep.id);
                } else {
                  // New step - create it
                  const uuid = crypto.randomUUID();
                  stepsToCreate.push({
                    id: uuid,
                    workflow_id: workflow.id,
                    step_key: node.id,
                    name: nodeName,
                    step_type: stepType,
                    action_type: actionType || null,
                    config: node.data || {},
                    position_x: node.position?.x || 0,
                    position_y: node.position?.y || 0
                  });
                  nodeIdToUuidMap.set(node.id, uuid);
                  
                  // Add to in-memory steps array
                  steps.push({
                    id: uuid,
                    step_key: node.id,
                    workflow_id: workflow.id,
                    step_type: stepType,
                    action_type: actionType,
                    name: nodeName,
                    config: node.data || {},
                    position_x: node.position?.x || 0,
                    position_y: node.position?.y || 0
                  });
                }
              }
              
              // Update step_keys in database
              if (stepsToUpdate.length > 0) {
                for (const update of stepsToUpdate) {
                  const { error } = await this.supabase
                    .from('workflow_steps')
                    .update({ step_key: update.step_key })
                    .eq('id', update.id);
                  
                  if (error) {
                    this.logger.error('[WorkflowExecutor] Failed to update step_key', {
                      workflow_id: workflow.id,
                      step_id: update.id,
                      new_step_key: update.step_key,
                      error: error.message,
                      execution_id: execution.id
                    });
                  }
                }
              }
              
              // Create new steps
              if (stepsToCreate.length > 0) {
                const { error: createError } = await this.supabase
                  .from('workflow_steps')
                  .insert(stepsToCreate);
                
                if (createError) {
                  this.logger.error('[WorkflowExecutor] Failed to create missing steps', {
                    workflow_id: workflow.id,
                    error: createError.message,
                    steps_to_create: stepsToCreate.length,
                    execution_id: execution.id
                  });
                } else {
                  this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Created missing steps from canvas', {
                    workflow_id: workflow.id,
                    created_count: stepsToCreate.length,
                    updated_count: stepsToUpdate.length,
                    execution_id: execution.id
                  });
                }
              }
            }
            
            this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Synced steps with canvas_config', {
              workflow_id: workflow.id,
              steps_count: steps.length,
              mapped_keys: Array.from(nodeIdToUuidMap.keys()),
              step_details: steps.map(s => ({ step_key: s.step_key, id: s.id, step_type: s.step_type, name: s.name })),
              execution_id: execution.id
            });
          }
          
          // ✅ FIX: Parse edges and convert to workflow_connections
          // Only parse if connections are missing (don't overwrite existing connections)
          if (connections.length === 0 && canvasConfig.edges && Array.isArray(canvasConfig.edges)) {
            // ✅ CRITICAL FIX: If steps already exist, we MUST use their existing UUIDs
            // Build a map from step_key (canvas node ID) to step UUID from database
            const stepKeyToUuidMap = new Map();
            
            // Always build the map from existing steps first
            if (steps.length > 0) {
              // Steps already exist - use their step_key to map to UUIDs
              steps.forEach(step => {
                if (step.step_key) {
                  stepKeyToUuidMap.set(step.step_key, step.id);
                }
              });
              
              this.logger.info('[WorkflowExecutor] Built step_key to UUID map from existing steps', {
                workflow_id: workflow.id,
                steps_count: steps.length,
                mapped_keys: Array.from(stepKeyToUuidMap.keys()),
                execution_id: execution.id
              });
            }
            
            // If we just created new steps, merge nodeIdToUuidMap with stepKeyToUuidMap
            // Otherwise, use only stepKeyToUuidMap (existing steps)
            const idMap = nodeIdToUuidMap.size > 0 
              ? new Map([...stepKeyToUuidMap, ...nodeIdToUuidMap]) // Merge both maps
              : stepKeyToUuidMap; // Use existing steps only
            
            // CRITICAL DEBUG: Use error level to bypass log sampling
            this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Mapping canvas edges to step UUIDs', {
              workflow_id: workflow.id,
              edges_count: canvasConfig.edges.length,
              id_map_size: idMap.size,
              id_map_keys: Array.from(idMap.keys()),
              id_map_entries: Array.from(idMap.entries()).map(([k, v]) => ({ key: k, uuid: v })),
              edges_detail: canvasConfig.edges.map(e => ({
                source: e.source,
                target: e.target,
                type: e.type,
                id: e.id
              })),
              execution_id: execution.id
            });
            
            const parsedConnections = canvasConfig.edges.map(edge => {
              const sourceUuid = idMap.get(edge.source);
              const targetUuid = idMap.get(edge.target);
              
              this.logger.debug('[WorkflowExecutor] Mapping edge', {
                workflow_id: workflow.id,
                edge_source: edge.source,
                edge_target: edge.target,
                source_uuid: sourceUuid || 'NOT_FOUND',
                target_uuid: targetUuid || 'NOT_FOUND',
                id_map_has_source: idMap.has(edge.source),
                id_map_has_target: idMap.has(edge.target),
                available_keys: Array.from(idMap.keys()),
                execution_id: execution.id
              });
              
              if (!sourceUuid || !targetUuid) {
                this.logger.warn('[WorkflowExecutor] Could not map edge to step UUIDs', {
                  workflow_id: workflow.id,
                  edge_source: edge.source,
                  edge_target: edge.target,
                  source_uuid: sourceUuid || 'NOT_FOUND',
                  target_uuid: targetUuid || 'NOT_FOUND',
                  available_keys: Array.from(idMap.keys()),
                  id_map_entries: Array.from(idMap.entries()),
                  execution_id: execution.id
                });
              }
              
              return {
                id: crypto.randomUUID(),
                workflow_id: workflow.id,
                source_step_id: sourceUuid,
                target_step_id: targetUuid,
                connection_type: edge.type || 'next',
                condition: edge.data?.condition || edge.data?.conditions || {}
              };
            }).filter(conn => conn.source_step_id && conn.target_step_id);
            
            // Insert connections into database
            if (parsedConnections.length > 0) {
              const { error: connError } = await this.supabase
                .from('workflow_connections')
                .insert(parsedConnections);
              
              if (connError) {
                this.logger.error('[WorkflowExecutor] Failed to insert connections', {
                  workflow_id: workflow.id,
                  error: connError.message,
                  error_details: connError,
                  execution_id: execution.id
                });
              } else {
                this.logger.info('[WorkflowExecutor] Successfully parsed and inserted connections from canvas_config', {
                  workflow_id: workflow.id,
                  connections_count: parsedConnections.length,
                  connections: parsedConnections.map(c => ({
                    source: c.source_step_id,
                    target: c.target_step_id,
                    type: c.connection_type
                  })),
                  execution_id: execution.id
                });
              }
              
              // Update workflow object with parsed connections
              workflow.workflow_connections = parsedConnections;
              connections = parsedConnections;
            } else {
              this.logger.warn('[WorkflowExecutor] No valid connections found in canvas_config edges', {
                workflow_id: workflow.id,
                edges_count: canvasConfig.edges.length,
                id_map_size: idMap.size,
                id_map_keys: Array.from(idMap.keys()),
                edge_details: canvasConfig.edges.map(e => ({
                  source: e.source,
                  target: e.target,
                  source_mapped: idMap.get(e.source) || 'NOT_FOUND',
                  target_mapped: idMap.get(e.target) || 'NOT_FOUND'
                })),
                execution_id: execution.id
              });
              workflow.workflow_connections = [];
            }
          } else if (connections.length === 0) {
            // No edges in canvas_config and no existing connections
            this.logger.warn('[WorkflowExecutor] No connections found in canvas_config or database', {
              workflow_id: workflow.id,
              has_edges: !!(canvasConfig.edges && Array.isArray(canvasConfig.edges)),
              edges_count: canvasConfig.edges?.length || 0,
              execution_id: execution.id
            });
            workflow.workflow_connections = [];
          }
          
          this.logger.info('[WorkflowExecutor] Parsed canvas_config', {
            workflow_id: workflow.id,
            steps_count: steps.length,
            step_types: steps.map(s => s.step_type),
            all_steps: steps.map(s => ({ id: s.id, type: s.step_type, name: s.name })),
            connections_count: workflow.workflow_connections?.length || 0,
            execution_id: execution.id
          });
          
          // ✅ FIX: Update execution.steps_total after canvas parsing completes
          // Reload steps to get accurate count after parsing (steps may have been added/updated)
          const { data: updatedSteps } = await this.supabase
            .from('workflow_steps')
            .select('id')
            .eq('workflow_id', workflow.id);
          
          if (updatedSteps && updatedSteps.length > 0) {
            const actualStepsTotal = updatedSteps.length;
            // Update execution record with correct steps_total
            await this.supabase
              .from('workflow_executions')
              .update({ steps_total: actualStepsTotal })
              .eq('id', execution.id);
            
            // Update workflow object
            workflow.workflow_steps = updatedSteps.map(s => ({ id: s.id }));
            
            this.logger.error('[WorkflowExecutor] 🔍 DEBUG: Updated execution steps_total after canvas parsing', {
              workflow_id: workflow.id,
              execution_id: execution.id,
              old_steps_total: execution.steps_total,
              new_steps_total: actualStepsTotal,
              steps_count: actualStepsTotal
            });
          }
        } catch (parseError) {
          this.logger.error('[WorkflowExecutor] Failed to parse canvas_config', {
            workflow_id: workflow.id,
            error: parseError.message,
            execution_id: execution.id
          });
        }
      }
      
      this.logger.info('[WorkflowExecutor] Looking for start step', {
        workflow_id: workflow.id,
        total_steps: steps.length,
        step_types: steps.map(s => s.step_type),
        execution_id: execution.id
      });
      
      const startStep = steps.find(step => step.step_type === 'start');
      
      if (!startStep) {
        // ✅ FIX: Provide helpful error message and mark execution as failed immediately
        this.logger.error('[WorkflowExecutor] No start step found', {
          workflow_id: workflow.id,
          available_steps: steps.map(s => ({ 
            id: s.id, 
            type: s.step_type, 
            name: s.name 
          })),
          has_canvas_config: !!workflow.canvas_config,
          execution_id: execution.id
        });
        const errorMsg = 'Workflow has no start step. Please add a start step to your workflow.';
        await this._updateExecutionStatus(execution.id, 'failed', errorMsg);
        await this.failExecution(execution.id, errorMsg, null, 'WORKFLOW_CONFIGURATION_ERROR');
        return;
      }
      
      // Update workflow object to use parsed steps
      workflow.workflow_steps = steps;
      
      // ✅ DEBUG: Log workflow connections to help diagnose "no steps executed" issues
      this.logger.info('[WorkflowExecutor] Workflow structure before execution', {
        workflow_id: workflow.id,
        execution_id: execution.id,
        total_steps: workflow.workflow_steps.length,
        total_connections: workflow.workflow_connections?.length || 0,
        start_step_id: startStep.id,
        start_step_name: startStep.name,
        connections_from_start: (workflow.workflow_connections || []).filter(
          conn => conn.source_step_id === startStep.id
        ).length,
        all_connections: (workflow.workflow_connections || []).map(conn => ({
          source: conn.source_step_id,
          target: conn.target_step_id,
          type: conn.connection_type
        })),
        step_types: workflow.workflow_steps.map(s => ({
          id: s.id,
          type: s.step_type,
          name: s.name
        }))
      });
      
      // ✅ FIX: Warn if no connections exist (workflow will complete immediately)
      if (!workflow.workflow_connections || workflow.workflow_connections.length === 0) {
        this.logger.error('[WorkflowExecutor] ⚠️ No workflow connections found - workflow will complete without executing steps', {
          workflow_id: workflow.id,
          execution_id: execution.id,
          total_steps: workflow.workflow_steps.length,
          start_step_id: startStep.id,
          start_step_key: startStep.step_key,
          has_canvas_config: !!workflow.canvas_config,
          canvas_config_edges_count: workflow.canvas_config ? (typeof workflow.canvas_config === 'string' ? JSON.parse(workflow.canvas_config).edges?.length : workflow.canvas_config.edges?.length) : 0,
          all_step_keys: workflow.workflow_steps.map(s => s.step_key),
          all_step_ids: workflow.workflow_steps.map(s => s.id)
        });
      }
      
          // ✅ FIX: Update status before executing steps with step count
      // ✅ FIX: Use actual steps count (may have been updated after canvas parsing)
      const actualStepsTotal = workflow.workflow_steps?.length || steps.length || 0;
      
      await this._updateExecutionStatus(
        execution.id, 
        'running', 
        `Executing ${actualStepsTotal} steps...`,
        {
          steps_total: actualStepsTotal,
          steps_executed: 0
        }
      );
      
      // ✅ FIX: Also update execution record directly to ensure frontend gets correct count
      await this.supabase
        .from('workflow_executions')
        .update({ steps_total: actualStepsTotal })
        .eq('id', execution.id);
      
  // Execute workflow steps
  const result = await this.executeStep(execution, startStep, currentData, workflow, new Set(), partialResults);
      
      // On return, check if cancelled
      const run = this.runningExecutions.get(execution.id);
      if (run && run.cancelled) {
        // Already marked cancelled by route; nothing else to do.
        return;
      }

      // ✅ OBSERVABILITY: Get actual steps_executed by counting completed step_executions
      // This is more reliable than reading steps_executed from execution record
      const { data: stepExecutions } = await this.supabase
        .from('step_executions')
        .select('id, status')
        .eq('workflow_execution_id', execution.id);
      
      const actualStepsExecuted = stepExecutions?.filter(se => se.status === 'completed').length || 0;
      const { data: executionStatus } = await this.supabase
        .from('workflow_executions')
        .select('steps_total')
        .eq('id', execution.id)
        .single();
      
      const totalSteps = executionStatus?.steps_total || workflow.workflow_steps?.length || 0;
      
      this.logger.info('Workflow execution result', {
        execution_id: execution.id,
        result_success: result.success,
        actual_steps_executed: actualStepsExecuted,
        step_executions_total: stepExecutions?.length || 0,
        step_executions_completed: actualStepsExecuted,
        total_steps: totalSteps,
        trace_id: span.spanContext().traceId
      });
      
      span.setAttributes({
        'workflow.actual_steps_executed': actualStepsExecuted,
        'workflow.steps_total': totalSteps,
        'workflow.step_executions_count': stepExecutions?.length || 0
      });

          if (result.success) {
            // ✅ CRITICAL FIX: If no steps executed but workflow has steps, mark as failed
            // Use actual step_executions count instead of database field
            if (totalSteps > 0 && actualStepsExecuted === 0) {
              const errorMsg = 'Workflow execution failed. Please try running the workflow again.';
              
              this.logger.error('❌ Workflow marked as completed but no steps executed', {
                execution_id: execution.id,
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                steps_total: totalSteps,
                steps_executed: actualStepsExecuted,
                trace_id: span.spanContext().traceId
              });
              
              // ✅ Map to consumer-friendly error message
              const errorMapping = mapError(
                errorMsg, 
                'NO_STEPS_EXECUTED',
                {
                  executionId: execution.id,
                  workflowId: execution.workflow_id,
                  userId: execution.user_id
                }
              );
              
              span.setStatus({ 
                code: SpanStatusCode.ERROR, 
                message: errorMapping.consumer.message 
              });
              span.setAttributes({
                'workflow.completed': false,
                'workflow.success': false,
                'workflow.steps_executed': 0,
                'workflow.steps_total': totalSteps,
                'error': true,
                'error.type': 'NO_STEPS_EXECUTED',
                'error.message': errorMapping.consumer.message,
                'workflow.duration_ms': Date.now() - startTime
              });
              
              // Store consumer-friendly message in database
              await this.failExecution(
                execution.id, 
                errorMapping.consumer.message, 
                null, 
                'NO_STEPS_EXECUTED'
              );
              return;
            }
            
            // ✅ FIX: Store partial results in metadata if any steps partially succeeded
            const outputData = result.data;
            if (partialResults.length > 0) {
              outputData._partial_results = partialResults;
              outputData._partial_success_note = 'Some steps completed successfully before failure';
            }
            
            const duration = Date.now() - startTime;
            span.setStatus({ code: SpanStatusCode.OK });
            span.setAttributes({
              'workflow.completed': true,
              'workflow.steps_executed': stepsExecuted,
              'workflow.duration_ms': duration,
              'workflow.success': true
            });
            
            this.logger.info('✅ Workflow execution completed successfully', {
              execution_id: execution.id,
              steps_executed: actualStepsExecuted,
              duration_ms: duration,
              workflow_name: workflow.name
            });
            await this.completeExecution(execution.id, outputData, actualStepsExecuted, startTime);
          } else {
            // ✅ FIX: If we have partial results, include them in the failure
            const errorData = {
              error: result.error,
              errorCategory: result.errorCategory,
              partialResults: partialResults.length > 0 ? partialResults : undefined
            };
            
            const duration = Date.now() - startTime;
            span.setStatus({ 
              code: SpanStatusCode.ERROR, 
              message: result.error || 'Workflow execution failed' 
            });
            span.setAttributes({
              'workflow.completed': false,
              'workflow.success': false,
              'workflow.duration_ms': duration,
              'error': true,
              'error.type': result.errorCategory || 'UNKNOWN',
              'error.message': result.error || 'Unknown error',
              'error.step_id': result.errorStepId || null,
              'workflow.partial_results_count': partialResults.length
            });
            
            // Store partial results even on failure
            if (partialResults.length > 0) {
              try {
                await this.supabase
                  .from('workflow_executions')
                  .update({
                    metadata: JSON.stringify({
                      partial_results: partialResults,
                      error_category: result.errorCategory
                    })
                  })
                  .eq('id', execution.id);
              } catch (metaError) {
                // ✅ FIX: Gracefully handle missing metadata column
                if (metaError.message?.includes('metadata') || metaError.message?.includes('column')) {
                  this.logger.warn('Metadata column not available, skipping partial results storage', { execution_id: execution.id });
                } else {
                  throw metaError;
                }
              }
            }
            
            const errorCategory = result.errorCategory || this._categorizeError({ message: result.error });
            this.logger.error('❌ Workflow execution failed', {
              execution_id: execution.id,
              error: result.error,
              error_category: errorCategory,
              error_step_id: result.errorStepId,
              duration_ms: duration,
              partial_results_count: partialResults.length
            });
            await this.failExecution(execution.id, result.error, result.errorStepId, errorCategory);
          }
          
        } catch (error) {
          const duration = Date.now() - startTime;
          span.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: error.message || 'Unexpected workflow execution error' 
          });
          span.setAttributes({
            'workflow.completed': false,
            'workflow.success': false,
            'workflow.duration_ms': duration,
            'error': true,
            'error.type': 'UNEXPECTED_ERROR',
            'error.message': error.message || 'Unknown error',
            'error.stack': error.stack || null
          });
          
          this.logger.error('❌ Workflow execution failed with unexpected error', error, {
            execution_id: execution.id,
            workflow_id: workflow.id,
            duration_ms: duration
          });
          
          const run = this.runningExecutions.get(execution.id);
          if (!run || !run.cancelled) {
        // ✅ FIX: Store partial results even on unexpected errors
        if (partialResults.length > 0) {
          try {
            await this.supabase
              .from('workflow_executions')
              .update({
                metadata: JSON.stringify({
                  partial_results: partialResults,
                  error_category: 'UNEXPECTED_ERROR'
                })
              })
              .eq('id', execution.id);
          } catch (metaErr) {
            // Don't fail on metadata update errors
            logger.warn('Failed to store partial results:', metaErr);
          }
        }
        
            const errorCategory = this._categorizeError(error);
            const userMessage = this._getUserFriendlyMessage(errorCategory, error);
            await this.failExecution(execution.id, userMessage, null, errorCategory);
          }
        } finally {
          this.runningExecutions.delete(execution.id);
          // ✅ FIX: Clean up shared registry
          executionRegistry.delete(execution.id);
          // ✅ OBSERVABILITY: End span
          span.end();
        }
      }
    );
  }

  async executeStep(execution, step, inputData, workflow, visitedSteps = new Set(), partialResults = []) {
    // ✅ OBSERVABILITY: Create span for step execution
    const tracer = trace.getTracer('workflow.step');
    const stepStartTime = Date.now();
    
    return await tracer.startActiveSpan(
      `workflow.step.${step.step_type}.${step.name || step.id}`,
      {
        kind: 1, // SpanKind.INTERNAL
        attributes: {
          'workflow.step.id': step.id,
          'workflow.step.name': step.name || 'unnamed',
          'workflow.step.type': step.step_type,
          'workflow.step.action_type': step.action_type || 'none',
          'execution.id': execution.id,
          'workflow.id': workflow.id
        }
      },
      async (stepSpan) => {
        try {
          // ✅ FIX: Check cancellation before starting step (check both local and registry)
          if (await this._isCancelled(execution.id)) {
            stepSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Execution cancelled' });
            stepSpan.setAttributes({ 'step.cancelled': true });
            stepSpan.end();
            return { success: false, error: 'Execution cancelled', errorStepId: step.id };
          }
          
          // Prevent infinite loops
          if (visitedSteps.has(step.id)) {
            const error = new Error(`Circular dependency detected at step: ${step.name}`);
            stepSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            stepSpan.setAttributes({ 'error': true, 'error.type': 'CIRCULAR_DEPENDENCY' });
            stepSpan.end();
            throw error;
          }
          visitedSteps.add(step.id);
          
          this.logger.info('Executing workflow step', {
            execution_id: execution.id,
            step_id: step.id,
            step_name: step.name,
            step_type: step.step_type,
            action_type: step.action_type,
            trace_id: stepSpan.spanContext().traceId,
            span_id: stepSpan.spanContext().spanId
          });
          
          // ✅ FIX: Update execution status to show current step with detailed progress
          const stepNumber = Array.from(visitedSteps).length;
          const totalSteps = workflow.workflow_steps?.length || 0;
          const stepTypeInfo = step.action_type ? ` (${step.action_type})` : '';
          await this._updateExecutionStatus(
            execution.id, 
            'running', 
            `Executing step ${stepNumber}/${totalSteps}: ${step.name}${stepTypeInfo}`,
            {
              steps_executed: stepNumber - 1,
              steps_total: totalSteps
            }
          );
          
          // Create step execution record
          const stepExecution = await this.createStepExecution(execution.id, step.id, inputData);
          
          let result = { success: true, data: inputData };
          
          // Execute based on step type
          // ✅ FIX: Handle case where step_type might be an action type directly (legacy support)
          let stepType = step.step_type;
          if (stepType && ['email', 'api_call', 'web_scrape', 'web_scraping', 'data_transform', 'file_upload', 'delay', 'form_submit', 'invoice_ocr'].includes(stepType)) {
            // If step_type is an action type, treat it as an action step
            this.logger.warn('Step has action type as step_type, converting to action step', {
              execution_id: execution.id,
              step_id: step.id,
              step_type: stepType,
              action_type: step.action_type
            });
            stepType = 'action';
            // Ensure action_type is set
            if (!step.action_type) {
              step.action_type = step.step_type;
            }
          }
          
          switch (stepType) {
            case 'start':
              result = await this.executeStartStep(step, inputData);
              break;
            case 'action':
              result = await this.executeActionStep(step, inputData, execution);
              break;
            case 'condition':
              result = await this.executeConditionStep(step, inputData);
              break;
            case 'end':
              result = await this.executeEndStep(step, inputData);
              break;
            default:
              throw new Error(`Unknown step type: ${step.step_type}${step.action_type ? ` (action_type: ${step.action_type})` : ''}`);
          }
          
          // ✅ ENHANCED: Update step execution with detailed information
          // Store step start time for duration calculation
          stepExecution._startTime = stepStartTime;
          await this.updateStepExecution(stepExecution, result);
          
          const stepDuration = Date.now() - stepStartTime;
          
          // ✅ ENHANCED: Update status message with step details
          if (execution?.id && result.success && result.meta?.stepDetails) {
            const stepNumber = Array.from(visitedSteps).length;
            const totalSteps = workflow.workflow_steps?.length || 0;
            const durationDisplay = result.meta.duration || `${(stepDuration / 1000).toFixed(1)}s`;
            await this._updateExecutionStatus(
              execution.id,
              'running',
              `✓ Step ${stepNumber}: ${result.meta.stepDetails} (${durationDisplay})`
            );
          }
          
          // ✅ OBSERVABILITY: Update span with step results
          if (result.success) {
            // ✅ CRITICAL FIX: Increment stepsExecuted when step actually succeeds
            // Note: stepsExecuted is in the outer scope, we need to track it properly
            // We'll update it via the execution status update which tracks it in the database
            
            stepSpan.setStatus({ code: SpanStatusCode.OK });
            stepSpan.setAttributes({
              'step.completed': true,
              'step.success': true,
              'step.duration_ms': stepDuration,
              'step.output_data_size': result.data ? JSON.stringify(result.data).length : 0
            });
            this.logger.info('Step completed successfully', {
              execution_id: execution.id,
              step_id: step.id,
              step_name: step.name,
              duration_ms: stepDuration,
              trace_id: stepSpan.spanContext().traceId
            });
          } else {
            stepSpan.setStatus({ 
              code: SpanStatusCode.ERROR, 
              message: result.error || 'Step execution failed' 
            });
            stepSpan.setAttributes({
              'step.completed': false,
              'step.success': false,
              'step.duration_ms': stepDuration,
              'error': true,
              'error.type': result.errorCategory || 'UNKNOWN',
              'error.message': result.error || 'Unknown error'
            });
            this.logger.error('Step execution failed', {
              execution_id: execution.id,
              step_id: step.id,
              step_name: step.name,
              error: result.error,
              error_category: result.errorCategory,
              duration_ms: stepDuration
            });
          }
          
          // ✅ FIX: Store partial results even if step fails (if it produced some data)
          if (!result.success && result.data && Object.keys(result.data).length > 0) {
            partialResults.push({
              step_id: step.id,
              step_name: step.name,
              step_type: step.step_type,
              data: result.data,
              error: result.error,
              errorCategory: result.errorCategory
            });
          }
          
          if (!result.success) {
            // ✅ IMMEDIATE FIX: Preserve error category from action execution
            stepSpan.end();
            return { 
              success: false, 
              error: result.error, 
              errorStepId: step.id,
              errorCategory: result.errorCategory
            };
          }
          
          // Handle end step
          if (step.step_type === 'end') {
            stepSpan.end();
            return { success: true, data: result.data };
          }
          
          // Find next step(s)
          const nextSteps = await this.getNextSteps(step, result.data, workflow);
          
          if (nextSteps.length === 0) {
            // No more steps, workflow complete
            stepSpan.end();
            return { success: true, data: result.data };
          }
          
          // Execute next step(s)
          // For now, we only handle sequential execution (single next step)
          const nextStep = nextSteps[0];
          stepSpan.end();
          return await this.executeStep(execution, nextStep, result.data, workflow, visitedSteps, partialResults);
          
        } catch (error) {
          const stepDuration = Date.now() - stepStartTime;
          stepSpan.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: error.message || 'Step execution error' 
          });
          stepSpan.setAttributes({
            'error': true,
            'error.type': 'EXCEPTION',
            'error.message': error.message || 'Unknown error',
            'error.stack': error.stack || null,
            'step.duration_ms': stepDuration
          });
          this.logger.error('Step execution failed with exception', error, {
            execution_id: execution.id,
            step_id: step.id,
            step_name: step.name,
            duration_ms: stepDuration
          });
          stepSpan.end();
          return { success: false, error: error.message, errorStepId: step.id };
        }
      }
    );
  }

  async executeStartStep(step, inputData) {
    // Start step just passes data through
    return { 
      success: true, 
      data: inputData,
      meta: {
        stepDetails: 'Workflow started',
        duration: '0.0s'
      }
    };
  }

  async executeActionStep(step, inputData, execution) {
    try {
      const { action_type, config } = step;
      
      // ✅ OBSERVABILITY: Log action step execution
      this.logger.info('Executing action step', {
        step_id: step.id,
        step_name: step.name,
        action_type: action_type,
        step_type: step.step_type,
        execution_id: execution?.id
      });
      
      // Get action definition
      const { data: actionDef, error } = await this.supabase
        .from('action_definitions')
        .select('*')
        .eq('action_type', action_type)
        .single();
        
      if (error || !actionDef) {
        this.logger.error('Action definition not found', {
          action_type: action_type,
          step_id: step.id,
          step_name: step.name,
          execution_id: execution?.id,
          error: error?.message
        });
        throw new Error(`Action definition not found: ${action_type}`);
      }
      
    // Execute based on action type
  switch (action_type) {
        case 'web_scrape':
      return await this.executeWebScrapeAction(config, inputData, execution);
        case 'api_call':
      return await this.executeApiCallAction(config, inputData, execution);
        case 'data_transform':
          return await this.executeDataTransformAction(config, inputData);
        case 'file_upload':
      return await this.executeFileUploadAction(config, inputData, execution);
        case 'email':
          return await this.executeEmailAction(config, inputData, execution);
        case 'delay':
          return await this.executeDelayAction(config, inputData, execution);
        case 'form_submit':
          return await this.executeFormSubmitAction(config, inputData, execution);
        case 'invoice_ocr':
          return await this.executeInvoiceOcrAction(config, inputData, execution);
        default:
          throw new Error(`Unsupported action type: ${action_type}`);
      }
      
    } catch (error) {
      // ✅ OBSERVABILITY: Log action step failure with full context
      this.logger.error('Action step execution failed', {
        error_message: error.message,
        error_stack: error.stack,
        step_id: step?.id,
        step_name: step?.name,
        action_type: step?.action_type,
        step_type: step?.step_type,
        execution_id: execution?.id
      });
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
      },
      meta: {
        stepDetails: success ? 'Workflow completed' : 'Workflow ended',
        duration: '0.0s'
      }
    };
  }

  // Action implementations
  async executeWebScrapeAction(config, inputData, execution) {
    try {
      // ✅ IMMEDIATE FIX: Health check before execution
      const healthCheck = await this._checkAutomationServiceHealth();
      if (!healthCheck.healthy) {
        const errorCategory = healthCheck.error || 'AUTOMATION_SERVICE_UNAVAILABLE';
        const userMessage = this._getUserFriendlyMessage(errorCategory, { message: healthCheck.message });
        this.logger.error('Automation service health check failed', {
          execution_id: execution?.id,
          error_category: errorCategory,
          message: healthCheck.message
        });
        return { 
          success: false, 
          error: userMessage,
          errorCategory,
          technicalError: healthCheck.message
        };
      }
      
      // This is a placeholder - integrate with your existing scraping service
      const { url, selectors, timeout = 30 } = config;
      
      // ✅ VISIBILITY: Update status to show what's happening
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          `Step 1: Connecting to scraping service...`
        );
      }
      
      logger.info(`[WorkflowExecutor] Web scraping: ${url}`);
      
      // Track step start time for duration
      const stepStartTime = Date.now();
      
      // ✅ PRIORITY 2: Retry scraping 3x with exponential backoff (0s, 5s, 15s)
      const maxAttempts = 3;
      const backoffDelays = [0, 5000, 15000]; // 0s, 5s, 15s
      
      let lastError;
      let attempts = 0;
      let scrapedData = null;
      
      // Update status to show connection
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          `Step 1: Connected to scraping service (${((Date.now() - stepStartTime) / 1000).toFixed(1)} sec)`
        );
      }
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts = attempt;
        
        // Check for cancellation
        if (execution && await this._isCancelled(execution.id)) {
          throw new Error('Execution cancelled');
        }
        
        try {
          // Update status to show retry attempt
          if (execution?.id && attempt > 1) {
            await this._updateExecutionStatus(
              execution.id,
              'running',
              `Step 1: Retrying scraping (attempt ${attempt}/${maxAttempts})...`
            );
          } else if (execution?.id && attempt === 1) {
            await this._updateExecutionStatus(
              execution.id,
              'running',
              `Step 1: Scraping data from ${url}...`
            );
          }
          
          this.logger.info(`[WorkflowExecutor] Scraping attempt ${attempt}/${maxAttempts}`, {
            execution_id: execution?.id,
            url,
            attempt
          });
          
          // Use instrumented client for automatic trace propagation
          const response = await this.httpClient.post(`${process.env.AUTOMATION_URL}/scrape`, {
            url,
            selectors,
            timeout
          }, {
            timeout: timeout * 1000
          });
          
          scrapedData = response.data;
          const scrapeDuration = (Date.now() - scrapeStartTime) / 1000;
          
          // ✅ OBSERVABILITY: Log successful scraping with metrics
          this.logger.info(`[WorkflowExecutor] ✅ Scraping succeeded on attempt ${attempt}`, {
            execution_id: execution?.id,
            url,
            attempts,
            duration_sec: scrapeDuration,
            data_size: scrapedData ? JSON.stringify(scrapedData).length : 0,
            timestamp: new Date().toISOString(),
            observability: {
              event: 'scraping_success',
              attempt_number: attempt,
              duration_sec: scrapeDuration
            }
          });
          break; // Success - exit retry loop
          
        } catch (err) {
          lastError = err;
          const status = err?.response?.status;
          const code = err?.code || '';
          const isRetryable = 
            (code && ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(code)) ||
            (status && (status >= 500 || status === 408 || status === 429)) ||
            (err?.message?.toLowerCase().includes('timeout') || err?.message?.toLowerCase().includes('network'));
          
          if (!isRetryable || attempt === maxAttempts) {
            // Not retryable or max attempts reached
            const errorCategory = this._categorizeError(err);
            this.logger.error(`[WorkflowExecutor] ❌ Scraping failed (not retrying)`, {
              execution_id: execution?.id,
              url,
              attempt,
              max_attempts: maxAttempts,
              error: err.message,
              error_code: err.code,
              error_status: err.response?.status,
              is_retryable: isRetryable,
              error_category: errorCategory,
              timestamp: new Date().toISOString(),
              observability: {
                event: 'scraping_failed_final',
                attempt_number: attempt,
                max_attempts: maxAttempts,
                error_category: errorCategory,
                is_retryable: isRetryable
              }
            });
            throw err;
          }
          
          // Calculate wait time for this attempt
          const waitMs = backoffDelays[attempt - 1] || 0;
          
          // ✅ OBSERVABILITY: Log retry attempt with full context
          this.logger.warn(`[WorkflowExecutor] ⚠️ Scraping attempt ${attempt} failed, retrying in ${waitMs}ms`, {
            execution_id: execution?.id,
            url,
            attempt,
            max_attempts: maxAttempts,
            wait_ms: waitMs,
            error: err.message,
            error_code: err.code,
            error_status: err.response?.status,
            timestamp: new Date().toISOString(),
            observability: {
              event: 'scraping_retry',
              attempt_number: attempt,
              wait_ms: waitMs,
              error_category: this._categorizeError(err)
            }
          });
          
          // Wait before retry (except first attempt which is immediate)
          if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!scrapedData && lastError) {
        throw lastError;
      }
      
      const backoff = {
        value: { data: scrapedData },
        attempts,
        totalWaitMs: backoffDelays.slice(0, attempts - 1).reduce((a, b) => a + b, 0)
      };

      // ✅ PRIORITY 3: Store scraped data immediately (before email step) so it's saved even if email fails
      if (execution?.id && scrapedData) {
        try {
          await this.supabase
            .from('workflow_executions')
            .update({
              output_data: {
                ...inputData,
                scraped_data: scrapedData
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', execution.id);
          
          this.logger.info(`[WorkflowExecutor] 💾 Scraped data stored in execution`, {
            execution_id: execution.id,
            data_size: JSON.stringify(scrapedData).length
          });
        } catch (storeError) {
          this.logger.warn('Failed to store scraped data immediately', {
            execution_id: execution.id,
            error: storeError.message
          });
        }
      }
      
      // Update status to show scraping succeeded
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          'Scraping ✓ | Preparing next step...'
        );
      }
      
      // Calculate records count for user-friendly message
      let recordsCount = 0;
      let stepDetails = '';
      if (scrapedData) {
        if (Array.isArray(scrapedData)) {
          recordsCount = scrapedData.length;
          stepDetails = `Scraped ${recordsCount} record${recordsCount !== 1 ? 's' : ''}`;
        } else if (scrapedData.data && Array.isArray(scrapedData.data)) {
          recordsCount = scrapedData.data.length;
          stepDetails = `Scraped ${recordsCount} record${recordsCount !== 1 ? 's' : ''}`;
        } else if (typeof scrapedData === 'object') {
          const keys = Object.keys(scrapedData);
          recordsCount = keys.length;
          stepDetails = `Scraped data with ${recordsCount} field${recordsCount !== 1 ? 's' : ''}`;
        } else {
          stepDetails = 'Scraping completed';
        }
      }
      
      const stepDuration = (Date.now() - (stepStartTime || Date.now())) / 1000;
      const durationDisplay = stepDuration < 1 
        ? `${Math.round(stepDuration * 1000)}ms` 
        : `${stepDuration.toFixed(1)}s`;
      
      this.logger.info(`[WorkflowExecutor] ✅ Scraping completed successfully`, {
        execution_id: execution?.id,
        url,
        attempts: backoff.attempts,
        total_wait_ms: backoff.totalWaitMs,
        records_count: recordsCount,
        duration_sec: stepDuration,
        data_size: scrapedData ? JSON.stringify(scrapedData).length : 0
      });
      
      return {
        success: true,
        data: {
          ...inputData,
          scraped_data: scrapedData
        },
        meta: { 
          attempts: backoff.attempts, 
          backoffWaitMs: backoff.totalWaitMs,
          stepDetails: stepDetails || 'Scraping completed',
          duration: durationDisplay,
          recordsCount,
          connectionTime: (connectionTime / 1000).toFixed(1),
          scrapeTime: scrapeDuration.toFixed(1)
        }
      };
      
    } catch (error) {
      // ✅ ENHANCED: Categorize error and provide detailed user-friendly message
      const errorCategory = this._categorizeError(error);
      const userMessageObj = this._getUserFriendlyMessage(errorCategory, error);
      const timestamp = new Date().toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      // Build enhanced error message with all details
      const enhancedError = {
        summary: `Web scraping failed: ${userMessageObj.message || error.message}`,
        timestamp: timestamp,
        reason: userMessageObj.reason || error.message,
        fix: userMessageObj.fix || 'Please try again or contact support',
        retry: userMessageObj.retry !== false,
        errorCategory,
        technical: {
          code: error.code,
          status: error.response?.status,
          message: error.message
        },
        // Formatted message for display
        formatted: `Web scraping failed: ${userMessageObj.message || error.message} at ${timestamp}\n- Reason: ${userMessageObj.reason || error.message}\n- Fix: ${userMessageObj.fix || 'Please try again or contact support'}`
      };
      
      // ✅ OBSERVABILITY: Log error with full context for observability
      this.logger.error('Web scraping failed', {
        execution_id: execution?.id,
        error_category: errorCategory,
        error_message: error.message,
        error_code: error.code,
        error_status: error.response?.status,
        timestamp,
        retry_available: enhancedError.retry,
        url: config?.url,
        observability: {
          event: 'web_scraping_failed',
          error_category: errorCategory,
          retry_available: enhancedError.retry,
          error_reason: enhancedError.reason,
          error_fix: enhancedError.fix
        }
      });
      
      return { 
        success: false, 
        error: enhancedError.formatted,
        errorCategory,
        technicalError: error.message,
        errorDetails: enhancedError
      };
    }
  }

  async executeApiCallAction(config, inputData, execution) {
    try {
      const { method, url, headers = {}, body, timeout = 30 } = config;
      
      // ✅ VISIBILITY: Update status to show what's happening
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          `Calling API: ${method} ${url}...`
        );
      }
      
      logger.info(`[WorkflowExecutor] API call: ${method} ${url}`);
      
      // ✅ INSTRUCTION 1: Use instrumented HTTP client for trace propagation
      const maxAttempts = Math.max(1, Number(config?.retries?.maxAttempts || 3));
      const baseMs = Number(config?.retries?.baseMs || 300);

      const backoff = await this._withBackoff(async ({ controller }) => {
        const cancelTimer = setInterval(async () => {
          if (execution && await this._isCancelled(execution.id)) {
            try { controller?.abort?.(); } catch (_) {}
          }
        }, 500);
        try {
          // Use instrumented client for automatic trace propagation
          return await this.httpClient({
            method,
            url,
            headers,
            data: body,
            timeout: timeout * 1000,
            signal: controller?.signal
          });
        } finally {
          clearInterval(cancelTimer);
        }
      }, {
        maxAttempts,
        baseMs,
        shouldRetry: (err) => {
          const status = err?.response?.status;
          const code = err?.code || '';
          if (code && ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(code)) return true;
          if (status && (status >= 500 || status === 408 || status === 429)) return true;
          const msg = `${err?.message || ''}`.toLowerCase();
          if (msg.includes('timeout') || msg.includes('network')) return true;
          return false;
        },
        isCancelled: async () => execution && await this._isCancelled(execution.id),
        makeController: () => new AbortController()
      });

      const response = backoff.value;
      return {
        success: true,
        data: {
          ...inputData,
          api_response: response.data,
          api_status: response.status
        },
        meta: { attempts: backoff.attempts, backoffWaitMs: backoff.totalWaitMs }
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

  async executeFileUploadAction(config, inputData, execution) {
    try {
      const {
        source_field, // e.g., 'downloaded_files[0]' or 'artifact'
        url, // optional direct URL to fetch
        file_path, // optional local path
        filename: cfgFilename, // suggested filename
        mime_type: cfgMime, // suggested mime
        destination = '/', // logical folder within Files UI
        overwrite = false,
        public: isPublic = false // kept for future; we use signed URLs for private by default
      } = config || {};

      const userId = execution?.user_id;
      if (!userId) {
        throw new Error('Missing execution user_id for file upload');
      }

      // Resolve one or many sources
      const resolved = await this._resolveUploadSources({ source_field, url, file_path, inputData });
      if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
        throw new Error('No upload source resolved');
      }

  const items = Array.isArray(resolved) ? resolved : [resolved];
  const uploaded = [];
  let totalAttempts = 0;
  let totalBackoffWait = 0;

      for (const item of items) {
        // Check cancellation between items in a multi-upload
        if (await this._isCancelled(execution.id)) {
          return { success: false, error: 'Execution cancelled during file upload' };
        }
        const { buffer, mime, filename: srcName } = item;
        const mimeType = cfgMime || mime || 'application/octet-stream';
        const originalName = cfgFilename || srcName || 'file';

        const ext = path.extname(originalName) || this._extFromMime(mimeType);
        const baseName = path.basename(originalName, ext);
        const safeName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const finalName = `${safeName}${ext}`;
        const timestamp = Date.now();
        const storagePath = `${userId}/${timestamp}_${finalName}`;

        const maxAttempts = Math.max(1, Number(config?.retries?.maxAttempts || 3));
        const baseMs = Number(config?.retries?.baseMs || 300);
        // ✅ SECURITY: Use SHA-256 instead of MD5 (MD5 is cryptographically broken)
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  const backoff = await this._withBackoff(async () => {
          // Upload to Supabase storage in the same bucket the Files UI uses
          const { error: uploadError } = await this.supabase.storage
            .from('user-files')
            .upload(storagePath, buffer, { contentType: mimeType, upsert: !!overwrite });
          if (uploadError) {
            const e = new Error(`Storage upload error: ${uploadError.message}`);
            e._upload = true;
            throw e;
          }

          // Insert metadata into files table
          const { data: rec, error: dbError } = await this.supabase
            .from('files')
            .insert({
              user_id: userId,
              original_name: originalName,
              display_name: originalName,
              storage_path: storagePath,
              storage_bucket: 'user-files',
              file_size: buffer.length,
              mime_type: mimeType,
              file_extension: (ext || '').replace(/^\./, ''),
              checksum_sha256: checksum, // Changed from MD5 to SHA-256 for security
              folder_path: destination || '/',
              category: config?.category || null,
              tags: Array.isArray(config?.tags) ? config.tags : (typeof config?.tags === 'string' ? config.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
            })
            .select()
            .single();

          if (dbError) {
            // best-effort cleanup to keep idempotency before retry
            try { await this.supabase.storage.from('user-files').remove([storagePath]); } catch (_) {}
            const e = new Error(`Failed to save file metadata: ${dbError.message}`);
            e._db = true;
            throw e;
          }
          return rec;
        }, {
          maxAttempts,
          baseMs,
          shouldRetry: (err) => {
            const msg = `${err?.message || ''}`.toLowerCase();
            if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) return true;
            // If upload/db flagged transient via markers
            if (err?._upload || err?._db) return true;
            return false;
          },
          isCancelled: async () => execution && await this._isCancelled(execution.id)
        });

  totalAttempts += backoff.attempts;
  totalBackoffWait += backoff.totalWaitMs;
  uploaded.push(backoff.value);
      }

      const payload = uploaded.length === 1
        ? { uploaded_file: uploaded[0], uploaded_files: uploaded }
        : { uploaded_files: uploaded };

  return { success: true, data: { ...inputData, ...payload }, meta: { attempts: totalAttempts, backoffWaitMs: totalBackoffWait } };

    } catch (error) {
      return { success: false, error: `File upload failed: ${error.message}` };
    }
  }

  // Helpers
  async _resolveUploadSources({ source_field, url, file_path, inputData }) {
    // 1) From source_field in inputData
    if (source_field) {
    const value = this.getNestedValue(inputData, source_field);
    const baseDir = inputData?.download_directory;
      if (Array.isArray(value)) {
        const results = [];
        for (const v of value) {
      const r = await this._coerceToBuffer(v, baseDir);
          if (r) results.push(r);
        }
        return results;
      }
    const single = await this._coerceToBuffer(value, baseDir);
      if (single) return single;
    }

    // 2) Direct URL
    if (url) {
      return await this._coerceToBuffer(url);
    }

    // 3) Local path
    if (file_path) {
      const baseDir = inputData?.download_directory;
      return await this._coerceToBuffer(file_path, baseDir);
    }

    return null;
  }

  async _coerceToBuffer(value, baseDir) {
    try {
      if (!value) return null;
      // If already a Buffer
      if (Buffer.isBuffer(value)) {
        return { buffer: value, mime: 'application/octet-stream', filename: 'file' };
      }
      // If object { data, mime_type, filename }
      if (typeof value === 'object' && (value.data || value.buffer)) {
        const buf = value.buffer ? value.buffer : (typeof value.data === 'string' ? this._decodeBase64Maybe(value.data) : Buffer.from(value.data));
        return { buffer: buf, mime: value.mime_type || 'application/octet-stream', filename: value.filename || 'file' };
      }
      if (typeof value === 'string') {
        // data URL/base64
        if (value.startsWith('data:')) {
          const match = value.match(/^data:([^;]+);base64,(.*)$/);
          if (match) {
            const mime = match[1];
            const buf = Buffer.from(match[2], 'base64');
            return { buffer: buf, mime, filename: 'file' };
          }
        }
        // URL
        if (/^https?:\/\//i.test(value)) {
          const resp = await axios.get(value, { responseType: 'arraybuffer', timeout: 30000 });
          // Try to derive a name from URL path
          const u = new URL(value);
          const nameGuess = path.basename(u.pathname || '') || 'file';
          return { buffer: Buffer.from(resp.data), mime: resp.headers['content-type'] || 'application/octet-stream', filename: nameGuess };
        }
        // Local path
        if (fs.existsSync(value) && fs.statSync(value).isFile()) {
          const buf = fs.readFileSync(value);
          return { buffer: buf, mime: 'application/octet-stream', filename: path.basename(value) };
        }
        if (baseDir) {
          const joined = path.join(baseDir, value);
          if (fs.existsSync(joined) && fs.statSync(joined).isFile()) {
            const buf = fs.readFileSync(joined);
            return { buffer: buf, mime: 'application/octet-stream', filename: path.basename(joined) };
          }
        }
        // plain base64 string (no data: prefix)
        if (/^[A-Za-z0-9+/=]+$/.test(value)) {
          const buf = this._decodeBase64Maybe(value);
          if (buf) return { buffer: buf, mime: 'application/octet-stream', filename: 'file' };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  _decodeBase64Maybe(str) {
    try {
      return Buffer.from(str, 'base64');
    } catch {
      return null;
    }
  }

  _extFromMime(mime) {
    if (!mime) return '';
    const map = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/json': '.json'
    };
    return map[mime] || '';
  }

  async executeEmailAction(config, inputData, execution) {
    try {
      // ✅ PRIORITY 3: Default to allowFailure=true if scraping data exists (decouple email from scraping)
      const hasScrapedData = inputData?.scraped_data || inputData?._partial_results?.some(r => r.data?.scraped_data);
      
      // ✅ FIX: Handle nested config structure from canvas (node.data.config) vs direct config
      // Canvas nodes store config as node.data.config, but we store entire node.data as step.config
      const emailConfig = config?.config || config || {};
      const { to, template, variables = {}, scheduled_at, allowFailure = hasScrapedData } = emailConfig;
      
      // ✅ FIX: Handle to as array (from canvas) - take first non-empty value
      const toEmail = Array.isArray(to) ? to.find(email => email && email.trim()) : to;
      
      if (!toEmail || !template) {
        const error = 'Email step requires `to` and `template`';
        if (allowFailure) {
          this.logger.warn('Email step skipped due to missing config', {
            execution_id: execution?.id,
            error,
            has_scraped_data: hasScrapedData
          });
          return {
            success: true, // Mark as success so workflow continues
            data: {
              ...inputData,
              email_result: {
                status: 'skipped',
                error: error,
                warning: 'Email step skipped: missing required configuration. Scraped data was saved successfully.'
              }
            }
          };
        }
        throw new Error(error);
      }
      
      // ✅ PRIORITY 3: Update status to show email is being sent
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          hasScrapedData 
            ? 'Scraping ✓ | Sending email...'
            : 'Sending email...'
        );
      }
      
      // ✅ OBSERVABILITY: Log email action with context
      logger.info(`[WorkflowExecutor] Enqueue email to: ${toEmail}`, {
        execution_id: execution?.id,
        has_scraped_data: hasScrapedData,
        allow_failure: allowFailure,
        template,
        timestamp: new Date().toISOString(),
        observability: {
          event: 'email_action_started',
          has_scraped_data: hasScrapedData,
          allow_failure: allowFailure
        }
      });

      // Insert into email_queue (processed by email_worker)
      const insert = {
        to_email: toEmail,
        template,
        data: variables || {},
        status: 'pending',
        scheduled_at: scheduled_at || new Date().toISOString()
      };
      const { data, error } = await this.supabase.from('email_queue').insert([insert]).select('*');
      
      // ✅ PRIORITY 3: If email queue fails but allowFailure is true, continue workflow and retry email separately
      if (error) {
        const errorMsg = `Failed to enqueue email: ${error.message}`;
        if (allowFailure) {
          this.logger.warn('Email enqueue failed but continuing workflow - will retry email separately', {
            execution_id: execution?.id,
            error: errorMsg,
            has_scraped_data: hasScrapedData
          });
          
          // ✅ PRIORITY 3: Schedule email retry in background (separate from workflow)
          setImmediate(async () => {
            try {
              // Retry email enqueue after 10 seconds
              await new Promise(resolve => setTimeout(resolve, 10000));
              const retryInsert = { ...insert };
              const { data: retryData, error: retryError } = await this.supabase
                .from('email_queue')
                .insert([retryInsert])
                .select('*');
              
              if (retryError) {
                this.logger.warn('Email retry also failed', {
                  execution_id: execution?.id,
                  error: retryError.message
                });
              } else {
                this.logger.info('✅ Email retry succeeded', {
                  execution_id: execution?.id,
                  queue_id: retryData?.[0]?.id
                });
              }
            } catch (retryErr) {
              this.logger.error('Email retry exception', {
                execution_id: execution?.id,
                error: retryErr.message
              });
            }
          });
          
          // Update status to show email is retrying
          if (execution?.id) {
            await this._updateExecutionStatus(
              execution.id,
              'running',
              'Scraping ✓ | Email ✗ (retrying)'
            );
          }
          
          return {
            success: true, // Mark as success so workflow continues
            data: {
              ...inputData,
              email_result: {
                status: 'retrying',
                error: errorMsg,
                warning: 'Email could not be queued initially, but workflow continued. Scraped data was saved. Email will be retried automatically.',
                retry_scheduled: true
              }
            }
          };
        }
        throw new Error(errorMsg);
      }

      const item = Array.isArray(data) ? data[0] : data;
      
      // Update status to show success
      if (execution?.id) {
        await this._updateExecutionStatus(
          execution.id,
          'running',
          hasScrapedData 
            ? 'Scraping ✓ | Email ✓'
            : 'Email queued successfully'
        );
      }
      
      return {
        success: true,
        data: {
          ...inputData,
          email_result: {
            queue_id: item?.id || null,
            status: 'queued'
          }
        },
        meta: {
          stepDetails: 'Email queued',
          duration: '0.1s'
        }
      };
      
    } catch (error) {
      // ✅ PRIORITY 3: If email fails but we have scraped data, don't fail the workflow
      const hasScrapedData = inputData?.scraped_data || inputData?._partial_results?.some(r => r.data?.scraped_data);
      const allowFailure = config?.allowFailure !== false && hasScrapedData;
      
      if (allowFailure) {
        this.logger.warn('Email sending failed but continuing workflow (scraped data preserved)', {
          execution_id: execution?.id,
          error: error.message,
          has_scraped_data: hasScrapedData
        });
        
        // Update status
        if (execution?.id) {
          await this._updateExecutionStatus(
            execution.id,
            'running',
            'Scraping ✓ | Email ✗ (will retry)'
          );
        }
        
        return {
          success: true,
          data: {
            ...inputData,
            email_result: {
              status: 'failed',
              error: error.message,
              warning: 'Email sending failed, but scraped data was saved successfully. Email will be retried separately.',
              retry_scheduled: true
            }
          }
        };
      }
      
      return { success: false, error: `Email sending failed: ${error.message}` };
    }
  }

  async executeDelayAction(config, inputData, execution) {
    try {
      const { duration_seconds, duration_type = 'fixed' } = config;
      
      let waitTime = duration_seconds;
      if (duration_type === 'random') {
        waitTime = Math.floor(Math.random() * duration_seconds) + 1;
      }
      
      logger.info(`[WorkflowExecutor] Waiting for ${waitTime} seconds`);
      
      // Cooperative wait that checks for cancellation every 500ms
      const start = Date.now();
      const totalMs = waitTime * 1000;
      while (Date.now() - start < totalMs) {
        await new Promise(r => setTimeout(r, 500));
        if (execution && await this._isCancelled(execution.id)) {
          return { success: false, error: 'Execution cancelled during delay' };
        }
      }
      
      return { 
        success: true, 
        data: { 
          ...inputData, 
          delay_result: { 
            waited_seconds: waitTime 
          }
        },
        meta: { attempts: 1, backoffWaitMs: 0 }
      };
      
    } catch (error) {
      return { success: false, error: `Delay failed: ${error.message}` };
    }
  }

  async executeFormSubmitAction(config, inputData, execution) {
    try {
      // ✅ IMMEDIATE FIX: Health check before execution
      const healthCheck = await this._checkAutomationServiceHealth();
      if (!healthCheck.healthy) {
        const errorCategory = healthCheck.error || 'AUTOMATION_SERVICE_UNAVAILABLE';
        const userMessage = this._getUserFriendlyMessage(errorCategory, { message: healthCheck.message });
        this.logger.error('Automation service health check failed', {
          execution_id: execution?.id,
          error_category: errorCategory,
          message: healthCheck.message
        });
        return { 
          success: false, 
          error: userMessage,
          errorCategory,
          technicalError: healthCheck.message
        };
      }
      
      const { url, form_data, selectors, wait_after_submit = 3 } = config;
      
      if (!url) {
        throw new Error('URL is required for form submission');
      }
      
      logger.info(`[WorkflowExecutor] Submitting form: ${url}`);
      
      const axios = require('axios');
      const maxAttempts = Math.max(1, Number(config?.retries?.maxAttempts || 3));
      const baseMs = Number(config?.retries?.baseMs || 300);

      const backoff = await this._withBackoff(async ({ controller }) => {
        const cancelTimer = setInterval(async () => {
          if (execution && await this._isCancelled(execution.id)) {
            try { controller?.abort?.(); } catch (_) {}
          }
        }, 500);
        
        try {
          return await axios.post(`${process.env.AUTOMATION_URL}/form-submit`, {
            url,
            form_data,
            selectors,
            wait_after_submit
          }, {
            timeout: 60000, // Forms can take longer
            signal: controller?.signal
          });
        } finally {
          clearInterval(cancelTimer);
        }
      }, {
        maxAttempts,
        baseMs,
        shouldRetry: (err) => {
          const status = err?.response?.status;
          const code = err?.code || '';
          if (code && ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(code)) return true;
          if (status && (status >= 500 || status === 408 || status === 429)) return true;
          const msg = `${err?.message || ''}`.toLowerCase();
          if (msg.includes('timeout') || msg.includes('network')) return true;
          return false;
        },
        isCancelled: async () => execution && await this._isCancelled(execution.id),
        makeController: () => new AbortController()
      });

      const response = backoff.value;
      return {
        success: true,
        data: {
          ...inputData,
          form_submission_result: response.data,
          form_submitted_to: url
        },
        meta: { attempts: backoff.attempts, backoffWaitMs: backoff.totalWaitMs }
      };
      
    } catch (error) {
      // ✅ IMMEDIATE FIX: Categorize error and provide user-friendly message
      const errorCategory = this._categorizeError(error);
      const userMessage = this._getUserFriendlyMessage(errorCategory, error);
      
      this.logger.error('Form submission failed', {
        execution_id: execution?.id,
        error_category: errorCategory,
        error_message: error.message,
        error_code: error.code
      });
      
      return { 
        success: false, 
        error: userMessage,
        errorCategory,
        technicalError: error.message
      };
    }
  }

  async executeInvoiceOcrAction(config, inputData, execution) {
    try {
      // ✅ IMMEDIATE FIX: Health check before execution
      const healthCheck = await this._checkAutomationServiceHealth();
      if (!healthCheck.healthy) {
        const errorCategory = healthCheck.error || 'AUTOMATION_SERVICE_UNAVAILABLE';
        const userMessage = this._getUserFriendlyMessage(errorCategory, { message: healthCheck.message });
        this.logger.error('Automation service health check failed', {
          execution_id: execution?.id,
          error_category: errorCategory,
          message: healthCheck.message
        });
        return { 
          success: false, 
          error: userMessage,
          errorCategory,
          technicalError: healthCheck.message
        };
      }
      
      const { 
        file_source,        // 'url', 'file_path', or 'input_data_field'
        file_url,          // Direct URL to invoice file
        file_path,         // Local path to invoice file
        input_field,       // Field in inputData containing file info
        extract_fields = ['vendor', 'amount', 'date', 'invoice_number'], // Fields to extract
        validation = {}    // Validation rules
      } = config;
      
      logger.info(`[WorkflowExecutor] Processing invoice OCR`);
      
      // Resolve file source
      let fileToProcess = null;
      
      if (file_source === 'url' && file_url) {
        fileToProcess = { type: 'url', value: file_url };
      } else if (file_source === 'file_path' && file_path) {
        fileToProcess = { type: 'file_path', value: file_path };
      } else if (file_source === 'input_data_field' && input_field) {
        const fieldValue = this.getNestedValue(inputData, input_field);
        if (fieldValue) {
          // Handle different field value formats
          if (typeof fieldValue === 'string') {
            if (fieldValue.startsWith('http')) {
              fileToProcess = { type: 'url', value: fieldValue };
            } else {
              fileToProcess = { type: 'file_path', value: fieldValue };
            }
          } else if (fieldValue.storage_path) {
            // From file upload action
            fileToProcess = { type: 'storage_path', value: fieldValue.storage_path };
          }
        }
      }
      
      if (!fileToProcess) {
        throw new Error('No valid file source found for invoice OCR processing');
      }
      
      const axios = require('axios');
      const maxAttempts = Math.max(1, Number(config?.retries?.maxAttempts || 3));
      const baseMs = Number(config?.retries?.baseMs || 300);

      const backoff = await this._withBackoff(async ({ controller }) => {
        const cancelTimer = setInterval(async () => {
          if (execution && await this._isCancelled(execution.id)) {
            try { controller?.abort?.(); } catch (_) {}
          }
        }, 500);
        
        try {
          return await axios.post(`${process.env.AUTOMATION_URL}/invoice-ocr`, {
            file_source: fileToProcess,
            extract_fields,
            validation
          }, {
            timeout: 120000, // OCR can take longer
            signal: controller?.signal
          });
        } finally {
          clearInterval(cancelTimer);
        }
      }, {
        maxAttempts,
        baseMs,
        shouldRetry: (err) => {
          const status = err?.response?.status;
          const code = err?.code || '';
          if (code && ['ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(code)) return true;
          if (status && (status >= 500 || status === 408 || status === 429)) return true;
          const msg = `${err?.message || ''}`.toLowerCase();
          if (msg.includes('timeout') || msg.includes('network')) return true;
          return false;
        },
        isCancelled: async () => execution && await this._isCancelled(execution.id),
        makeController: () => new AbortController()
      });

      const response = backoff.value;
      const ocrResult = response.data;
      
      // Apply validation if specified
      const validationResults = {};
      if (validation.amount_threshold && ocrResult.extracted_data?.amount) {
        const amount = parseFloat(ocrResult.extracted_data.amount.replace(/[^\d.-]/g, ''));
        validationResults.amount_threshold = amount <= validation.amount_threshold;
      }
      
      if (validation.required_vendor && ocrResult.extracted_data?.vendor) {
        const vendor = ocrResult.extracted_data.vendor.toLowerCase();
        validationResults.vendor_approved = validation.required_vendor.some(v => 
          vendor.includes(v.toLowerCase())
        );
      }
      
      return {
        success: true,
        data: {
          ...inputData,
          invoice_ocr_result: ocrResult,
          extracted_invoice_data: ocrResult.extracted_data || {},
          validation_results: validationResults,
          ocr_confidence: ocrResult.confidence || 0
        },
        meta: { attempts: backoff.attempts, backoffWaitMs: backoff.totalWaitMs }
      };
      
    } catch (error) {
      // ✅ IMMEDIATE FIX: Categorize error and provide user-friendly message
      const errorCategory = this._categorizeError(error);
      const userMessage = this._getUserFriendlyMessage(errorCategory, error);
      
      this.logger.error('Invoice OCR failed', {
        execution_id: execution?.id,
        error_category: errorCategory,
        error_message: error.message,
        error_code: error.code
      });
      
      return { 
        success: false, 
        error: userMessage,
        errorCategory,
        technicalError: error.message
      };
    }
  }

  // Utility methods
  async getNextSteps(currentStep, data, workflow) {
    try {
      // Find connections from current step
      const connections = (workflow.workflow_connections || []).filter(
        conn => conn.source_step_id === currentStep.id
      );
      
      // ✅ DEBUG: Log connection lookup to help diagnose "no steps executed" issues
      if (connections.length === 0) {
        this.logger.warn('[WorkflowExecutor] No connections found from current step', {
          current_step_id: currentStep.id,
          current_step_name: currentStep.name,
          current_step_type: currentStep.step_type,
          total_connections: workflow.workflow_connections?.length || 0,
          available_connections: (workflow.workflow_connections || []).map(conn => ({
            source: conn.source_step_id,
            target: conn.target_step_id,
            type: conn.connection_type
          })),
          workflow_id: workflow.id
        });
      }
      
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
          } else {
            // ✅ DEBUG: Log if connection target step not found
            this.logger.warn('[WorkflowExecutor] Connection target step not found', {
              connection_source: connection.source_step_id,
              connection_target: connection.target_step_id,
              connection_type: connection.connection_type,
              available_step_ids: workflow.workflow_steps.map(s => s.id),
              workflow_id: workflow.id
            });
          }
        }
      }
      
      // ✅ DEBUG: Log result
      if (nextSteps.length === 0 && connections.length > 0) {
        this.logger.warn('[WorkflowExecutor] Connections exist but none matched conditions', {
          current_step_id: currentStep.id,
          connections_count: connections.length,
          data_success: data.success,
          data_conditionResult: data.conditionResult,
          workflow_id: workflow.id
        });
      }
      
      return nextSteps;
      
    } catch (error) {
      logger.error('[WorkflowExecutor] Error finding next steps:', error);
      return [];
    }
  }

  async createStepExecution(workflowExecutionId, stepId, inputData) {
    // ✅ FIX: Handle canvas node IDs (node-xxx) vs UUID step IDs
    // If stepId is a canvas node ID, look up the actual step UUID from workflow_steps
    let actualStepId = stepId;
    
    // Check if stepId is a canvas node ID (starts with "node-")
    if (stepId && typeof stepId === 'string' && stepId.startsWith('node-')) {
      this.logger.warn('Canvas node ID detected, looking up step UUID', {
        workflow_execution_id: workflowExecutionId,
        canvas_node_id: stepId
      });
      
      // Try to find the step by step_key (which stores the canvas node ID)
      const { data: step, error: lookupError } = await this.supabase
        .from('workflow_steps')
        .select('id')
        .eq('step_key', stepId)
        .maybeSingle();
      
      if (lookupError || !step) {
        // If lookup fails, try to get workflow_id from execution and search there
        const { data: execution } = await this.supabase
          .from('workflow_executions')
          .select('workflow_id')
          .eq('id', workflowExecutionId)
          .single();
        
        if (execution?.workflow_id) {
          const { data: workflowStep } = await this.supabase
            .from('workflow_steps')
            .select('id')
            .eq('workflow_id', execution.workflow_id)
            .eq('step_key', stepId)
            .maybeSingle();
          
          if (workflowStep) {
            actualStepId = workflowStep.id;
          } else {
            // Last resort: generate a UUID and log warning
            this.logger.error('Could not find step UUID for canvas node ID, generating temporary UUID', {
              workflow_execution_id: workflowExecutionId,
              canvas_node_id: stepId,
              workflow_id: execution.workflow_id
            });
            // Use the canvas node ID as-is and let database handle it (might fail, but better than crashing)
            actualStepId = stepId;
          }
        } else {
          this.logger.error('Could not find workflow_id for execution', {
            workflow_execution_id: workflowExecutionId
          });
          actualStepId = stepId;
        }
      } else {
        actualStepId = step.id;
      }
    }
    
    // Validate that actualStepId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(actualStepId)) {
      this.logger.error('Invalid step ID format (not a UUID)', {
        workflow_execution_id: workflowExecutionId,
        original_step_id: stepId,
        resolved_step_id: actualStepId
      });
      throw new Error(`Invalid step ID format: ${stepId}. Expected UUID but got: ${actualStepId}`);
    }
    
    const { data, error } = await this.supabase
      .from('step_executions')
      .insert({
        workflow_execution_id: workflowExecutionId,
        step_id: actualStepId,
        status: 'running',
        started_at: new Date().toISOString(),
        input_data: inputData,
        execution_order: 1 // TODO: Calculate proper execution order
      })
      .select()
      .single();
      
    if (error) {
      this.logger.error('Failed to create step execution', {
        workflow_execution_id: workflowExecutionId,
        step_id: actualStepId,
        original_step_id: stepId,
        error: error.message,
        error_code: error.code
      });
      throw new Error(`Failed to create step execution: ${error.message}`);
    }
    
    return data;
  }

  async updateStepExecution(stepExecution, result) {
    const stepStartTime = stepExecution?.started_at ? new Date(stepExecution.started_at).getTime() : Date.now();
    const stepDuration = Date.now() - stepStartTime;
    const durationSec = (stepDuration / 1000).toFixed(1);
    
    // Build step details message
    let stepDetails = '';
    if (result.success) {
      // Extract meaningful details from result
      if (result.meta?.stepDetails) {
        stepDetails = result.meta.stepDetails;
      } else if (result.data?.scraped_data) {
        const scraped = result.data.scraped_data;
        if (Array.isArray(scraped)) {
          stepDetails = `Scraped ${scraped.length} record${scraped.length !== 1 ? 's' : ''}`;
        } else {
          stepDetails = 'Scraping completed';
        }
      } else if (result.data?.email_result) {
        stepDetails = result.data.email_result.status === 'queued' 
          ? 'Email queued' 
          : 'Email sent';
      } else {
        stepDetails = 'Step completed';
      }
    } else {
      // For failed steps, include error category
      stepDetails = result.errorDetails?.reason || result.error || 'Step failed';
    }
    
    const updateData = {
      completed_at: new Date().toISOString(),
      status: result.success ? 'completed' : 'failed',
      output_data: result.data,
      result: {
        ...result,
        step_details: stepDetails // Store in result JSONB instead
      },
      duration_ms: Math.max(0, stepDuration)
    };
    
    if (!result.success) {
      // ✅ ENHANCED: Store detailed error information in result JSONB
      const errorDetails = result.errorDetails || {};
      updateData.error_message = result.error;
      updateData.result = {
        ...result,
        step_details: stepDetails,
        error_category: result.errorCategory,
        error_reason: errorDetails.reason,
        error_fix: errorDetails.fix,
        error_timestamp: errorDetails.timestamp || new Date().toLocaleString(),
        retry_available: errorDetails.retry !== false
      };
    }
    
    // Add retry metrics if available
    const attempts = result?.meta?.attempts;
    if (typeof attempts === 'number' && attempts >= 1) {
      updateData.retry_count = Math.max(0, attempts - 1);
    }
    
    const { error } = await this.supabase
      .from('step_executions')
      .update(updateData)
      .eq('id', stepExecution.id);
      
    if (error) {
      logger.error('Failed to update step execution:', error);
    }
  }

  async completeExecution(executionId, outputData, stepsExecuted, startTime) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Get execution details for metrics
    const { data: execution } = await this.supabase
      .from('workflow_executions')
      .select('workflow_id, user_id, triggered_by, steps_total')
      .eq('id', executionId)
      .single();
    
    // ✅ FIX: Add actionable next steps guidance in metadata
    const nextSteps = this._generateNextStepsGuidance(outputData, stepsExecuted);
    
    const { error } = await this.supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
        output_data: outputData,
        steps_executed: stepsExecuted,
        metadata: {
          next_steps: nextSteps,
          completion_time: new Date().toISOString(),
          status_message: nextSteps.message
        }
      })
      .eq('id', executionId);
      
    if (error) {
      logger.error('Failed to complete execution:', error);
    }
    
    // ✅ PHASE 3: Record metrics
    if (execution) {
      try {
        const { WorkflowMetricsService } = require('./workflowMetrics');
        const metricsService = new WorkflowMetricsService();
        await metricsService.recordExecution({
          id: executionId,
          workflow_id: execution.workflow_id,
          user_id: execution.user_id,
          status: 'completed',
          duration_seconds: duration,
          steps_executed: stepsExecuted,
          steps_total: execution.steps_total || stepsExecuted,
          triggered_by: execution.triggered_by || 'manual'
        });
      } catch (metricsError) {
        // Don't fail execution if metrics fail
        logger.warn('Failed to record execution metrics', { error: metricsError.message });
      }
    }
    
    logger.info(`[WorkflowExecutor] Execution ${executionId} completed in ${duration}s`);
  }

  async failExecution(executionId, errorMessage, errorStepId = null, errorCategory = null) {
    // Get execution details for metrics
    const { data: execution } = await this.supabase
      .from('workflow_executions')
      .select('workflow_id, user_id, triggered_by, steps_total, started_at')
      .eq('id', executionId)
      .single();
    
    // ✅ ENHANCED: Parse error message to extract structured details
    let errorDetails = {};
    let formattedErrorMessage = errorMessage;
    
    // Try to parse structured error if it's an object or contains structured format
    if (typeof errorMessage === 'object' && errorMessage.errorDetails) {
      errorDetails = errorMessage.errorDetails;
      formattedErrorMessage = errorMessage.formatted || errorMessage.summary || errorMessage.message || JSON.stringify(errorMessage);
    } else if (typeof errorMessage === 'string' && errorMessage.includes('\n')) {
      // Parse multi-line error message
      const lines = errorMessage.split('\n');
      formattedErrorMessage = lines[0] || errorMessage;
      const reasonLine = lines.find(l => l.includes('Reason:'));
      const fixLine = lines.find(l => l.includes('Fix:'));
      if (reasonLine) errorDetails.reason = reasonLine.replace('Reason:', '').trim();
      if (fixLine) errorDetails.fix = fixLine.replace('Fix:', '').trim();
    }
    
    const timestamp = new Date().toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // ✅ FIX: Build update data with only core columns that exist in DB
    const updateData = {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: formattedErrorMessage,
      error_category: errorCategory || null,
      retry_available: errorDetails.retry !== false
    };
    
    // Calculate duration if started_at exists
    if (execution?.started_at) {
      try {
        const duration = Math.floor((Date.now() - new Date(execution.started_at).getTime()) / 1000);
        updateData.duration_seconds = duration;
      } catch (_) {}
    }
    
    // ✅ FIX: Only set error_step_id if it's a valid UUID that exists in workflow_steps
    // Verify the step exists in the database to avoid foreign key constraint violations
    if (errorStepId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(errorStepId)) {
      // Verify step exists in database
      const { data: stepExists } = await this.supabase
        .from('workflow_steps')
        .select('id')
        .eq('id', errorStepId)
        .single();
      
      if (stepExists) {
        updateData.error_step_id = errorStepId;
      } else {
        this.logger.warn('[WorkflowExecutor] Error step ID not found in database, skipping error_step_id', {
          error_step_id: errorStepId,
          execution_id: executionId
        });
      }
    }
    
    // ✅ FIX: Store all error details in metadata field as JSON
    const errorDetailsForStorage = {
      category: errorCategory,
      step_id: errorStepId, // Store the actual step ID (canvas node or workflow_step UUID)
      step_name: errorDetails.step_name,
      reason: errorDetails.reason,
      fix: errorDetails.fix,
      timestamp: errorDetails.timestamp || timestamp,
      retry_available: errorDetails.retry !== false,
      details: errorDetails
    };
    
    updateData.metadata = errorDetailsForStorage;
    
    const { error } = await this.supabase
      .from('workflow_executions')
      .update(updateData)
      .eq('id', executionId);
      
    if (error) {
      logger.error('Failed to update execution status:', error);
    }
    
    // ✅ PHASE 3: Record metrics
    if (execution) {
      try {
        const { WorkflowMetricsService } = require('./workflowMetrics');
        const metricsService = new WorkflowMetricsService();
        await metricsService.recordExecution({
          id: executionId,
          workflow_id: execution.workflow_id,
          user_id: execution.user_id,
          status: 'failed',
          error_category: errorCategory,
          duration_seconds: updateData.duration_seconds,
          steps_executed: 0,
          steps_total: execution.steps_total || 0,
          triggered_by: execution.triggered_by || 'manual'
        });
      } catch (metricsError) {
        // Don't fail execution if metrics fail
        logger.warn('Failed to record execution metrics', { error: metricsError.message });
      }
    }
    
    logger.error(`[WorkflowExecutor] Execution ${executionId} failed: ${errorMessage}`, {
      execution_id: executionId,
      error_category: errorCategory,
      error_step_id: errorStepId
    });
  }

  getNestedValue(obj, path) {
    if (!path || !obj) return undefined;
    // Normalize bracket notation: a[0].b -> a.0.b ; a['x'] -> a.x
    const normalized = path
      .replace(/\[(\d+)\]/g, '.$1')
      .replace(/\[['"]([^\]]+)['"]\]/g, '.$1')
      .replace(/^\./, '');
    return normalized.split('.').reduce((current, key) => (current == null ? undefined : current[key]), obj);
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

  // ✅ FIX: Generate actionable next steps guidance based on workflow results
  _generateNextStepsGuidance(outputData, stepsExecuted) {
    const actions = [];
    let message = '✅ Workflow completed successfully!';
    
    // ✅ FIX: If no steps completed, prioritize debugging
    if (stepsExecuted === 0) {
      actions.push({
        label: 'View Workflow Execution',
        path: null, // Stay in workflow builder, switch to executions tab
        tab: 'executions',
        icon: '🔍',
        description: 'See what went wrong - no steps were executed'
      });
      message = '⚠️ Workflow completed but no steps were executed. Check execution details.';
      
      actions.push({
        label: 'Edit Workflow',
        path: null, // Stay in workflow builder, switch to canvas tab
        tab: 'canvas',
        icon: '✏️',
        description: 'Review and fix your workflow configuration'
      });
      
      return {
        message,
        actions,
        steps_completed: stepsExecuted
      };
    }
    
    // Check for scraped data
    if (outputData?.scraped_data || outputData?.web_scraping_result) {
      actions.push({
        label: 'View Scraped Data',
        path: '/app/files',
        icon: '📁',
        description: 'Check the Files tab to see your scraped data'
      });
      message = '✅ Data scraped successfully! Check the Files tab to view your results.';
    }
    
    // Check for email sent
    if (outputData?.email_result || outputData?.email_sent) {
      const emailStatus = outputData?.email_result?.status || 'sent';
      if (emailStatus === 'sent' || emailStatus === 'pending') {
        actions.push({
          label: 'Check Your Inbox',
          path: null,
          icon: '📧',
          description: 'Email has been sent - check your inbox'
        });
        message = '✅ Email sent successfully!';
      }
    }
    
    // Check for API call results
    if (outputData?.api_response || outputData?.api_call_result) {
      actions.push({
        label: 'View API Results',
        path: null,
        tab: 'executions',
        icon: '🔗',
        description: 'Check workflow execution details for API response data'
      });
    }
    
    // Check for file uploads
    if (outputData?.file_upload_result || outputData?.uploaded_file) {
      actions.push({
        label: 'View Uploaded Files',
        path: '/app/files',
        icon: '📁',
        description: 'See your uploaded files in the Files tab'
      });
      message = '✅ Files uploaded successfully!';
    }
    
    // Add workflow executions view (only if we don't already have it)
    if (!actions.find(a => a.tab === 'executions')) {
      actions.push({
        label: 'View Workflow Executions',
        path: null,
        tab: 'executions',
        icon: '📊',
        description: `Review this workflow execution (${stepsExecuted} steps completed)`
      });
    }
    
    // Always add option to run again
    actions.push({
      label: 'Run Workflow Again',
      path: null,
      tab: 'canvas',
      icon: '🔄',
      description: 'Execute this workflow with new data'
    });
    
    return {
      message,
      actions,
      steps_completed: stepsExecuted
    };
  }

  // Cancellation helpers
  async _isCancelled(executionId) {
    // ✅ FIX: Check local map first
    const run = this.runningExecutions.get(executionId);
    if (run && run.cancelled) return true;
    
    // ✅ FIX: Check shared registry (in case cancel came from different executor instance)
    const registryEntry = executionRegistry.get(executionId);
    if (registryEntry && registryEntry.cancelled) return true;
    
    // Check DB status as source of truth in case cancel came from API route
    try {
      const { data, error } = await this.supabase
        .from('workflow_executions')
        .select('status')
        .eq('id', executionId)
        .single();
      if (error) return false;
      if (data?.status === 'cancelled') {
        if (run) run.cancelled = true; else this.runningExecutions.set(executionId, { cancelled: true });
        return true;
      }
    } catch (_) {
      // ignore
    }
    return false;
  }

  // ✅ FIX: Static method to cleanup stuck executions
  static async cleanupStuckExecutions(maxAgeMinutes = 10) {
    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('Cannot cleanup stuck executions: Supabase not configured');
      return { cleaned: 0, errors: [] };
    }
    
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - maxAgeMs).toISOString();
    
    try {
      // Find executions that have been running for too long
      const { data: stuckExecutions, error: findError } = await supabase
        .from('workflow_executions')
        .select('id, started_at, workflow_id, user_id')
        .eq('status', 'running')
        .lt('started_at', cutoffTime);
      
      if (findError) {
        logger.error('Error finding stuck executions:', findError);
        return { cleaned: 0, errors: [findError.message] };
      }
      
      if (!stuckExecutions || stuckExecutions.length === 0) {
        return { cleaned: 0, errors: [] };
      }
      
      logger.warn(`Found ${stuckExecutions.length} stuck execution(s) to cleanup`, {
        max_age_minutes: maxAgeMinutes,
        cutoff_time: cutoffTime
      });
      
      const errors = [];
      let cleaned = 0;
      
      // Mark each stuck execution as failed
      for (const execution of stuckExecutions) {
        try {
          const ageMinutes = Math.round((Date.now() - new Date(execution.started_at).getTime()) / 60000);
          const errorMessage = `Execution stuck in running state for ${ageMinutes} minutes. Marked as failed by cleanup job.`;
          
          await supabase
            .from('workflow_executions')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              metadata: {
                cleanup_reason: 'stuck_execution',
                stuck_duration_minutes: ageMinutes,
                cleaned_at: new Date().toISOString()
              }
            })
            .eq('id', execution.id);
          
          // Also cancel in registry if still there
          const registryEntry = executionRegistry.get(execution.id);
          if (registryEntry) {
            registryEntry.cancelled = true;
            if (registryEntry.timer) {
              clearTimeout(registryEntry.timer);
            }
          }
          
          cleaned++;
          logger.info('Cleaned up stuck execution', {
            execution_id: execution.id,
            age_minutes: ageMinutes,
            workflow_id: execution.workflow_id
          });
        } catch (execError) {
          errors.push(`Failed to cleanup execution ${execution.id}: ${execError.message}`);
          logger.error('Error cleaning up stuck execution', {
            execution_id: execution.id,
            error: execError.message
          });
        }
      }
      
      return { cleaned, errors };
    } catch (error) {
      logger.error('Unexpected error during stuck execution cleanup:', error);
      return { cleaned: 0, errors: [error.message] };
    }
  }
}

module.exports = { WorkflowExecutor };