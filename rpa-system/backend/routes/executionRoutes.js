
const { logger, getLogger } = require('../utils/logger');

const express = require('express');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');
const { LinkDiscoveryService } = require('../services/linkDiscoveryService');
const { createContextLogger } = require('../middleware/traceContext');

const router = express.Router();

// Using centralized Supabase client (getSupabase)

// Get execution details with step_executions
router.get('/:executionId', requireFeature('workflow_executions'), async (req, res) => {
 // ✅ Create context-aware logger with business attributes
 const logger = createContextLogger({
 userId: req.user?.id,
 executionId: req.params.executionId,
 operation: 'get_execution_details'
 });

 try {
 const userId = req.user?.id;
 if (!userId) {
 logger.warn('Authentication required for execution details');
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { executionId } = req.params;
 logger.info('Fetching execution details', { executionId });

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // ✅ PERFORMANCE: Detail view query - explicitly select all fields needed
 // This is a separate optimized query called only when viewing execution details
 // Includes large JSON fields (input_data, output_data) that are excluded from list queries
 const { data: execution, error } = await supabase
 .from('workflow_executions')
 .select(`
 *,
 step_executions(
 *,
 workflow_steps(*)
 )
 `)
 .eq('id', executionId)
 .single();

 if (error || !execution) {
 logger.warn('Execution not found', { executionId, error: error?.message });
 return res.status(404).json({ error: 'Execution not found' });
 }

 if (execution.user_id !== userId) {
 logger.warn('Access denied - execution belongs to different user', {
 executionId,
 executionUserId: execution.user_id,
 requestUserId: userId
 });
 return res.status(403).json({ error: 'Access denied' });
 }

 logger.info('Execution details retrieved successfully', {
 executionId,
 stepCount: execution.step_executions?.length || 0,
 status: execution.status
 });

 return res.json({ execution });
 } catch (e) {
 logger.error('Failed to fetch execution details', e, {
 executionId: req.params.executionId,
 operation: 'get_execution_details'
 });
 return res.status(500).json({ error: 'Failed to fetch execution' });
 }
});

// Get execution step logs
router.get('/:executionId/steps', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) return res.status(401).json({ error: 'Authentication required' });

 const { executionId } = req.params;
 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // Verify ownership via execution
 const { data: execution, error: execError } = await supabase
 .from('workflow_executions')
 .select('id,user_id')
 .eq('id', executionId)
 .single();
 if (execError || !execution) return res.status(404).json({ error: 'Execution not found' });
 if (execution.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

 const { data: steps, error } = await supabase
 .from('step_executions')
 .select('*')
 .eq('workflow_execution_id', executionId)
 .order('execution_order', { ascending: true });
 if (error) throw error;

 return res.json({ steps: steps || [] });
 } catch (e) {
 logger.error('[ExecutionRoutes] Get steps error:', e);
 return res.status(500).json({ error: 'Failed to fetch steps' });
 }
});

// Cancel a running execution
router.post('/:executionId/cancel', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { executionId } = req.params;

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // Verify execution exists and belongs to user
 const { data: execution, error: execError } = await supabase
 .from('workflow_executions')
 .select('id, user_id, status')
 .eq('id', executionId)
 .single();

 if (execError || !execution) {
 return res.status(404).json({ error: 'Execution not found' });
 }

 if (execution.user_id !== userId) {
 return res.status(403).json({ error: 'Access denied' });
 }

 if (execution.status !== 'running') {
 return res.status(400).json({ error: `Cannot cancel execution in status: ${execution.status}` });
 }

 // ✅ FIX: Cancel the execution in the WorkflowExecutor first
 // This marks it as cancelled in the runningExecutions map so the workflow loop can check and stop
 const { WorkflowExecutor } = require('../services/workflowExecutor');
 const cancelled = await WorkflowExecutor.cancelExecutionById(executionId);
 if (!cancelled) {
 logger.warn('[ExecutionRoutes] Execution not found in registry (may have already completed)', { execution_id: executionId });
 }

 // Mark as cancelled in database
 const { error: updateError } = await supabase
 .from('workflow_executions')
 .update({
 status: 'cancelled',
 completed_at: new Date().toISOString(),
 error_message: 'Execution cancelled by user'
 })
 .eq('id', executionId);

 if (updateError) {
 throw new Error(updateError.message);
 }

 logger.info('[ExecutionRoutes] Execution cancelled', { execution_id: executionId, user_id: userId });

 return res.json({ success: true, message: 'Execution cancelled successfully' });
 } catch (error) {
 logger.error('[ExecutionRoutes] Cancel error:', error);
 return res.status(500).json({ error: 'Failed to cancel execution' });
 }
});

// Test link discovery for Invoice Download tasks
router.post('/test-link-discovery', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const {
 url,
 username,
 password,
 discoveryMethod = 'auto-detect',
 discoveryValue
 } = req.body;

 // Validate required fields
 if (!url || !username || !password) {
 return res.status(400).json({
 error: 'Missing required fields: url, username, password'
 });
 }

 // ✅ REMOVED: CSS selector option - not user-friendly, auto-detect works 99% of the time

 if (discoveryMethod === 'text-match' && !discoveryValue) {
 return res.status(400).json({
 error: 'Link Text is required when using text-match method'
 });
 }

 logger.info(`[TestLinkDiscovery] Starting test for user ${userId}:`, {
 url, username: (username && typeof username === 'string') ? username.substring(0, 3) + '***' : 'unknown', discoveryMethod
 });

 const linkDiscovery = new LinkDiscoveryService();

 // Run discovery in test mode
 const discoveryResult = await linkDiscovery.discoverPdfLinks({
 url,
 username,
 password,
 discoveryMethod,
 discoveryValue,
 testMode: true
 });

 logger.info('[TestLinkDiscovery] Discovery completed:', {
 success: discoveryResult.success,
 linksFound: discoveryResult.discoveredLinks?.length || 0
 });

 return res.json({
 success: true,
 discoveryResult
 });

 } catch (error) {
 logger.error('[TestLinkDiscovery] Error:', error);
 return res.status(500).json({
 error: 'Link discovery test failed',
 details: error.message
 });
 }
});

// ✅ PHASE 3: Analytics endpoints
const { WorkflowMetricsService } = require('../services/workflowMetrics');

// Get workflow analytics
router.get('/analytics/summary', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { days = 30, workflowId } = req.query;
 const metricsService = new WorkflowMetricsService();

 const analytics = await metricsService.getWorkflowAnalytics(userId, {
 workflowId: workflowId || null,
 days: parseInt(days, 10),
 groupBy: 'day'
 });

 res.json(analytics);
 } catch (error) {
 logger.error('[ExecutionRoutes] Analytics error:', error);
 res.status(500).json({ error: 'Failed to fetch analytics' });
 }
});

// Get error breakdown
router.get('/analytics/errors', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { days = 30 } = req.query;
 const metricsService = new WorkflowMetricsService();

 const breakdown = await metricsService.getErrorBreakdown(userId, parseInt(days, 10));

 res.json({ error_breakdown: breakdown });
 } catch (error) {
 logger.error('[ExecutionRoutes] Error breakdown error:', error);
 res.status(500).json({ error: 'Failed to fetch error breakdown' });
 }
});

// Get success rate by workflow
router.get('/analytics/success-rates', requireFeature('workflow_executions'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { days = 30 } = req.query;
 const metricsService = new WorkflowMetricsService();

 const successRates = await metricsService.getSuccessRateByWorkflow(userId, parseInt(days, 10));

 res.json({ success_rates: successRates });
 } catch (error) {
 logger.error('[ExecutionRoutes] Success rates error:', error);
 res.status(500).json({ error: 'Failed to fetch success rates' });
 }
});

module.exports = router;
