const axios = require('axios');
const { getLogger } = require('../middleware/structuredLogging');
const { validateUrlForSSRF } = require('../utils/ssrfProtection');

const logger = getLogger('automationQueue');

/**
 * Validates that the automation service URL is configured in environment
 * @returns {object} Contains automationUrl
 * @throws {Error} If automation URL is not configured
 */
function validateAutomationServiceConfig() {
  const automationUrl = process.env.AUTOMATION_URL;
  if (!automationUrl) {
    const errorMessage = 'Automation service is not configured. Please contact support to enable this feature.';
    logger.error(`[automationQueue] ${errorMessage}`);
    throw new Error(errorMessage);
  }
  return { automationUrl };
}

/**
 * Performs health check on automation service with automatic retry scheduling
 * @param {string} automationUrl - The automation service URL
 * @param {string} runId - The automation run ID
 * @param {object} taskData - The task data for potential retry
 * @param {object} supabase - Supabase client instance
 * @param {Function} queueTaskRunFn - Reference to queueTaskRun for retry scheduling
 * @returns {Promise<object>} Health check result with shouldContinue flag
 */
async function performHealthCheckWithRetry(automationUrl, runId, taskData, supabase, queueTaskRunFn) {
  const healthCheckStartTime = Date.now();
  
  try {
    let normalizedUrl = automationUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `http://${normalizedUrl}`;
    }

    logger.info(`[automationQueue] 🔍 Health check: ${normalizedUrl}`, {
      run_id: runId,
      automation_url: normalizedUrl,
      timestamp: new Date().toISOString()
    });

    await axios.get(`${normalizedUrl}/health`, { timeout: 5000 }).catch(() => {
      return axios.get(normalizedUrl, { timeout: 5000, validateStatus: () => true });
    });

    const healthCheckDuration = Date.now() - healthCheckStartTime;
    
    logger.info('[automationQueue] ✅ Health check passed', {
      run_id: runId,
      automation_url: normalizedUrl,
      duration_ms: healthCheckDuration,
      timestamp: new Date().toISOString()
    });
    
    return { passed: true, shouldContinue: true };
    
  } catch (healthError) {
    const healthCheckDuration = Date.now() - healthCheckStartTime;
    const retryAt = new Date(Date.now() + 5 * 60 * 1000);

    logger.warn('[automationQueue] ⚠️ Automation service health check failed, scheduling retry in 5 minutes', {
      run_id: runId,
      error: healthError.message,
      error_code: healthError.code,
      automation_url: automationUrl,
      duration_ms: healthCheckDuration,
      retry_scheduled_at: retryAt.toISOString(),
      timestamp: new Date().toISOString()
    });

    try {
      await supabase
        .from('automation_runs')
        .update({
          status: 'running',
          result: JSON.stringify({
            status: 'queued',
            message: 'Service unavailable, retrying in 5 min',
            retry_scheduled: true,
            retry_at: retryAt.toISOString(),
            health_check_error: healthError.message
          })
        })
        .eq('id', runId);
    } catch (updateErr) {
      logger.error('[automationQueue] Failed to update run status for retry:', updateErr.message);
    }

    setTimeout(async () => {
      logger.info(`[automationQueue] 🔄 Retrying automation run ${runId} after health check failure`);
      try {
        await queueTaskRunFn(runId, taskData);
      } catch (retryError) {
        logger.error(`[automationQueue] Retry failed for run ${runId}:`, retryError.message);
        
        try {
          await supabase
            .from('automation_runs')
            .update({
              status: 'failed',
              ended_at: new Date().toISOString(),
              result: JSON.stringify({
                error: 'Automation service unavailable after retry',
                message: 'Service was unavailable and retry also failed. Please try again later.',
                retry_attempted: true
              })
            })
            .eq('id', runId);
        } catch (finalErr) {
          logger.error('[automationQueue] Failed to mark run as failed after retry:', finalErr.message);
        }
      }
    }, 5 * 60 * 1000);

    return {
      passed: false,
      shouldContinue: false,
      retryInfo: {
        success: false,
        retry_scheduled: true,
        message: 'Service unavailable, retrying in 5 min',
        retry_at: retryAt.toISOString()
      }
    };
  }
}

/**
 * Extracts target URL from taskData and validates against SSRF attacks
 * @param {object} taskData - The task data containing URL
 * @returns {object} Contains validatedUrl
 * @throws {Error} If URL is missing or fails SSRF validation
 */
function extractAndValidateTargetUrl(taskData) {
  logger.info('[automationQueue] Task data received:', {
    has_url: !!taskData.url,
    url: taskData.url,
    task_type: taskData.task_type,
    has_parameters: !!taskData.parameters,
    parameters_keys: taskData.parameters ? Object.keys(taskData.parameters) : [],
    all_keys: Object.keys(taskData)
  });

  let urlToValidate = taskData.url;
  if (!urlToValidate && taskData.parameters) {
    urlToValidate = taskData.parameters.url || 
                    taskData.parameters.targetUrl || 
                    taskData.parameters.websiteUrl;
    if (urlToValidate) {
      logger.info(`[automationQueue] URL found in parameters, extracting to top level: ${urlToValidate}`);
      taskData.url = urlToValidate;
    }
  }

  if (!urlToValidate) {
    logger.error('[automationQueue] CRITICAL ERROR: No URL found in task data!', {
      taskData_keys: Object.keys(taskData),
      has_parameters: !!taskData.parameters,
      parameters_keys: taskData.parameters ? Object.keys(taskData.parameters) : []
    });
    throw new Error('URL is required but was not found in task data. Please provide a valid URL.');
  }

  const urlValidation = validateUrlForSSRF(urlToValidate);
  if (!urlValidation.valid) {
    logger.error('[automationQueue] SSRF validation failed', {
      url: urlToValidate,
      reason: urlValidation.reason
    });
    throw new Error(`Invalid URL: ${urlValidation.reason}`);
  }

  return { validatedUrl: urlValidation.url };
}

/**
 * Builds the automation payload in the format expected by the worker
 * @param {object} taskData - The original task data
 * @param {string} validatedUrl - The SSRF-validated target URL
 * @param {string} runId - The automation run ID
 * @returns {object} Contains payload object
 */
function buildAutomationPayload(taskData, validatedUrl, runId) {
  const payload = {
    url: validatedUrl,
    title: taskData.title || 'Untitled Task',
    run_id: runId,
    type: taskData.task_type || taskData.type || 'general',
    task_type: taskData.task_type || taskData.type || 'general',
    action: taskData.action || 'navigate',
    parameters: taskData.parameters || {},
    user_id: taskData.user_id,
    workflow_id: taskData.workflow_id
  };

  if (payload.type === 'invoice_download' || payload.type === 'invoice-download') {
    const params = payload.parameters || {};
    const pdfUrl = params.pdf_url;
    
    if (pdfUrl) {
      payload.pdf_url = pdfUrl;
      logger.info('[automationQueue] Invoice download task - PDF URL extracted:', { pdf_url: pdfUrl });
    } else {
      logger.warn('[automationQueue] Invoice download task missing pdf_url parameter!', {
        run_id: runId,
        available_params: Object.keys(params)
      });
    }
  }

  logger.info('[automationQueue] Payload being sent to worker:', {
    run_id: runId,
    type: payload.type,
    has_url: !!payload.url,
    has_pdf_url: !!payload.pdf_url,
    action: payload.action
  });

  return { payload };
}

/**
 * Builds the list of endpoint candidates to try for automation request
 * @param {string} automationUrl - The base automation service URL
 * @param {string} taskType - The task type for URL construction
 * @returns {object} Contains normalizedUrl and candidates array
 */
function buildEndpointCandidates(automationUrl, taskType) {
  let normalizedUrl = automationUrl;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `http://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.trim();

  const taskTypeSlug = String(taskType || 'general')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');
    
  const candidates = [
    `/automate/${encodeURIComponent(taskTypeSlug)}`,
    '/automate'
  ];

  return { normalizedUrl, candidates };
}

/**
 * Handles direct result from automation worker (when Kafka is unavailable)
 * @param {object} automationResult - The result from automation worker
 * @param {string} runId - The automation run ID
 * @param {object} taskData - The original task data
 * @param {object} supabase - Supabase client instance
 * @param {object} usageTracker - Usage tracking service
 * @param {object} firebaseNotificationService - Notification service
 * @param {object} NotificationTemplates - Notification template helper
 */
async function handleDirectResult(automationResult, runId, taskData, supabase, usageTracker, firebaseNotificationService, NotificationTemplates) {
  const finalStatus = automationResult.success ? 'completed' : 'failed';
  const sb2 = (typeof global !== 'undefined' && global.supabase) ? global.supabase : supabase;
  
  await sb2
    .from('automation_runs')
    .update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      result: JSON.stringify(automationResult.result || automationResult)
    })
    .eq('id', runId);

  await usageTracker.trackAutomationRun(taskData.user_id, runId, finalStatus);

  if (finalStatus === 'failed') {
    try {
      const taskName = taskData.title || 'Automation Task';
      const errorMessage = automationResult.result?.error || automationResult.error || 'Task failed';
      const notification = NotificationTemplates.taskFailed(taskName, errorMessage);
      
      const isRetryable = errorMessage.toLowerCase().includes('timeout') || 
                          errorMessage.toLowerCase().includes('network');
      
      if (!isRetryable) {
        await firebaseNotificationService.sendNotification(
          taskData.user_id,
          notification.title,
          notification.body,
          { run_id: runId, type: 'task_failed', workflow_id: taskData.workflow_id }
        );
      }
    } catch (notificationError) {
      logger.error('[automationQueue] Failed to send failure notification:', notificationError.message);
    }
  }

  logger.info(`[automationQueue] Direct result handled: ${finalStatus}`, { run_id: runId });
}

/**
 * Executes automation request with retry logic and endpoint fallback
 * @param {string} normalizedUrl - Base automation URL
 * @param {string[]} candidates - Endpoint paths to try
 * @param {object} payload - Automation payload
 * @param {string} runId - Run ID for logging
 * @param {object} taskData - Original task data
 * @param {object} dependencies - Service dependencies (supabase, usageTracker, etc.)
 * @returns {Promise<object>} Success result
 * @throws {Error} If all retry attempts fail
 */
async function executeAutomationWithRetry(normalizedUrl, candidates, payload, runId, taskData, dependencies) {
  const { supabase, usageTracker, firebaseNotificationService, NotificationTemplates } = dependencies;
  
  let automationResult;
  const maxRetries = 3;
  const backoffDelays = [0, 5000, 15000];
  let lastError;

  const automationStartTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();

    if (attempt > 1) {
      const waitMs = backoffDelays[attempt - 1];
      logger.info(`[automationQueue] ⏳ Waiting ${waitMs}ms before retry attempt ${attempt}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    for (const pathSuffix of candidates) {
      const base = normalizedUrl.replace(/\/$/, '');
      const fullAutomationUrl = `${base}${pathSuffix}`;

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.AUTOMATION_API_KEY) {
          headers['X-API-Key'] = process.env.AUTOMATION_API_KEY;
        }

        logger.info(`[automationQueue] 📤 Attempt ${attempt}/${maxRetries}, endpoint: ${fullAutomationUrl}`, {
          run_id: runId,
          payload_type: payload.type
        });

        const response = await axios.post(fullAutomationUrl, payload, {
          headers,
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 500
        });

        automationResult = response.data || { success: false, error: 'Empty response from worker' };

        const attemptDuration = Date.now() - attemptStartTime;
        const totalDuration = Date.now() - automationStartTime;

        logger.info('[automationQueue] ✅ Automation request successful', {
          run_id: runId,
          attempt,
          endpoint: fullAutomationUrl,
          attempt_duration_ms: attemptDuration,
          total_duration_ms: totalDuration,
          status: response.status
        });

        if (automationResult.result || automationResult.success !== undefined) {
          await handleDirectResult(
            automationResult, 
            runId, 
            taskData, 
            supabase, 
            usageTracker, 
            firebaseNotificationService, 
            NotificationTemplates
          );
          return { success: true, isDirect: true, result: automationResult };
        } else {
          return { success: true, isDirect: false };
        }
        
      } catch (err) {
        lastError = err;
        const attemptDuration = Date.now() - attemptStartTime;
        
        logger.warn(`[automationQueue] ⚠️ Automation attempt ${attempt}/${maxRetries} failed`, {
          run_id: runId,
          endpoint: fullAutomationUrl,
          error: err.message,
          error_code: err.code,
          response_status: err.response?.status,
          duration_ms: attemptDuration
        });

        const isRetryable = err.code === 'ECONNREFUSED' || 
                           err.code === 'ETIMEDOUT' || 
                           err.code === 'ECONNRESET' ||
                           (err.response && err.response.status >= 500);

        if (!isRetryable) {
          throw err;
        }
      }
    }
  }

  if (lastError) {
    logger.error(`[automationQueue] ❌ All automation attempts exhausted`, {
      run_id: runId,
      total_attempts: maxRetries * candidates.length,
      final_error: lastError.message
    });
    throw lastError;
  }

  throw new Error('All automation endpoints failed');
}

/**
 * Handles automation service failures with cleanup and notifications
 * @param {Error} error - The error that occurred
 * @param {string} runId - The automation run ID
 * @param {object} taskData - The original task data
 * @param {object} dependencies - Service dependencies
 * @throws {Error} Re-throws the error after cleanup
 */
async function handleAutomationFailure(error, runId, taskData, dependencies) {
  const { supabase, usageTracker, firebaseNotificationService, NotificationTemplates } = dependencies;
  
  logger.error('[automationQueue] Automation service error:', error.message);

  const sb2 = (typeof global !== 'undefined' && global.supabase) ? global.supabase : supabase;
  
  try {
    await sb2
      .from('automation_runs')
      .update({
        status: 'failed',
        ended_at: new Date().toISOString(),
        result: JSON.stringify({
          error: error.message || 'Automation service error',
          code: error.code,
          timestamp: new Date().toISOString()
        })
      })
      .eq('id', runId);

    await usageTracker.trackAutomationRun(taskData.user_id, runId, 'failed');

    try {
      const taskName = taskData.title || 'Automation Task';
      const notification = NotificationTemplates.taskFailed(taskName, error.message);
      await firebaseNotificationService.sendNotification(
        taskData.user_id,
        notification.title,
        notification.body,
        { run_id: runId, type: 'task_failed', workflow_id: taskData.workflow_id }
      );
    } catch (notificationError) {
      logger.error('[automationQueue] Failed to send notification:', notificationError.message);
    }
  } catch (cleanupError) {
    logger.error('[automationQueue] Failed during error cleanup:', cleanupError.message);
  }

  throw error;
}

module.exports = {
  validateAutomationServiceConfig,
  performHealthCheckWithRetry,
  extractAndValidateTargetUrl,
  buildAutomationPayload,
  buildEndpointCandidates,
  handleDirectResult,
  executeAutomationWithRetry,
  handleAutomationFailure
};
