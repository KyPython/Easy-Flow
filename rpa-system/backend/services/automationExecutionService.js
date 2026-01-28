/**
 * Automation Execution Service
 *
 * Shared service for executing automation tasks via REST endpoints.
 * Used by both /api/automation/execute and /api/automation/executions endpoints.
 */

const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../utils/supabaseClient');
const { getKafkaService } = require('../utils/kafkaService');
const { getTaskStatusStore } = require('../utils/taskStatusStore');
const { logger } = require('../utils/logger');
const { isValidUrl } = require('../utils/ssrfProtection');

class AutomationExecutionService {
  constructor() {
    this.supabase = getSupabase();
    this.kafkaService = getKafkaService();
    this.taskStatusStore = getTaskStatusStore();
  }

  /**
   * Execute an automation task (creates task and run records, queues for processing)
   * @param {Object} params
   * @param {Object} params.taskData - Task data from request body
   * @param {string} params.userId - User ID executing the task
   * @param {Object} params.options - Additional options (link discovery, etc.)
   * @returns {Promise<Object>} Execution result with execution ID and status
   */
  async executeAutomationTask({ taskData, userId, options = {} }) {
    try {
      // Validate payload
      if (!taskData || typeof taskData !== 'object') {
        throw new Error('Request body must be a JSON object with required fields.');
      }
      if (!taskData.task_type) {
        throw new Error('task_type is required');
      }
      if (!taskData.url && ['web_automation', 'form_submission', 'data_extraction', 'file_download', 'invoice_download'].includes(taskData.task_type)) {
        throw new Error('url is required for this task_type.');
      }

      // Validate URLs to prevent SSRF
      if (taskData.url) {
        const urlValidation = isValidUrl(taskData.url);
        if (!urlValidation.valid) {
          throw new Error(urlValidation.reason === 'private-ip' ? 'Private IP addresses are not allowed' : 'Invalid URL format');
        }
      }
      if (taskData.pdf_url) {
        const pdfUrlValidation = isValidUrl(taskData.pdf_url);
        if (!pdfUrlValidation.valid) {
          throw new Error(pdfUrlValidation.reason === 'private-ip' ? 'Private IP addresses are not allowed' : 'Invalid PDF URL format');
        }
      }

      // Prepare task data
      const taskType = (taskData.task_type || 'general').toLowerCase();
      const taskName = taskData.title ||
        (taskData.task_type && taskData.task_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) ||
        'Automation Task';

      const taskParams = {
        url: taskData.url || '',
        username: taskData.username || '',
        password: taskData.password || '',
        pdf_url: taskData.pdf_url || '',
        discoveryMethod: taskData.discoveryMethod || '',
        discoveryValue: taskData.discoveryValue || '',
        enableAI: taskData.enableAI || false,
        extractionTargets: taskData.extractionTargets || []
      };

      // Create database records
      let taskRecord = null;
      let runRecord = null;
      let dbError = null;

      if (this.supabase) {
        try {
          // Create automation_tasks record
          const { data: task, error: taskError } = await this.supabase
            .from('automation_tasks')
            .insert([{
              user_id: userId,
              name: taskName,
              description: taskData.notes || taskData.description || '',
              url: taskData.url || '',
              task_type: taskType,
              parameters: JSON.stringify(taskParams),
              is_active: true
            }])
            .select()
            .single();

          if (taskError) {
            dbError = `Database error: ${taskError.message || 'Failed to create task record'}`;
            logger.error('[AutomationExecutionService] Failed to create task record:', taskError);
          } else {
            taskRecord = task;

            // Create automation_runs record
            const { data: run, error: runError } = await this.supabase
              .from('automation_runs')
              .insert([{
                task_id: taskRecord.id,
                user_id: userId,
                status: 'running',
                started_at: new Date().toISOString(),
                result: JSON.stringify({
                  status: 'queued',
                  message: 'Task queued for processing',
                  queue_status: 'pending'
                })
              }])
              .select()
              .single();

            if (runError) {
              dbError = dbError ? `${dbError}; Run error: ${runError.message}` : `Database error: ${runError.message || 'Failed to create run record'}`;
              logger.error('[AutomationExecutionService] Failed to create run record:', runError);
            } else {
              runRecord = run;
            }
          }
        } catch (dbException) {
          dbError = `Unexpected database error: ${dbException.message || String(dbException)}`;
          logger.error('[AutomationExecutionService] Database exception:', dbException);
        }
      } else {
        dbError = 'Supabase client not initialized';
        logger.error('[AutomationExecutionService] Supabase client not available');
      }

      // Enrich task with user context
      const enrichedTask = {
        ...taskData,
        user_id: userId,
        created_at: new Date().toISOString(),
        source: 'backend-api'
      };

      // Send task to Kafka for processing
      let taskId;
      try {
        const result = await this.kafkaService.sendAutomationTask(enrichedTask);
        taskId = result.taskId;
      } catch (kafkaError) {
        logger.error('[AutomationExecutionService] Kafka send failed:', kafkaError);
        taskId = enrichedTask.task_id || uuidv4();
      }

      // Update run record with queue status if available
      if (runRecord?.id && this.supabase) {
        try {
          const result = JSON.parse(runRecord.result || '{}');
          result.status_message = '📤 Task queued for processing...';
          result.progress = 70;
          await this.supabase
            .from('automation_runs')
            .update({
              result: JSON.stringify(result),
              updated_at: new Date().toISOString()
            })
            .eq('id', runRecord.id);
        } catch (e) {
          // Non-blocking
          logger.debug('[AutomationExecutionService] Failed to update queue status:', e.message);
        }
      }

      // Store status in Redis/memory
      await this.taskStatusStore.set(taskId, {
        status: 'queued',
        result: null,
        updated_at: new Date().toISOString(),
        user_id: userId,
        task: enrichedTask,
        task_record_id: taskRecord?.id,
        run_record_id: runRecord?.id
      });

      // Return execution result
      return {
        execution: {
          id: runRecord?.id || taskId,
          task_id: taskId,
          task_record_id: taskRecord?.id || null,
          status: 'queued',
          created_at: runRecord?.started_at || new Date().toISOString()
        },
        db_recorded: !!runRecord,
        db_error: dbError || null,
        task_id: taskId,
        run_id: runRecord?.id || null
      };
    } catch (error) {
      logger.error('[AutomationExecutionService] Execution failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
let instance = null;
function getAutomationExecutionService() {
  if (!instance) {
    instance = new AutomationExecutionService();
  }
  return instance;
}

module.exports = {
  AutomationExecutionService,
  getAutomationExecutionService
};

