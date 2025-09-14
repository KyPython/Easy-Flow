const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

class WorkflowExecutor {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    this.supabase = (url && key) ? createClient(url, key) : null;
    if (!this.supabase) {
      console.warn('[WorkflowExecutor] Supabase not configured (missing SUPABASE_URL or key). Some features will be disabled.');
    }
  // Track running executions to check for cancellation
  this.runningExecutions = new Map(); // executionId -> { cancelled: boolean }
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
      makeController // optional: () => AbortController
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
        const retry = await shouldRetry(err, attempt);
        if (!retry || attempt === maxAttempts) {
          throw err;
        }
        // wait with backoff, but break early if cancelled
        const wait = this._calcBackoff(attempt, baseMs, maxMs, jitterRatio);
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
        totalWaitMs += wait;
      } finally {
        // best-effort: abort controller on failure path if still active
        try { controller?.abort?.(); } catch (_) {}
      }
    }
    throw lastErr || new Error('Unknown backoff error');
  }

  async startExecution(config) {
    const { workflowId, userId, triggeredBy = 'manual', triggerData = {}, inputData = {} } = config;
    
    try {
      console.log(`[WorkflowExecutor] Starting execution for workflow ${workflowId}`);
      if (!this.supabase) {
        throw new Error('Workflow not found: Database unavailable');
      }
      
      // Get workflow definition - first try to find the workflow
      let workflow, workflowError;
      
      try {
        const result = await this.supabase
          .from('workflows')
          .select(`
            *,
            workflow_steps(*),
            workflow_connections(*)
          `)
          .eq('id', workflowId)
          .maybeSingle();

        if (result.error) {
          workflowError = result.error;
          workflow = null;
        } else if (!result.data) {
          workflowError = { message: 'No workflow found with this ID' };
          workflow = null;
        } else {
          workflow = result.data;
        }
      } catch (queryError) {
        console.error(`[WorkflowExecutor] Database query error:`, queryError);
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
          console.warn(`[WorkflowExecutor] Proceeding with non-active workflow status '${workflow.status}' due to ALLOW_DRAFT_EXECUTION`);
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
          steps_total: workflow.workflow_steps.length
        })
        .select()
        .single();
        
      if (executionError) {
        throw new Error(`Failed to create execution: ${executionError.message}`);
      }
      
      console.log(`[WorkflowExecutor] Created execution ${execution.id}`);
      
      // Mark as running
      this.runningExecutions.set(execution.id, { cancelled: false });

      // Start execution asynchronously
      this.executeWorkflow(execution, workflow).catch(error => {
        console.error(`[WorkflowExecutor] Execution ${execution.id} failed:`, error);
        // If cancelled, don't overwrite cancelled status with failed
        const run = this.runningExecutions.get(execution.id);
        if (!run || !run.cancelled) {
          this.failExecution(execution.id, error.message);
        }
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
      
      // On return, check if cancelled
      const run = this.runningExecutions.get(execution.id);
      if (run && run.cancelled) {
        // Already marked cancelled by route; nothing else to do.
        return;
      }

      if (result.success) {
        await this.completeExecution(execution.id, result.data, stepsExecuted, startTime);
      } else {
        await this.failExecution(execution.id, result.error, result.errorStepId);
      }
      
    } catch (error) {
      console.error(`[WorkflowExecutor] Workflow execution failed:`, error);
      const run = this.runningExecutions.get(execution.id);
      if (!run || !run.cancelled) {
        await this.failExecution(execution.id, error.message);
      }
    } finally {
      this.runningExecutions.delete(execution.id);
    }
  }

  async executeStep(execution, step, inputData, workflow, visitedSteps = new Set()) {
    try {
      // Check cancellation before starting step
      if (this._isCancelled(execution.id)) {
        return { success: false, error: 'Execution cancelled', errorStepId: step.id };
      }
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
      result = await this.executeActionStep(step, inputData, execution);
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
  await this.updateStepExecution(stepExecution, result);
      
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

  async executeActionStep(step, inputData, execution) {
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
      return await this.executeWebScrapeAction(config, inputData, execution);
        case 'api_call':
      return await this.executeApiCallAction(config, inputData, execution);
        case 'data_transform':
          return await this.executeDataTransformAction(config, inputData);
        case 'file_upload':
      return await this.executeFileUploadAction(config, inputData, execution);
        case 'email':
          return await this.executeEmailAction(config, inputData);
        case 'delay':
          return await this.executeDelayAction(config, inputData, execution);
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
  async executeWebScrapeAction(config, inputData, execution) {
    try {
      // This is a placeholder - integrate with your existing scraping service
      const { url, selectors, timeout = 30 } = config;
      
      console.log(`[WorkflowExecutor] Web scraping: ${url}`);
      
      const axios = require('axios');

      const maxAttempts = Math.max(1, Number(config?.retries?.maxAttempts || 3));
      const baseMs = Number(config?.retries?.baseMs || 300);

  const backoff = await this._withBackoff(async ({ controller }) => {
        // Cooperative cancellation: periodic check and abort
        const cancelTimer = setInterval(async () => {
          if (execution && await this._isCancelled(execution.id)) {
            try { controller?.abort?.(); } catch (_) {}
          }
        }, 500);
        try {
          return await axios.post(`${process.env.AUTOMATION_SERVICE_URL}/scrape`, {
            url,
            selectors,
            timeout
          }, {
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
          // Retry on network errors/timeouts/5xx
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
          scraped_data: response.data
        },
        meta: { attempts: backoff.attempts, backoffWaitMs: backoff.totalWaitMs }
      };
      
    } catch (error) {
      return { success: false, error: `Web scraping failed: ${error.message}` };
    }
  }

  async executeApiCallAction(config, inputData, execution) {
    try {
      const { method, url, headers = {}, body, timeout = 30 } = config;
      
      console.log(`[WorkflowExecutor] API call: ${method} ${url}`);
      
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
          return await axios({
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
        const checksum = crypto.createHash('md5').update(buffer).digest('hex');

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
              checksum_md5: checksum,
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

  async executeEmailAction(config, inputData) {
    try {
      const { to, template, variables = {}, scheduled_at } = config || {};
      if (!to || !template) {
        throw new Error('Email step requires `to` and `template`');
      }
      console.log(`[WorkflowExecutor] Enqueue email to: ${to}`);

      // Insert into email_queue (processed by email_worker)
      const insert = {
        to_email: to,
        template,
        data: variables || {},
        status: 'pending',
        scheduled_at: scheduled_at || new Date().toISOString()
      };
      const { data, error } = await this.supabase.from('email_queue').insert([insert]).select('*');
      if (error) throw new Error(`Failed to enqueue email: ${error.message}`);

      const item = Array.isArray(data) ? data[0] : data;
      return {
        success: true,
        data: {
          ...inputData,
          email_result: {
            queue_id: item?.id || null,
            status: 'queued'
          }
        }
      };
      
    } catch (error) {
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
      
      console.log(`[WorkflowExecutor] Waiting for ${waitTime} seconds`);
      
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

  async updateStepExecution(stepExecution, result) {
    const updateData = {
      completed_at: new Date().toISOString(),
      status: result.success ? 'completed' : 'failed',
      output_data: result.data,
      result: result
    };
    
    if (!result.success) {
      updateData.error_message = result.error;
    }
    // Add duration and retry metrics if available
    if (stepExecution?.started_at) {
      try {
        const dur = Date.now() - new Date(stepExecution.started_at).getTime();
        updateData.duration_ms = Math.max(0, dur);
      } catch (_) {}
    }
    const attempts = result?.meta?.attempts;
    if (typeof attempts === 'number' && attempts >= 1) {
      updateData.retry_count = Math.max(0, attempts - 1);
    }
    
    const { error } = await this.supabase
      .from('step_executions')
      .update(updateData)
      .eq('id', stepExecution.id);
      
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

  // Cancellation helpers
  async _isCancelled(executionId) {
    const run = this.runningExecutions.get(executionId);
    if (run && run.cancelled) return true;
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

}

module.exports = { WorkflowExecutor };