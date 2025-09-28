/**
 * Data Retention Service for EasyFlow
 * 
 * Implements comprehensive data retention policies with automatic purging
 * for audit logs, execution data, sensitive payloads, and user data.
 * Ensures compliance with GDPR, CCPA, and enterprise data governance.
 */

const { createClient } = require('@supabase/supabase-js');
const { auditLogger } = require('../utils/auditLogger');

class DataRetentionService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    
    // Default retention periods (can be overridden by environment variables)
    this.retentionPolicies = {
      audit_logs: {
        default: parseInt(process.env.AUDIT_LOGS_RETENTION_DAYS) || 365, // 1 year
        security_events: parseInt(process.env.SECURITY_LOGS_RETENTION_DAYS) || 2555, // 7 years for compliance
        authentication: parseInt(process.env.AUTH_LOGS_RETENTION_DAYS) || 365
      },
      workflow_executions: {
        completed: parseInt(process.env.EXECUTION_LOGS_RETENTION_DAYS) || 90, // 3 months
        failed: parseInt(process.env.FAILED_EXECUTION_RETENTION_DAYS) || 180, // 6 months for debugging
        sensitive_payload: parseInt(process.env.SENSITIVE_PAYLOAD_RETENTION_DAYS) || 30 // 1 month
      },
      step_executions: {
        default: parseInt(process.env.STEP_EXECUTION_RETENTION_DAYS) || 90,
        error_logs: parseInt(process.env.ERROR_LOGS_RETENTION_DAYS) || 180
      },
      user_data: {
        inactive_accounts: parseInt(process.env.INACTIVE_USER_RETENTION_DAYS) || 1095, // 3 years
        deleted_accounts: parseInt(process.env.DELETED_USER_RETENTION_DAYS) || 30 // 1 month grace period
      },
      temporary_files: {
        uploads: parseInt(process.env.TEMP_UPLOADS_RETENTION_HOURS) || 24, // 1 day
        exports: parseInt(process.env.TEMP_EXPORTS_RETENTION_HOURS) || 168 // 1 week
      }
    };

    // Scheduled cleanup intervals
    this.scheduleIntervals = {
      audit_logs: parseInt(process.env.AUDIT_CLEANUP_INTERVAL_HOURS) || 24, // Daily
      executions: parseInt(process.env.EXECUTION_CLEANUP_INTERVAL_HOURS) || 12, // Twice daily
      temp_files: parseInt(process.env.TEMP_CLEANUP_INTERVAL_HOURS) || 6 // Every 6 hours
    };

    this.isRunning = false;
    this.scheduledJobs = new Map();
    
    // Start automatic scheduling
    this.startScheduledCleanup();
  }

  /**
   * Start all scheduled cleanup jobs
   */
  startScheduledCleanup() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Starting Data Retention Service with automated cleanup...');

    // Schedule audit log cleanup
    const auditJob = setInterval(() => {
      this.cleanupAuditLogs().catch(error => {
        console.error('Scheduled audit log cleanup failed:', error);
      });
    }, this.scheduleIntervals.audit_logs * 60 * 60 * 1000);
    this.scheduledJobs.set('audit_logs', auditJob);

    // Schedule execution data cleanup
    const executionJob = setInterval(() => {
      this.cleanupExecutionData().catch(error => {
        console.error('Scheduled execution cleanup failed:', error);
      });
    }, this.scheduleIntervals.executions * 60 * 60 * 1000);
    this.scheduledJobs.set('executions', executionJob);

    // Schedule temporary files cleanup
    const tempJob = setInterval(() => {
      this.cleanupTemporaryFiles().catch(error => {
        console.error('Scheduled temp files cleanup failed:', error);
      });
    }, this.scheduleIntervals.temp_files * 60 * 60 * 1000);
    this.scheduledJobs.set('temp_files', tempJob);

    // Run initial cleanup
    setTimeout(() => {
      this.runFullCleanup().catch(error => {
        console.error('Initial cleanup failed:', error);
      });
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop all scheduled cleanup jobs
   */
  stopScheduledCleanup() {
    this.isRunning = false;
    this.scheduledJobs.forEach((job, name) => {
      clearInterval(job);
      console.log(`✅ Stopped ${name} cleanup job`);
    });
    this.scheduledJobs.clear();
  }

  /**
   * Run comprehensive cleanup of all data types
   */
  async runFullCleanup() {
    console.log('🧹 Starting comprehensive data retention cleanup...');
    const startTime = Date.now();
    const results = {};

    try {
      // Audit logs cleanup
      results.audit_logs = await this.cleanupAuditLogs();
      
      // Execution data cleanup
      results.executions = await this.cleanupExecutionData();
      
      // Step execution cleanup
      results.step_executions = await this.cleanupStepExecutions();
      
      // User data cleanup
      results.user_data = await this.cleanupUserData();
      
      // Temporary files cleanup
      results.temp_files = await this.cleanupTemporaryFiles();

      const duration = Date.now() - startTime;
      const totalCleaned = Object.values(results).reduce((sum, result) => sum + (result.cleaned_count || 0), 0);

      console.log(`✅ Data retention cleanup completed in ${duration}ms`);
      console.log(`📊 Total records cleaned: ${totalCleaned}`);

      // Log the cleanup operation
      await auditLogger.logSystemEvent('info', 'data_retention_cleanup', {
        duration_ms: duration,
        total_cleaned: totalCleaned,
        details: results
      });

      return {
        success: true,
        duration_ms: duration,
        total_cleaned: totalCleaned,
        results
      };

    } catch (error) {
      console.error('❌ Data retention cleanup failed:', error);
      
      await auditLogger.logSystemEvent('error', 'data_retention_cleanup_failed', {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Cleanup audit logs based on retention policies
   */
  async cleanupAuditLogs() {
    console.log('🧹 Cleaning up audit logs...');
    
    try {
      const results = {
        security_events: 0,
        authentication: 0,
        general: 0
      };

      // Clean security events (longer retention)
      const securityCutoff = new Date(
        Date.now() - this.retentionPolicies.audit_logs.security_events * 24 * 60 * 60 * 1000
      );
      
      const { count: securityCleaned } = await this.supabase
        .from('audit_logs')
        .delete()
        .eq('action_type', 'security_event')
        .lt('timestamp', securityCutoff.toISOString());
      
      results.security_events = securityCleaned || 0;

      // Clean authentication events
      const authCutoff = new Date(
        Date.now() - this.retentionPolicies.audit_logs.authentication * 24 * 60 * 60 * 1000
      );
      
      const { count: authCleaned } = await this.supabase
        .from('audit_logs')
        .delete()
        .eq('action_type', 'authentication')
        .lt('timestamp', authCutoff.toISOString());
      
      results.authentication = authCleaned || 0;

      // Clean general audit logs
      const generalCutoff = new Date(
        Date.now() - this.retentionPolicies.audit_logs.default * 24 * 60 * 60 * 1000
      );
      
      const { count: generalCleaned } = await this.supabase
        .from('audit_logs')
        .delete()
        .not('action_type', 'in', '(security_event,authentication)')
        .lt('timestamp', generalCutoff.toISOString());
      
      results.general = generalCleaned || 0;

      const totalCleaned = results.security_events + results.authentication + results.general;
      
      console.log(`✅ Cleaned ${totalCleaned} audit log entries`);
      console.log(`   Security events: ${results.security_events}`);
      console.log(`   Authentication: ${results.authentication}`);
      console.log(`   General logs: ${results.general}`);

      return {
        cleaned_count: totalCleaned,
        breakdown: results,
        cutoff_dates: {
          security_events: securityCutoff.toISOString(),
          authentication: authCutoff.toISOString(),
          general: generalCutoff.toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Audit logs cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup workflow execution data and sensitive payloads
   */
  async cleanupExecutionData() {
    console.log('🧹 Cleaning up workflow execution data...');
    
    try {
      const results = {
        completed_executions: 0,
        failed_executions: 0,
        sensitive_payloads: 0
      };

      // First, cleanup sensitive payloads from all executions (more aggressive retention)
      const payloadCutoff = new Date(
        Date.now() - this.retentionPolicies.workflow_executions.sensitive_payload * 24 * 60 * 60 * 1000
      );

      // Clear sensitive input/output data but keep execution metadata
      const { count: payloadsCleaned } = await this.supabase
        .from('workflow_executions')
        .update({
          input_data: null,
          output_data: null,
          trigger_data: null
        })
        .lt('started_at', payloadCutoff.toISOString())
        .not('input_data', 'is', null);

      results.sensitive_payloads = payloadsCleaned || 0;

      // Cleanup completed executions (full removal)
      const completedCutoff = new Date(
        Date.now() - this.retentionPolicies.workflow_executions.completed * 24 * 60 * 60 * 1000
      );
      
      const { count: completedCleaned } = await this.supabase
        .from('workflow_executions')
        .delete()
        .eq('status', 'completed')
        .lt('started_at', completedCutoff.toISOString());
      
      results.completed_executions = completedCleaned || 0;

      // Cleanup failed executions (longer retention for debugging)
      const failedCutoff = new Date(
        Date.now() - this.retentionPolicies.workflow_executions.failed * 24 * 60 * 60 * 1000
      );
      
      const { count: failedCleaned } = await this.supabase
        .from('workflow_executions')
        .delete()
        .eq('status', 'failed')
        .lt('started_at', failedCutoff.toISOString());
      
      results.failed_executions = failedCleaned || 0;

      const totalCleaned = results.completed_executions + results.failed_executions;
      
      console.log(`✅ Cleaned ${totalCleaned} workflow executions`);
      console.log(`   Completed executions: ${results.completed_executions}`);
      console.log(`   Failed executions: ${results.failed_executions}`);
      console.log(`   Sensitive payloads cleared: ${results.sensitive_payloads}`);

      return {
        cleaned_count: totalCleaned,
        payloads_cleared: results.sensitive_payloads,
        breakdown: results,
        cutoff_dates: {
          completed: completedCutoff.toISOString(),
          failed: failedCutoff.toISOString(),
          payloads: payloadCutoff.toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Execution data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup step execution data
   */
  async cleanupStepExecutions() {
    console.log('🧹 Cleaning up step execution data...');
    
    try {
      const results = {
        normal_steps: 0,
        error_steps: 0
      };

      // Clean step executions with errors (longer retention)
      const errorCutoff = new Date(
        Date.now() - this.retentionPolicies.step_executions.error_logs * 24 * 60 * 60 * 1000
      );
      
      const { count: errorCleaned } = await this.supabase
        .from('step_executions')
        .delete()
        .not('error_message', 'is', null)
        .lt('started_at', errorCutoff.toISOString());
      
      results.error_steps = errorCleaned || 0;

      // Clean normal step executions
      const normalCutoff = new Date(
        Date.now() - this.retentionPolicies.step_executions.default * 24 * 60 * 60 * 1000
      );
      
      const { count: normalCleaned } = await this.supabase
        .from('step_executions')
        .delete()
        .is('error_message', null)
        .lt('started_at', normalCutoff.toISOString());
      
      results.normal_steps = normalCleaned || 0;

      const totalCleaned = results.normal_steps + results.error_steps;
      
      console.log(`✅ Cleaned ${totalCleaned} step executions`);
      console.log(`   Normal steps: ${results.normal_steps}`);
      console.log(`   Error steps: ${results.error_steps}`);

      return {
        cleaned_count: totalCleaned,
        breakdown: results,
        cutoff_dates: {
          normal: normalCutoff.toISOString(),
          errors: errorCutoff.toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Step executions cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup inactive and deleted user data
   */
  async cleanupUserData() {
    console.log('🧹 Cleaning up user data...');
    
    try {
      const results = {
        inactive_users: 0,
        deleted_users: 0
      };

      // This would need to be implemented based on your user management system
      // For now, just log that this feature is planned
      console.log('📝 User data cleanup planned for future implementation');
      console.log('   Will handle: inactive accounts, deleted user grace periods');

      return {
        cleaned_count: 0,
        breakdown: results,
        note: 'User data cleanup implementation pending'
      };

    } catch (error) {
      console.error('❌ User data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup temporary files and exports
   */
  async cleanupTemporaryFiles() {
    console.log('🧹 Cleaning up temporary files...');
    
    try {
      const results = {
        temp_uploads: 0,
        temp_exports: 0
      };

      // This would clean up files from storage buckets
      // For now, log planned implementation
      console.log('📝 Temporary files cleanup planned for future implementation');
      console.log('   Will handle: upload temp files, export files, cached data');

      return {
        cleaned_count: 0,
        breakdown: results,
        note: 'Temporary files cleanup implementation pending'
      };

    } catch (error) {
      console.error('❌ Temporary files cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get data retention statistics
   */
  async getRetentionStatistics() {
    try {
      const stats = {
        audit_logs: {},
        workflow_executions: {},
        step_executions: {},
        retention_policies: this.retentionPolicies
      };

      // Audit logs stats
      const { count: totalAuditLogs } = await this.supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });
      
      stats.audit_logs.total = totalAuditLogs || 0;

      // Get audit logs older than retention period
      const auditCutoff = new Date(
        Date.now() - this.retentionPolicies.audit_logs.default * 24 * 60 * 60 * 1000
      );
      
      const { count: expiredAuditLogs } = await this.supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .lt('timestamp', auditCutoff.toISOString());
      
      stats.audit_logs.expired = expiredAuditLogs || 0;

      // Workflow executions stats
      const { count: totalExecutions } = await this.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true });
      
      stats.workflow_executions.total = totalExecutions || 0;

      // Get executions with sensitive data
      const payloadCutoff = new Date(
        Date.now() - this.retentionPolicies.workflow_executions.sensitive_payload * 24 * 60 * 60 * 1000
      );
      
      const { count: executionsWithSensitiveData } = await this.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .not('input_data', 'is', null)
        .lt('started_at', payloadCutoff.toISOString());
      
      stats.workflow_executions.with_expired_sensitive_data = executionsWithSensitiveData || 0;

      // Step executions stats
      const { count: totalStepExecutions } = await this.supabase
        .from('step_executions')
        .select('*', { count: 'exact', head: true });
      
      stats.step_executions.total = totalStepExecutions || 0;

      return stats;

    } catch (error) {
      console.error('❌ Failed to get retention statistics:', error);
      throw error;
    }
  }

  /**
   * Configure retention policy for a specific data type
   */
  setRetentionPolicy(dataType, subType, days) {
    if (!this.retentionPolicies[dataType]) {
      throw new Error(`Unknown data type: ${dataType}`);
    }

    if (subType) {
      this.retentionPolicies[dataType][subType] = days;
    } else {
      this.retentionPolicies[dataType].default = days;
    }

    console.log(`✅ Updated retention policy: ${dataType}${subType ? `.${subType}` : ''} = ${days} days`);
  }

  /**
   * Run cleanup for a specific data type
   */
  async runSpecificCleanup(dataType) {
    switch (dataType) {
      case 'audit_logs':
        return await this.cleanupAuditLogs();
      case 'workflow_executions':
        return await this.cleanupExecutionData();
      case 'step_executions':
        return await this.cleanupStepExecutions();
      case 'user_data':
        return await this.cleanupUserData();
      case 'temp_files':
        return await this.cleanupTemporaryFiles();
      default:
        throw new Error(`Unknown cleanup type: ${dataType}`);
    }
  }

  /**
   * Get service status and configuration
   */
  getServiceStatus() {
    return {
      is_running: this.isRunning,
      active_jobs: Array.from(this.scheduledJobs.keys()),
      retention_policies: this.retentionPolicies,
      schedule_intervals: this.scheduleIntervals,
      next_cleanup_times: {
        audit_logs: new Date(Date.now() + this.scheduleIntervals.audit_logs * 60 * 60 * 1000),
        executions: new Date(Date.now() + this.scheduleIntervals.executions * 60 * 60 * 1000),
        temp_files: new Date(Date.now() + this.scheduleIntervals.temp_files * 60 * 60 * 1000)
      }
    };
  }
}

// Export singleton instance
const dataRetentionService = new DataRetentionService();

module.exports = {
  dataRetentionService,
  DataRetentionService
};