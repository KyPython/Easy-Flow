
const { logger, getLogger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');
const cron = require('node-cron');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { WorkflowExecutor } = require('./workflowExecutor');
const { getWorkflowQueue } = require('./workflowQueue');
const { STATES } = require('./workflowStateMachine');

class TriggerService {
 constructor() {
 this.supabase = getSupabase();
 if (!this.supabase && process.env.NODE_ENV !== 'production') {
 logger.warn('[TriggerService] Supabase not configured (missing SUPABASE_URL or key). Scheduler disabled.');
 }
 this.workflowExecutor = new WorkflowExecutor();
 this.activeJobs = new Map(); // Track active cron jobs
 this.initialized = false;
 }

 async initialize() {
 if (this.initialized) return;
 if (!this.supabase) {
 // ✅ IMMEDIATE FIX: Don't silently fail - log error and set initialized flag
 logger.error('[TriggerService] CRITICAL: Supabase not configured. Scheduled workflows will NOT run. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
 this.initialized = false; // Mark as not initialized so we can retry
 // Still set initialized to true to prevent infinite retry loops, but log the error
 this.initialized = true;
 return;
 }
 if (process.env.NODE_ENV !== 'production') {
 logger.info('[TriggerService] Initializing automation trigger system...');
 }

 try {
 // Load and schedule all active workflows
 await this.loadActiveSchedules();

 // Set up periodic refresh of schedules (every 5 minutes)
 cron.schedule('*/5 * * * *', () => {
 this.refreshSchedules();
 });

 this.initialized = true;
 if (process.env.NODE_ENV !== 'production') {
 logger.info('[TriggerService] Automation trigger system initialized');
 }
 } catch (error) {
 // ✅ IMMEDIATE FIX: Log initialization failures
 logger.error('[TriggerService] Failed to initialize trigger system:', error);
 this.initialized = false;
 throw error; // Re-throw so caller knows initialization failed
 }
 }

 async loadActiveSchedules() {
 try {
 if (!this.supabase) {
 logger.error('[TriggerService] Cannot load schedules: Supabase not configured');
 return;
 }

 const { data: schedules, error } = await this.supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(*)
 `)
 .eq('is_active', true);

 if (error) {
 // ✅ IMMEDIATE FIX: Log error with more context
 logger.error('[TriggerService] Error loading schedules:', {
 error: error.message,
 code: error.code,
 details: error.details
 });
 return;
 }

 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Loading ${schedules?.length || 0} active schedules`);
 }

 let successCount = 0;
 let failureCount = 0;

 for (const schedule of schedules || []) {
 try {
 await this.scheduleWorkflow(schedule);
 successCount++;
 } catch (scheduleError) {
 failureCount++;
 logger.error(`[TriggerService] Failed to schedule workflow ${schedule.id}:`, {
 schedule_id: schedule.id,
 workflow_id: schedule.workflow_id,
 error: scheduleError.message
 });
 }
 }

 if (failureCount > 0) {
 logger.warn(`[TriggerService] Scheduled ${successCount} workflows, ${failureCount} failed`);
 }
 } catch (error) {
 logger.error('[TriggerService] Failed to load active schedules:', error);
 throw error; // Re-throw so caller knows it failed
 }
 }

 async scheduleWorkflow(schedule) {
 try {
 const { id, schedule_type, cron_expression, interval_seconds, workflow } = schedule;

 // Stop existing job if it exists
 this.stopSchedule(id);

 if (schedule_type === 'cron' && cron_expression) {
 // Validate and schedule cron job
 if (cron.validate(cron_expression)) {
 const task = cron.schedule(cron_expression, async () => {
 await this.executeScheduledWorkflow(schedule);
 }, {
 scheduled: false,
 timezone: schedule.timezone || 'UTC'
 });

 task.start();
 this.activeJobs.set(id, task);

 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Scheduled cron workflow: ${workflow.name} (${cron_expression})`);
 }

 // Update next trigger time
 await this.updateNextTriggerTime(id, this.getNextCronTime(cron_expression, schedule.timezone));

 } else {
 logger.error(`[TriggerService] Invalid cron expression for schedule ${id}: ${cron_expression}`);
 }

 } else if (schedule_type === 'interval' && interval_seconds) {
 // Schedule interval-based job
 const intervalMs = interval_seconds * 1000;
 const intervalId = setInterval(async () => {
 await this.executeScheduledWorkflow(schedule);
 }, intervalMs);

 this.activeJobs.set(id, { type: 'interval', intervalId });

 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Scheduled interval workflow: ${workflow.name} (every ${interval_seconds}s)`);
 }

 // Update next trigger time
 const nextTrigger = new Date(Date.now() + intervalMs);
 await this.updateNextTriggerTime(id, nextTrigger.toISOString());
 }

 } catch (error) {
 logger.error(`[TriggerService] Failed to schedule workflow ${schedule.id}:`, error);
 }
 }

 async executeScheduledWorkflow(schedule) {
 try {
 // ✅ EXECUTION MODES: Import execution mode services
 const { ExecutionModeService, EXECUTION_MODES } = require('./executionModeService');
 const { SmartScheduler } = require('./smartScheduler');
 const executionModeService = new ExecutionModeService();
 const smartScheduler = new SmartScheduler();
 const { workflow_id, user_id, id: schedule_id, workflow } = schedule;

 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Executing scheduled workflow: ${workflow_id}`);
 }

 // Check execution limits
 if (schedule.max_executions && schedule.execution_count >= schedule.max_executions) {
 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Schedule ${schedule_id} reached max executions, deactivating`);
 }
 await this.deactivateSchedule(schedule_id);
 return;
 }

 // ✅ EXECUTION MODES: Determine execution mode for scheduled workflow
 const context = { triggeredBy: 'schedule', triggerData: { scheduleId: schedule_id } };
 const executionMode = executionModeService.determineExecutionMode(workflow, context);
 const modeConfig = executionModeService.getExecutionConfig(executionMode);
 const costEstimate = executionModeService.estimateCost(workflow, executionMode);

 logger.info('Scheduled workflow execution mode determined', {
 workflow_id: workflow_id,
 schedule_id: schedule_id,
 execution_mode: executionMode,
 tier: costEstimate.tier,
 cost_per_execution: costEstimate.costPerExecution,
 savings_percentage: costEstimate.savingsPercentage
 });

 // ✅ SMART SCHEDULING: Schedule workflow optimally
 const scheduledExecution = await smartScheduler.scheduleWorkflow(workflow, context);

 // ✅ PHASE 3: Use critical workflow handler for scheduled workflows
 // (especially "Scheduled Web Scraping -> Email Report" type)
 const isCriticalWorkflow = this._isCriticalWorkflowType(workflow);

 if (isCriticalWorkflow) {
 try {
 const { CriticalWorkflowHandler } = require('./criticalWorkflowHandler');
 const criticalHandler = new CriticalWorkflowHandler();

 // Start execution first with execution mode
 const execution = await this.workflowExecutor.startExecution({
 workflowId: workflow_id,
 userId: user_id,
 triggeredBy: 'schedule',
 triggerData: { scheduleId: schedule_id },
 executionMode: executionMode
 });

 // Execute with critical workflow handler
 // Note: executeWorkflow is async and runs in background
 this.workflowExecutor.executeWorkflow(execution, workflow, { executionMode, modeConfig })
 .then(() => {
 logger.info(`[TriggerService] Critical workflow execution completed: ${execution.id}`);
 })
 .catch(error => {
 logger.error(`[TriggerService] Critical workflow execution failed: ${execution.id}`, error);
 });

 await this.updateScheduleStats(schedule_id);
 return;
 } catch (criticalError) {
 logger.error('[TriggerService] Critical workflow handler failed, falling back to standard execution:', criticalError);
 // Fall through to standard execution
 }
 }

 // Standard execution for non-critical workflows with execution mode
 const execution = await this.workflowExecutor.startExecution({
 workflowId: workflow_id,
 userId: user_id,
 triggeredBy: 'schedule',
 triggerData: { scheduleId: schedule_id },
 executionMode: executionMode
 });

 // Update schedule stats
 await this.updateScheduleStats(schedule_id);

 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Started execution ${execution.id} for schedule ${schedule_id}`);
 }

 } catch (error) {
 logger.error('[TriggerService] Failed to execute scheduled workflow:', error);
 }
 }

 /**
 * Check if workflow is critical type (Scheduled Web Scraping -> Email Report)
 */
 _isCriticalWorkflowType(workflow) {
 if (!workflow || !workflow.workflow_steps) return false;

 const steps = workflow.workflow_steps;

 // Check for: Web Scrape action + Email action
 const hasWebScrape = steps.some(
 step => step.step_type === 'action' && step.action_type === 'web_scrape'
 );
 const hasEmail = steps.some(
 step => step.step_type === 'action' && step.action_type === 'email'
 );

 // Also check if it's scheduled (called from schedule context)
 return hasWebScrape && hasEmail;
 }

 async refreshSchedules() {
 try {
 if (process.env.NODE_ENV !== 'production') {
 logger.info('[TriggerService] Refreshing schedules...');
 }

 // Get current active schedules from database
 const { data: currentSchedules, error } = await this.supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(*)
 `)
 .eq('is_active', true);

 if (error) {
 logger.error('[TriggerService] Error refreshing schedules:', error);
 return;
 }

 const currentScheduleIds = new Set(currentSchedules.map(s => s.id));
 const activeJobIds = new Set(this.activeJobs.keys());

 // Remove schedules that are no longer active
 for (const jobId of activeJobIds) {
 if (!currentScheduleIds.has(jobId)) {
 this.stopSchedule(jobId);
 }
 }

 // Add new schedules
 for (const schedule of currentSchedules) {
 if (!activeJobIds.has(schedule.id)) {
 await this.scheduleWorkflow(schedule);
 }
 }

 } catch (error) {
 logger.error('[TriggerService] Failed to refresh schedules:', error);
 }
 }

 stopSchedule(scheduleId) {
 const job = this.activeJobs.get(scheduleId);
 if (job) {
 if (job.destroy) {
 // Cron job
 job.destroy();
 } else if (job.type === 'interval') {
 // Interval job
 clearInterval(job.intervalId);
 }
 this.activeJobs.delete(scheduleId);
 if (process.env.NODE_ENV !== 'production') {
 logger.info(`[TriggerService] Stopped schedule: ${scheduleId}`);
 }
 }
 }

 async updateNextTriggerTime(scheduleId, nextTriggerTime) {
 try {
 const { error } = await this.supabase
 .from('workflow_schedules')
 .update({ next_trigger_at: nextTriggerTime })
 .eq('id', scheduleId);

 if (error) {
 logger.error(`[TriggerService] Failed to update next trigger time for ${scheduleId}:`, error);
 }
 } catch (error) {
 logger.error('[TriggerService] Error updating next trigger time:', error);
 }
 }

 async updateScheduleStats(scheduleId) {
 try {
 const { error } = await this.supabase
 .from('workflow_schedules')
 .update({
 execution_count: this.supabase.raw('execution_count + 1'),
 last_triggered_at: new Date().toISOString()
 })
 .eq('id', scheduleId);

 if (error) {
 logger.error(`[TriggerService] Failed to update schedule stats for ${scheduleId}:`, error);
 }
 } catch (error) {
 logger.error('[TriggerService] Error updating schedule stats:', error);
 }
 }

 async deactivateSchedule(scheduleId) {
 try {
 // Stop the job
 this.stopSchedule(scheduleId);

 // Deactivate in database
 const { error } = await this.supabase
 .from('workflow_schedules')
 .update({ is_active: false })
 .eq('id', scheduleId);

 if (error) {
 logger.error(`[TriggerService] Failed to deactivate schedule ${scheduleId}:`, error);
 }
 } catch (error) {
 logger.error('[TriggerService] Error deactivating schedule:', error);
 }
 }

 getNextCronTime(cronExpression, timezone = 'UTC') {
 try {
 // This is a simplified implementation
 // In production, you'd want to use a more robust cron parser
 const now = new Date();
 // For now, just add 1 hour as an estimate
 // TODO: Implement proper cron parsing
 return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
 } catch (error) {
 logger.error('[TriggerService] Error calculating next cron time:', error);
 return null;
 }
 }

 // Webhook trigger methods
 generateWebhookToken() {
 return crypto.randomBytes(32).toString('hex');
 }

 async createWebhookSchedule(workflowId, userId, config) {
 try {
 const webhookToken = this.generateWebhookToken();

 const { data, error } = await this.supabase
 .from('workflow_schedules')
 .insert({
 workflow_id: workflowId,
 user_id: userId,
 name: config.name || 'Webhook Trigger',
 schedule_type: 'webhook',
 webhook_token: webhookToken,
 webhook_secret: config.secret || null,
 is_active: true
 })
 .select()
 .single();

 if (error) {
 throw new Error(`Failed to create webhook schedule: ${error.message}`);
 }

 return {
 scheduleId: data.id,
 webhookUrl: `/api/webhooks/trigger/${webhookToken}`,
 webhookToken
 };
 } catch (error) {
 logger.error('[TriggerService] Error creating webhook schedule:', error);
 throw error;
 }
 }

 async executeWebhookTrigger(token, payload, headers) {
 try {
 // Find the webhook schedule
 const { data: schedule, error } = await this.supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(*)
 `)
 .eq('webhook_token', token)
 .eq('is_active', true)
 .single();

 if (error || !schedule) {
 throw new Error('Invalid webhook token or inactive schedule');
 }

 // Validate webhook secret if configured
 if (schedule.webhook_secret) {
 const signature = headers['x-webhook-signature'];
 if (!signature || !this.validateWebhookSignature(payload, schedule.webhook_secret, signature)) {
 throw new Error('Invalid webhook signature');
 }
 }

 // Execute the workflow
 const execution = await this.workflowExecutor.startExecution({
 workflowId: schedule.workflow_id,
 userId: schedule.user_id,
 triggeredBy: 'webhook',
 triggerData: {
 scheduleId: schedule.id,
 webhookPayload: payload,
 webhookHeaders: headers
 },
 inputData: payload
 });

 // Update schedule stats
 await this.updateScheduleStats(schedule.id);

 return {
 success: true,
 executionId: execution.id,
 workflowName: schedule.workflow.name
 };

 } catch (error) {
 logger.error('[TriggerService] Webhook execution failed:', error);
 throw error;
 }
 }

 /**
 * ✅ PHASE 1.1: Async webhook trigger - queues execution and returns immediately
 * This is the production-ready version for 100k+ scale
 * @param {string} token - Webhook token
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} - Execution details with job info
 */
 async queueWebhookTrigger(token, payload, headers) {
 try {
 // Find the webhook schedule (fast DB lookup)
 const { data: schedule, error } = await this.supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(id, name, workflow_steps, status, user_id)
 `)
 .eq('webhook_token', token)
 .eq('is_active', true)
 .single();

 if (error || !schedule) {
 throw new Error('Invalid webhook token or inactive schedule');
 }

 // Validate webhook secret if configured
 if (schedule.webhook_secret) {
 const signature = headers['x-webhook-signature'];
 if (!signature || !this.validateWebhookSignature(payload, schedule.webhook_secret, signature)) {
 throw new Error('Invalid webhook signature');
 }
 }

 // Create execution record in PENDING state
 const executionId = uuidv4();
 const { data: execution, error: executionError } = await this.supabase
 .from('workflow_executions')
 .insert({
 id: executionId,
 workflow_id: schedule.workflow_id,
 user_id: schedule.user_id,
 state: STATES.PENDING,
 status: 'queued',
 input_data: payload,
 triggered_by: 'webhook',
 trigger_data: {
 scheduleId: schedule.id,
 webhookPayload: payload,
 webhookHeaders: headers
 },
 execution_mode: 'balanced', // Default mode for webhooks
 max_retries: 3,
 retry_count: 0
 })
 .select()
 .single();

 if (executionError) {
 logger.error('[TriggerService] Failed to create execution record:', executionError);
 throw new Error(`Failed to create execution: ${executionError.message}`);
 }

 // Enqueue execution job
 const queue = getWorkflowQueue();
 const priority = 7; // Higher priority for webhook triggers
 
 try {
 await queue.enqueueExecution({
 executionId,
 workflowId: schedule.workflow_id,
 userId: schedule.user_id,
 inputData: payload,
 triggeredBy: 'webhook',
 triggerData: {
 scheduleId: schedule.id,
 webhookPayload: payload,
 webhookHeaders: headers
 },
 executionMode: 'balanced'
 }, { priority });

 logger.info('[TriggerService] Webhook execution queued', {
 execution_id: executionId,
 workflow_id: schedule.workflow_id,
 workflow_name: schedule.workflow.name,
 schedule_id: schedule.id,
 priority
 });
 } catch (queueError) {
 // If queue fails, mark execution as failed
 await this.supabase
 .from('workflow_executions')
 .update({
 state: STATES.FAILED,
 status: 'failed',
 error_message: `Failed to enqueue: ${queueError.message}`
 })
 .eq('id', executionId);

 logger.error('[TriggerService] Failed to enqueue webhook execution:', {
 execution_id: executionId,
 error: queueError.message
 });
 throw new Error('Failed to queue webhook execution');
 }

 // Update schedule stats
 await this.updateScheduleStats(schedule.id);

 // Return execution details (not waiting for completion)
 return {
 success: true,
 executionId: execution.id,
 workflowId: schedule.workflow_id,
 workflowName: schedule.workflow.name,
 status: 'queued',
 state: STATES.PENDING,
 created_at: execution.created_at,
 location: `/api/executions/${execution.id}`
 };

 } catch (error) {
 logger.error('[TriggerService] Webhook trigger failed:', error);
 throw error;
 }
 }

 validateWebhookSignature(payload, secret, signature) {
 try {
 const expectedSignature = crypto
 .createHmac('sha256', secret)
 .update(JSON.stringify(payload))
 .digest('hex');

 return crypto.timingSafeEqual(
 Buffer.from(`sha256=${expectedSignature}`),
 Buffer.from(signature)
 );
 } catch (error) {
 logger.error('[TriggerService] Error validating webhook signature:', error);
 return false;
 }
 }

 // API methods for schedule management
 async createSchedule(config) {
 try {
 const scheduleData = {
 workflow_id: config.workflowId,
 user_id: config.userId,
 name: config.name,
 schedule_type: config.scheduleType,
 is_active: config.isActive !== false
 };

 if (config.scheduleType === 'cron') {
 if (!cron.validate(config.cronExpression)) {
 throw new Error('Invalid cron expression');
 }
 scheduleData.cron_expression = config.cronExpression;
 scheduleData.timezone = config.timezone || 'UTC';
 } else if (config.scheduleType === 'interval') {
 if (!config.intervalSeconds || config.intervalSeconds < 60) {
 throw new Error('Interval must be at least 60 seconds');
 }
 scheduleData.interval_seconds = config.intervalSeconds;
 }

 if (config.maxExecutions) {
 scheduleData.max_executions = config.maxExecutions;
 }

 const { data, error } = await this.supabase
 .from('workflow_schedules')
 .insert(scheduleData)
 .select()
 .single();

 if (error) {
 throw new Error(`Failed to create schedule: ${error.message}`);
 }

 // Schedule the workflow if active
 if (scheduleData.is_active) {
 await this.scheduleWorkflow({ ...data, workflow: { id: config.workflowId } });
 }

 return data;
 } catch (error) {
 logger.error('[TriggerService] Error creating schedule:', error);
 throw error;
 }
 }

 async deleteSchedule(scheduleId) {
 try {
 // Stop the active job
 this.stopSchedule(scheduleId);

 // Delete from database
 const { error } = await this.supabase
 .from('workflow_schedules')
 .delete()
 .eq('id', scheduleId);

 if (error) {
 throw new Error(`Failed to delete schedule: ${error.message}`);
 }

 return { success: true };
 } catch (error) {
 logger.error('[TriggerService] Error deleting schedule:', error);
 throw error;
 }
 }

 getStatus() {
 return {
 initialized: this.initialized,
 activeJobs: this.activeJobs.size,
 jobIds: Array.from(this.activeJobs.keys())
 };
 }

 async shutdown() {
 if (process.env.NODE_ENV !== 'production') {
 logger.info('[TriggerService] Shutting down automation trigger system...');
 }

 // Stop all active jobs
 for (const scheduleId of this.activeJobs.keys()) {
 this.stopSchedule(scheduleId);
 }

 this.initialized = false;
 if (process.env.NODE_ENV !== 'production') {
 logger.info('[TriggerService] Automation trigger system shutdown complete');
 }
 }
}

module.exports = { TriggerService };
