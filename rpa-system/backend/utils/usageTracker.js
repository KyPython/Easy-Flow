
const { logger, getLogger } = require('./logger');
const { createClient } = require('@supabase/supabase-js');

class UsageTracker {
  constructor() {
    this.supabase = null;
    this.initialized = false;
  }

  initialize(supabaseClient) {
    this.supabase = supabaseClient;
    this.initialized = true;
  }

  async trackAutomationRun(userId, runId, status = 'started') {
    if (!this.initialized || !this.supabase) {
      logger.warn('[UsageTracker] Not initialized, skipping automation run tracking');
      return;
    }

    try {
      // Only count completed runs towards monthly quota
      if (status === 'completed') {
        // Get user's current billing period instead of calendar month
        const { data: billingPeriod, error: billingError } = await this.supabase
          .rpc('get_user_billing_period', { user_uuid: userId })
          .single();

        if (billingError) {
          logger.error('[UsageTracker] Error getting billing period:', billingError);
          return;
        }

        // Get current billing period's run count
        const { count, error: countError } = await this.supabase
          .from('automation_runs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('created_at', billingPeriod.period_start)
          .lte('created_at', billingPeriod.period_end);

        if (countError) {
          logger.error('[UsageTracker] Error counting automation runs:', countError);
          return;
        }

        logger.info(`[UsageTracker] User ${userId} has ${count} completed runs this billing period`);

        // Update or insert usage record
        await this.updateUserUsage(userId, {
          monthly_runs: count,
          last_run_at: new Date().toISOString()
        });
      }

      logger.info(`[UsageTracker] Tracked automation run ${runId} for user ${userId} (${status})`);
    } catch (error) {
      logger.error('[UsageTracker] Error tracking automation run:', error);
    }
  }

  async trackWorkflowChange(userId, workflowId, action = 'created') {
    if (!this.initialized || !this.supabase) {
      logger.warn('[UsageTracker] Not initialized, skipping workflow tracking');
      return;
    }

    try {
      // Count ONLY explicitly active workflows (not NULL)
      const { count, error: countError } = await this.supabase
        .from('automation_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true); // Only count explicitly active ones

      if (countError) {
        logger.error('[UsageTracker] Error counting workflows:', countError);
        return;
      }

      logger.info(`[UsageTracker] User ${userId} has ${count} active workflows`);

      // Update usage record
      await this.updateUserUsage(userId, {
        workflows: count,
        last_workflow_change_at: new Date().toISOString()
      });

      // ✅ OBSERVABILITY: Track workflow creation as feature usage for analytics
      if (action === 'created' && this.supabase) {
        try {
          // Check if this is user's first workflow for time-to-first-workflow tracking
          const isFirstWorkflow = count === 1;

          await this.supabase.from('marketing_events').insert([{
            user_id: userId,
            event_name: 'feature_used',
            properties: {
              feature: 'workflow_builder',
              action: 'create',
              workflow_id: workflowId,
              is_first_workflow: isFirstWorkflow,
              total_workflows: count
            },
            created_at: new Date().toISOString()
          }]);
        } catch (trackError) {
          logger.warn('[UsageTracker] Failed to track workflow creation event:', trackError.message);
        }
      }

      logger.info(`[UsageTracker] Tracked workflow ${action} for user ${userId} (${count} total active)`);
    } catch (error) {
      logger.error('[UsageTracker] Error tracking workflow change:', error);
    }
  }

  async trackStorageUsage(userId, filePath, action = 'added', fileSize = 0) {
    if (!this.initialized || !this.supabase) {
      logger.warn('[UsageTracker] Not initialized, skipping storage tracking');
      return;
    }

    try {
      // Calculate total storage from user_files table (where files are tracked)
      const { data: filesData, error: filesError } = await this.supabase
        .from('user_files')
        .select('file_size')
        .eq('user_id', userId);

      if (filesError) {
        logger.error('[UsageTracker] Error calculating storage from user_files:', filesError);
        return;
      }

      let totalBytes = 0;
      if (filesData && filesData.length > 0) {
        totalBytes = filesData.reduce((sum, file) => sum + (file.file_size || 0), 0);
      }

      const storageGB = totalBytes / (1024 * 1024 * 1024);

      logger.info(`[UsageTracker] User ${userId} using ${storageGB.toFixed(3)} GB storage (${filesData?.length || 0} files)`);

      // Update usage record
      await this.updateUserUsage(userId, {
        storage_bytes: totalBytes,
        storage_gb: Math.round(storageGB * 1000) / 1000, // Round to 3 decimal places
        last_storage_update_at: new Date().toISOString()
      });

      logger.info(`[UsageTracker] Tracked storage ${action} for user ${userId}`);
    } catch (error) {
      logger.error('[UsageTracker] Error tracking storage usage:', error);
    }
  }

  async updateUserUsage(userId, usageData) {
    if (!this.initialized || !this.supabase) {
      logger.warn('[UsageTracker] Not initialized, skipping usage update');
      return;
    }

    try {
      // First try to update existing record
      const { data: existingUsage, error: fetchError } = await this.supabase
        .from('user_usage')
        .select('id')
        .eq('user_id', userId)
        .single();

      const updateData = {
        ...usageData,
        updated_at: new Date().toISOString()
      };

      if (existingUsage) {
        // Update existing record
        const { error: updateError } = await this.supabase
          .from('user_usage')
          .update(updateData)
          .eq('user_id', userId);

        if (updateError) {
          logger.error('[UsageTracker] Error updating usage:', updateError);
          return;
        }
      } else {
        // Create new record
        const { error: insertError } = await this.supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            ...updateData,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          logger.error('[UsageTracker] Error inserting usage:', insertError);
          return;
        }
      }

      logger.info(`[UsageTracker] Updated usage for user ${userId}:`, usageData);
    } catch (error) {
      logger.error('[UsageTracker] Error updating user usage:', error);
    }
  }

  async getUserUsage(userId) {
    if (!this.initialized || !this.supabase) {
      logger.warn('[UsageTracker] Not initialized, returning default usage');
      return { monthly_runs: 0, storage_gb: 0, workflows: 0 };
    }

    try {
      const { data: usage, error } = await this.supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('[UsageTracker] Error fetching usage:', error);
        return { monthly_runs: 0, storage_gb: 0, workflows: 0 };
      }

      return usage || { monthly_runs: 0, storage_gb: 0, workflows: 0 };
    } catch (error) {
      logger.error('[UsageTracker] Error getting user usage:', error);
      return { monthly_runs: 0, storage_gb: 0, workflows: 0 };
    }
  }

  async refreshAllUserUsage(userId) {
    logger.info(`[UsageTracker] Refreshing all usage data for user ${userId}`);

    try {
      // Get user's billing period
      const { data: billingPeriod, error: billingError } = await this.supabase
        .rpc('get_user_billing_period', { user_uuid: userId })
        .single();

      if (billingError) {
        logger.error('[UsageTracker] Error getting billing period for refresh:', billingError);
        return;
      }

      // Refresh automation runs count for current billing period
      const { count: runsCount } = await this.supabase
        .from('automation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', billingPeriod.period_start)
        .lte('created_at', billingPeriod.period_end);

      // Refresh workflows count - ONLY explicitly active workflows
      const { count: workflowsCount } = await this.supabase
        .from('automation_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true); // Only count explicitly active ones

      // Update usage with fresh counts
      await this.updateUserUsage(userId, {
        monthly_runs: runsCount || 0,
        workflows: workflowsCount || 0
      });

      // Refresh storage (more expensive operation)
      await this.trackStorageUsage(userId, null, 'refresh');

      logger.info(`[UsageTracker] Refreshed usage: ${runsCount} runs, ${workflowsCount} workflows`);
    } catch (error) {
      logger.error('[UsageTracker] Error refreshing usage:', error);
    }
  }
}

// Create singleton instance
const usageTracker = new UsageTracker();

module.exports = {
  UsageTracker,
  usageTracker
};
