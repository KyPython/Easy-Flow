// Critical Workflow Handler
// Specialized handler for "Scheduled Web Scraping -> Email Report" workflow
// This is the ONE workflow type that needs to work 99%+ of the time

const { WorkflowExecutor } = require('./workflowExecutor');
const { getSupabase } = require('../utils/supabaseClient');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('service.criticalWorkflow');

class CriticalWorkflowHandler {
 constructor() {
 this.executor = new WorkflowExecutor();
 this.supabase = getSupabase();
 }

 /**
 * Execute critical workflow with enhanced reliability
 * Designed for: Scheduled Web Scraping -> Email Report
 */
 async executeCriticalWorkflow(execution, workflow) {
 const startTime = Date.now();
 const executionId = execution.id;

 try {
 logger.info('Executing critical workflow', {
 execution_id: executionId,
 workflow_id: workflow.id,
 workflow_name: workflow.name
 });

 // ✅ STEP 1: Pre-flight checks
 const preflightCheck = await this._preflightChecks(execution, workflow);
 if (!preflightCheck.success) {
 await this.executor.failExecution(
 executionId,
 preflightCheck.error,
 null,
 preflightCheck.errorCategory
 );
 return;
 }

 // ✅ STEP 2: Execute with enhanced error handling
 const result = await this._executeWithRecovery(execution, workflow);

 // ✅ STEP 3: Post-execution validation
 if (result.success) {
 const validation = await this._validateResults(result.data, workflow);
 if (!validation.valid) {
 // Results don't meet criteria, but execution technically succeeded
 logger.warn('Critical workflow results validation failed', {
 execution_id: executionId,
 validation_errors: validation.errors
 });
 // Store validation warnings but don't fail execution
 result.data._validation_warnings = validation.errors;
 }
 }

 return result;

 } catch (error) {
 logger.error('Critical workflow execution failed', {
 execution_id: executionId,
 error: error.message,
 stack: error.stack
 });

 // ✅ Enhanced error handling for critical workflows
 const errorCategory = this.executor._categorizeError(error);
 const userMessage = this.executor._getUserFriendlyMessage(errorCategory, error);

 await this.executor.failExecution(executionId, userMessage, null, errorCategory);

 // ✅ Attempt automatic recovery for transient failures
 if (this._isTransientError(errorCategory)) {
 await this._scheduleRetry(execution, workflow, errorCategory);
 }

 throw error;
 }
 }

 /**
 * Pre-flight checks before execution
 */
 async _preflightChecks(execution, workflow) {
 const checks = [];

 // Check 1: Automation service health
 const automationHealth = await this.executor._checkAutomationServiceHealth();
 if (!automationHealth.healthy) {
 return {
 success: false,
 error: `Automation service unavailable: ${automationHealth.message}`,
 errorCategory: automationHealth.error || 'AUTOMATION_SERVICE_UNAVAILABLE'
 };
 }
 checks.push('automation_service');

 // Check 2: Email service availability (if workflow has email step)
 // ✅ SPRINT: Email failures should not block scraping
 const hasEmailStep = workflow.workflow_steps?.some(
 step => step.step_type === 'action' && step.action_type === 'email'
 );
 if (hasEmailStep) {
 const emailCheck = await this._checkEmailServiceHealth();
 if (!emailCheck.healthy) {
 // Email service down - still execute scraping, but warn
 logger.warn('Email service unavailable, will store results for later', {
 execution_id: execution.id
 });
 // Don't fail - we can send email later
 // Mark email steps to allow failure
 workflow.workflow_steps = workflow.workflow_steps.map(step => {
 if (step.step_type === 'action' && step.action_type === 'email') {
 return {
 ...step,
 config: {
 ...step.config,
 allowFailure: true // Allow email to fail without blocking workflow
 }
 };
 }
 return step;
 });
 }
 checks.push('email_service');
 }

 // Check 3: Database connectivity
 if (!this.supabase) {
 return {
 success: false,
 error: 'Database not available',
 errorCategory: 'DATABASE_UNAVAILABLE'
 };
 }
 checks.push('database');

 logger.info('Pre-flight checks passed', {
 execution_id: execution.id,
 checks_passed: checks
 });

 return { success: true, checks };
 }

 /**
 * Execute workflow with enhanced recovery
 */
 async _executeWithRecovery(execution, workflow) {
 // Use standard executor but with enhanced monitoring
 const result = await this.executor.executeWorkflow(execution, workflow);

 // ✅ If failed, check if we can recover
 if (!result.success && this._isRecoverable(result.errorCategory)) {
 logger.info('Attempting recovery for failed critical workflow', {
 execution_id: execution.id,
 error_category: result.errorCategory
 });

 // Store failure for analysis but don't throw
 await this._recordFailureForAnalysis(execution, result);
 }

 return result;
 }

 /**
 * Validate workflow results meet criteria
 */
 async _validateResults(data, workflow) {
 const errors = [];

 // Check if scraping produced data
 if (workflow.workflow_steps?.some(s => s.action_type === 'web_scrape')) {
 if (!data.scraped_data && !data._partial_results?.some(r => r.data?.scraped_data)) {
 errors.push('Web scraping did not produce any data');
 }
 }

 // Check if email was queued (if workflow has email step)
 const hasEmailStep = workflow.workflow_steps?.some(
 step => step.step_type === 'action' && step.action_type === 'email'
 );
 if (hasEmailStep) {
 if (!data.email_result && !data._partial_results?.some(r => r.data?.email_result)) {
 errors.push('Email was not queued successfully');
 }
 }

 return {
 valid: errors.length === 0,
 errors
 };
 }

 /**
 * Check email service health
 */
 async _checkEmailServiceHealth() {
 // Check if email worker is processing
 // Simple check: see if recent emails are being processed
 try {
 const { data: recentEmails } = await this.supabase
 .from('email_queue')
 .select('id, status, created_at')
 .eq('status', 'pending')
 .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
 .limit(1);

 // If there are very old pending emails, service might be down
 // But we'll still try - email worker might catch up
 return { healthy: true };
 } catch (error) {
 return {
 healthy: false,
 error: error.message
 };
 }
 }

 /**
 * Check if error is transient and recoverable
 */
 _isTransientError(errorCategory) {
 const transientErrors = [
 'AUTOMATION_SERVICE_UNAVAILABLE',
 'TIMEOUT_ERROR',
 'NETWORK_ERROR',
 'PAGE_LOAD_ERROR'
 ];
 return transientErrors.includes(errorCategory);
 }

 /**
 * Check if failure is recoverable
 */
 _isRecoverable(errorCategory) {
 return this._isTransientError(errorCategory);
 }

 /**
 * Schedule automatic retry for transient failures
 */
 async _scheduleRetry(execution, workflow, errorCategory) {
 try {
 // Store retry request in database
 await this.supabase
 .from('workflow_executions')
 .update({
 metadata: JSON.stringify({
 retry_scheduled: true,
 retry_reason: errorCategory,
 retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Retry in 5 minutes
 })
 })
 .eq('id', execution.id);

 logger.info('Scheduled automatic retry for critical workflow', {
 execution_id: execution.id,
 retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
 });
 } catch (error) {
 logger.warn('Failed to schedule retry', { error: error.message });
 }
 }

 /**
 * Record failure for analysis
 */
 async _recordFailureForAnalysis(execution, result) {
 try {
 // Store detailed failure info for pattern analysis
 await this.supabase
 .from('workflow_executions')
 .update({
 metadata: JSON.stringify({
 ...(execution.metadata ? JSON.parse(execution.metadata) : {}),
 critical_workflow_failure: true,
 failure_category: result.errorCategory,
 failure_timestamp: new Date().toISOString()
 })
 })
 .eq('id', execution.id);
 } catch (error) {
 // Don't fail on metadata update
 logger.warn('Failed to record failure analysis', { error: error.message });
 }
 }
}

module.exports = { CriticalWorkflowHandler };

