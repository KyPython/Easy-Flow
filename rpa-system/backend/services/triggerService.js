const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const crypto = require('crypto');
const { WorkflowExecutor } = require('./workflowExecutor');

class TriggerService {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.supabase = null;
      console.warn('[TriggerService] Supabase not configured (missing SUPABASE_URL or key). Scheduler disabled.');
    }
    this.workflowExecutor = new WorkflowExecutor();
    this.activeJobs = new Map(); // Track active cron jobs
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    if (!this.supabase) {
      console.warn('[TriggerService] Skipping initialization: Supabase client unavailable.');
      this.initialized = true;
      return;
    }
    
    console.log('[TriggerService] Initializing automation trigger system...');
    
    // Load and schedule all active workflows
    await this.loadActiveSchedules();
    
    // Set up periodic refresh of schedules (every 5 minutes)
    cron.schedule('*/5 * * * *', () => {
      this.refreshSchedules();
    });
    
    this.initialized = true;
    console.log('[TriggerService] Automation trigger system initialized');
  }

  async loadActiveSchedules() {
    try {
  if (!this.supabase) return;
      const { data: schedules, error } = await this.supabase
        .from('workflow_schedules')
        .select(`
          *,
          workflow:workflows(*)
        `)
        .eq('is_active', true);

      if (error) {
        console.error('[TriggerService] Error loading schedules:', error);
        return;
      }

      console.log(`[TriggerService] Loading ${schedules.length} active schedules`);
      
      for (const schedule of schedules) {
        await this.scheduleWorkflow(schedule);
      }
    } catch (error) {
      console.error('[TriggerService] Failed to load active schedules:', error);
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
          
          console.log(`[TriggerService] Scheduled cron workflow: ${workflow.name} (${cron_expression})`);
          
          // Update next trigger time
          await this.updateNextTriggerTime(id, this.getNextCronTime(cron_expression, schedule.timezone));
          
        } else {
          console.error(`[TriggerService] Invalid cron expression for schedule ${id}: ${cron_expression}`);
        }
        
      } else if (schedule_type === 'interval' && interval_seconds) {
        // Schedule interval-based job
        const intervalMs = interval_seconds * 1000;
        const intervalId = setInterval(async () => {
          await this.executeScheduledWorkflow(schedule);
        }, intervalMs);
        
        this.activeJobs.set(id, { type: 'interval', intervalId });
        
        console.log(`[TriggerService] Scheduled interval workflow: ${workflow.name} (every ${interval_seconds}s)`);
        
        // Update next trigger time
        const nextTrigger = new Date(Date.now() + intervalMs);
        await this.updateNextTriggerTime(id, nextTrigger.toISOString());
      }
      
    } catch (error) {
      console.error(`[TriggerService] Failed to schedule workflow ${schedule.id}:`, error);
    }
  }

  async executeScheduledWorkflow(schedule) {
    try {
      const { workflow_id, user_id, id: schedule_id } = schedule;
      
      console.log(`[TriggerService] Executing scheduled workflow: ${workflow_id}`);
      
      // Check execution limits
      if (schedule.max_executions && schedule.execution_count >= schedule.max_executions) {
        console.log(`[TriggerService] Schedule ${schedule_id} reached max executions, deactivating`);
        await this.deactivateSchedule(schedule_id);
        return;
      }
      
      // Start workflow execution
      const execution = await this.workflowExecutor.startExecution({
        workflowId: workflow_id,
        userId: user_id,
        triggeredBy: 'schedule',
        triggerData: { scheduleId: schedule_id }
      });
      
      // Update schedule stats
      await this.updateScheduleStats(schedule_id);
      
      console.log(`[TriggerService] Started execution ${execution.id} for schedule ${schedule_id}`);
      
    } catch (error) {
      console.error(`[TriggerService] Failed to execute scheduled workflow:`, error);
    }
  }

  async refreshSchedules() {
    try {
      console.log('[TriggerService] Refreshing schedules...');
      
      // Get current active schedules from database
      const { data: currentSchedules, error } = await this.supabase
        .from('workflow_schedules')
        .select(`
          *,
          workflow:workflows(*)
        `)
        .eq('is_active', true);

      if (error) {
        console.error('[TriggerService] Error refreshing schedules:', error);
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
      console.error('[TriggerService] Failed to refresh schedules:', error);
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
      console.log(`[TriggerService] Stopped schedule: ${scheduleId}`);
    }
  }

  async updateNextTriggerTime(scheduleId, nextTriggerTime) {
    try {
      const { error } = await this.supabase
        .from('workflow_schedules')
        .update({ next_trigger_at: nextTriggerTime })
        .eq('id', scheduleId);
        
      if (error) {
        console.error(`[TriggerService] Failed to update next trigger time for ${scheduleId}:`, error);
      }
    } catch (error) {
      console.error(`[TriggerService] Error updating next trigger time:`, error);
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
        console.error(`[TriggerService] Failed to update schedule stats for ${scheduleId}:`, error);
      }
    } catch (error) {
      console.error(`[TriggerService] Error updating schedule stats:`, error);
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
        console.error(`[TriggerService] Failed to deactivate schedule ${scheduleId}:`, error);
      }
    } catch (error) {
      console.error(`[TriggerService] Error deactivating schedule:`, error);
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
      console.error('[TriggerService] Error calculating next cron time:', error);
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
      console.error('[TriggerService] Error creating webhook schedule:', error);
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
      console.error('[TriggerService] Webhook execution failed:', error);
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
      console.error('[TriggerService] Error validating webhook signature:', error);
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
      console.error('[TriggerService] Error creating schedule:', error);
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
      console.error('[TriggerService] Error deleting schedule:', error);
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
    console.log('[TriggerService] Shutting down automation trigger system...');
    
    // Stop all active jobs
    for (const scheduleId of this.activeJobs.keys()) {
      this.stopSchedule(scheduleId);
    }
    
    this.initialized = false;
    console.log('[TriggerService] Automation trigger system shutdown complete');
  }
}

module.exports = { TriggerService };