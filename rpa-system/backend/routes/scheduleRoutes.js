
const { logger, getLogger } = require('../utils/logger');
const express = require('express');
const { TriggerService } = require('../services/triggerService');
const { getSupabase } = require('../utils/supabaseClient');

const router = express.Router();
const triggerService = new TriggerService();

// Get all schedules for user
const { requireFeature, getUserPlan } = require('../middleware/planEnforcement');
const { checkScheduledAutomationLimit, checkWebhookLimit } = require('../middleware/comprehensiveRateLimit');

// Use centralized supabase client

router.get('/', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 const { data: schedules, error } = await supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(id, name, status)
 `)
 .eq('user_id', userId)
 .order('created_at', { ascending: false });

 if (error) {
 throw new Error(`Failed to fetch schedules: ${error.message}`);
 }

 res.json({
 schedules: schedules.map(schedule => ({
 ...schedule,
 webhook_url: schedule.schedule_type === 'webhook' && schedule.webhook_token
 ? `${process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`}/api/webhooks/trigger/${schedule.webhook_token}`
 : null
 }))
 });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error fetching schedules:', error);
 res.status(500).json({ error: 'Failed to fetch schedules' });
 }
});

// Get specific schedule
router.get('/:scheduleId', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const { scheduleId } = req.params;
 const userId = req.user?.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 const { data: schedule, error } = await supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(id, name, status, description)
 `)
 .eq('id', scheduleId)
 .eq('user_id', userId)
 .single();

 if (error || !schedule) {
 return res.status(404).json({ error: 'Schedule not found' });
 }

 // Add webhook URL if applicable
 if (schedule.schedule_type === 'webhook' && schedule.webhook_token) {
 schedule.webhook_url = `${process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`}/api/webhooks/trigger/${schedule.webhook_token}`;
 }

 res.json(schedule);

 } catch (error) {
 logger.error('[ScheduleRoutes] Error fetching schedule:', error);
 res.status(500).json({ error: 'Failed to fetch schedule' });
 }
});

// Create new schedule
// PLAN ENFORCEMENT: Checks scheduled_automations feature and daily limits
router.post('/', requireFeature('scheduled_automations'), checkScheduledAutomationLimit, async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const {
 workflowId,
 name,
 scheduleType,
 cronExpression,
 intervalSeconds,
 timezone,
 maxExecutions,
 webhookSecret
 } = req.body;

 // Validate required fields
 if (!workflowId || !name || !scheduleType) {
 return res.status(400).json({
 error: 'Missing required fields: workflowId, name, scheduleType'
 });
 }

 // Validate schedule type specific fields
 if (scheduleType === 'cron' && !cronExpression) {
 return res.status(400).json({
 error: 'cronExpression is required for cron schedules'
 });
 }

 if (scheduleType === 'interval' && (!intervalSeconds || intervalSeconds < 60)) {
 return res.status(400).json({
 error: 'intervalSeconds must be at least 60 for interval schedules'
 });
 }

 // Verify workflow ownership
 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 const { data: workflow, error: workflowError } = await supabase
 .from('workflows')
 .select('id, name, status')
 .eq('id', workflowId)
 .eq('user_id', userId)
 .single();

 if (workflowError || !workflow) {
 return res.status(404).json({ error: 'Workflow not found or access denied' });
 }

 if (workflow.status !== 'active') {
 return res.status(400).json({
 error: `Cannot schedule inactive workflow (status: ${workflow.status})`
 });
 }

 // Create schedule using trigger service
 const scheduleConfig = {
 workflowId,
 userId,
 name,
 scheduleType,
 cronExpression,
 intervalSeconds,
 timezone: timezone || 'UTC',
 maxExecutions,
 isActive: true
 };

 // ✅ BULLETPROOF: If creating a webhook schedule, check webhook limits
 if (scheduleType === 'webhook') {
 // Check webhook limit before creating
 const planData = req.planData || await getUserPlan(userId);
 const webhookValue = planData.limits?.webhook_integrations || planData.limits?.webhook_management;
 const hasWebhooks = typeof webhookValue === 'string'
 ? webhookValue.toLowerCase() !== 'no' && webhookValue !== ''
 : !!webhookValue;

 if (!hasWebhooks) {
 return res.status(403).json({
 error: 'Webhooks not available',
 message: 'This feature requires a Starter plan or higher.',
 feature: 'webhook_integrations',
 current_plan: planData.plan.name,
 upgrade_required: true,
 upgrade_url: '/pricing'
 });
 }

 // Check webhook limit if not unlimited
 const webhookStr = String(webhookValue || '').toLowerCase();
 if (!webhookStr.includes('unlimited')) {
 const supabase = getSupabase();
 if (supabase) {
 const { data: canCreate, error: checkError } = await supabase
 .rpc('can_create_webhook', { user_uuid: userId });

 if (!checkError && !canCreate) {
 const { count } = await supabase
 .from('workflow_schedules')
 .select('id', { count: 'exact', head: true })
 .eq('user_id', userId)
 .eq('schedule_type', 'webhook');

 const match = webhookStr.match(/\d+/);
 const webhookLimit = match ? parseInt(match[0], 10) : 0;

 return res.status(403).json({
 error: 'Webhook limit reached',
 message: `You've reached your webhook limit (${webhookLimit} webhooks). Upgrade for higher limits.`,
 current_plan: planData.plan.name,
 usage: count || 0,
 limit: webhookLimit,
 upgrade_required: true,
 upgrade_url: '/pricing'
 });
 }
 }
 }
 }

 let schedule;
 if (scheduleType === 'webhook') {
 const webhookConfig = {
 name,
 secret: webhookSecret
 };
 const webhookResult = await triggerService.createWebhookSchedule(workflowId, userId, webhookConfig);

 // Get the created schedule
 const { data: createdSchedule, error } = await supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(id, name, status)
 `)
 .eq('id', webhookResult.scheduleId)
 .single();

 if (error) {
 throw new Error(`Failed to fetch created webhook schedule: ${error.message}`);
 }

 schedule = {
 ...createdSchedule,
 webhook_url: `${process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`}${webhookResult.webhookUrl}`
 };
 } else {
 schedule = await triggerService.createSchedule(scheduleConfig);

 // Fetch complete schedule data
 const { data: completeSchedule, error } = await supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(id, name, status)
 `)
 .eq('id', schedule.id)
 .single();

 if (error) {
 throw new Error(`Failed to fetch complete schedule: ${error.message}`);
 }

 schedule = completeSchedule;
 }

 res.status(201).json({
 message: 'Schedule created successfully',
 schedule
 });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error creating schedule:', error);
 res.status(500).json({ error: error.message || 'Failed to create schedule' });
 }
});

// Update schedule
router.put('/:scheduleId', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const { scheduleId } = req.params;
 const userId = req.user?.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const {
 name,
 cronExpression,
 intervalSeconds,
 timezone,
 maxExecutions,
 isActive
 } = req.body;

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // Verify ownership
 const { data: existingSchedule, error: fetchError } = await supabase
 .from('workflow_schedules')
 .select('*')
 .eq('id', scheduleId)
 .eq('user_id', userId)
 .single();

 if (fetchError || !existingSchedule) {
 return res.status(404).json({ error: 'Schedule not found' });
 }

 // Prepare update data
 const updateData = {};
 if (name !== undefined) updateData.name = name;
 if (cronExpression !== undefined) updateData.cron_expression = cronExpression;
 if (intervalSeconds !== undefined) updateData.interval_seconds = intervalSeconds;
 if (timezone !== undefined) updateData.timezone = timezone;
 if (maxExecutions !== undefined) updateData.max_executions = maxExecutions;
 if (isActive !== undefined) updateData.is_active = isActive;

 // Validate cron expression if provided
 if (cronExpression && existingSchedule.schedule_type === 'cron') {
 const cron = require('node-cron');
 if (!cron.validate(cronExpression)) {
 return res.status(400).json({ error: 'Invalid cron expression' });
 }
 }

 // Update schedule
 const { data: updatedSchedule, error: updateError } = await supabase
 .from('workflow_schedules')
 .update(updateData)
 .eq('id', scheduleId)
 .select(`
 *,
 workflow:workflows(id, name, status)
 `)
 .single();

 if (updateError) {
 throw new Error(`Failed to update schedule: ${updateError.message}`);
 }

 // Refresh the schedule in trigger service
 await triggerService.refreshSchedules();

 res.json({
 message: 'Schedule updated successfully',
 schedule: updatedSchedule
 });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error updating schedule:', error);
 res.status(500).json({ error: error.message || 'Failed to update schedule' });
 }
});

// Delete schedule
router.delete('/:scheduleId', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const { scheduleId } = req.params;
 const userId = req.user?.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // Verify ownership
 const { data: schedule, error: fetchError } = await supabase
 .from('workflow_schedules')
 .select('user_id')
 .eq('id', scheduleId)
 .single();

 if (fetchError || !schedule || schedule.user_id !== userId) {
 return res.status(404).json({ error: 'Schedule not found' });
 }

 // Delete using trigger service
 await triggerService.deleteSchedule(scheduleId);

 res.json({ message: 'Schedule deleted successfully' });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error deleting schedule:', error);
 res.status(500).json({ error: error.message || 'Failed to delete schedule' });
 }
});

// Trigger schedule manually
router.post('/:scheduleId/trigger', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const { scheduleId } = req.params;
 const userId = req.user?.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 // Get schedule
 const { data: schedule, error } = await supabase
 .from('workflow_schedules')
 .select(`
 *,
 workflow:workflows(*)
 `)
 .eq('id', scheduleId)
 .eq('user_id', userId)
 .single();

 if (error || !schedule) {
 return res.status(404).json({ error: 'Schedule not found' });
 }

 // Execute workflow manually
 const { WorkflowExecutor } = require('../services/workflowExecutor');
 const workflowExecutor = new WorkflowExecutor();

 const execution = await workflowExecutor.startExecution({
 workflowId: schedule.workflow_id,
 userId: schedule.user_id,
 triggeredBy: 'manual',
 triggerData: {
 scheduleId: schedule.id,
 manualTrigger: true
 }
 });

 res.json({
 message: 'Workflow triggered successfully',
 execution_id: execution.id,
 workflow_name: schedule.workflow.name
 });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error triggering schedule:', error);
 res.status(500).json({ error: error.message || 'Failed to trigger workflow' });
 }
});

// Get schedule execution history
router.get('/:scheduleId/executions', requireFeature('scheduled_automations'), async (req, res) => {
 try {
 const { scheduleId } = req.params;
 const userId = req.user?.id;
 const { limit = 50, offset = 0 } = req.query;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const { createClient } = require('@supabase/supabase-js');
 const supabase = createClient(
 process.env.SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
 );

 // Verify schedule ownership
 const { data: schedule, error: scheduleError } = await supabase
 .from('workflow_schedules')
 .select('user_id, workflow_id')
 .eq('id', scheduleId)
 .single();

 if (scheduleError || !schedule || schedule.user_id !== userId) {
 return res.status(404).json({ error: 'Schedule not found' });
 }

 // Get executions triggered by this schedule
 const { data: executions, error: executionsError } = await supabase
 .from('workflow_executions')
 .select(`
 id,
 status,
 started_at,
 completed_at,
 duration_seconds,
 steps_executed,
 steps_total,
 error_message,
 triggered_by,
 trigger_data
 `)
 .eq('workflow_id', schedule.workflow_id)
 .eq('user_id', userId)
 .contains('trigger_data', { scheduleId })
 .order('started_at', { ascending: false })
 .range(offset, offset + limit - 1);

 if (executionsError) {
 throw new Error(`Failed to fetch executions: ${executionsError.message}`);
 }

 res.json({
 executions,
 pagination: {
 limit: parseInt(limit),
 offset: parseInt(offset),
 has_more: executions.length === parseInt(limit)
 }
 });

 } catch (error) {
 logger.error('[ScheduleRoutes] Error fetching executions:', error);
 res.status(500).json({ error: 'Failed to fetch execution history' });
 }
});

module.exports = router;
