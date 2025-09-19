/**
 * Audit Logger for EasyFlow
 * 
 * Tracks all user actions, automation executions, and system events
 * for security, compliance, and debugging purposes.
 */

const { createClient } = require('@supabase/supabase-js');

class AuditLogger {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Cache settings
    this.logBuffer = [];
    this.bufferSize = parseInt(process.env.AUDIT_BUFFER_SIZE) || 100;
    this.flushInterval = parseInt(process.env.AUDIT_FLUSH_INTERVAL) || 30000; // 30 seconds
    
    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Log user action with comprehensive context
   */
  async logUserAction(userId, action, details = {}, request = null) {
    const logEntry = {
      user_id: userId,
      action_type: 'user_action',
      action: action,
      details: details,
      ip_address: request?.ip || request?.connection?.remoteAddress || 'unknown',
      user_agent: request?.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      session_id: request?.sessionID || null,
      request_id: request?.id || this.generateRequestId()
    };

    return this.addToBuffer(logEntry);
  }

  /**
   * Log automation execution with full context
   */
  async logAutomationExecution(userId, taskId, taskType, status, details = {}) {
    const logEntry = {
      user_id: userId,
      action_type: 'automation_execution',
      action: `automation_${status}`,
      details: {
        task_id: taskId,
        task_type: taskType,
        status: status,
        ...details
      },
      timestamp: new Date().toISOString(),
      request_id: this.generateRequestId()
    };

    return this.addToBuffer(logEntry);
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(userId, action, success, details = {}, request = null) {
    const logEntry = {
      user_id: userId,
      action_type: 'authentication',
      action: action,
      details: {
        success: success,
        ...details
      },
      ip_address: request?.ip || 'unknown',
      user_agent: request?.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      request_id: this.generateRequestId()
    };

    return this.addToBuffer(logEntry);
  }

  /**
   * Log system events (errors, warnings, etc.)
   */
  async logSystemEvent(level, event, details = {}, userId = null) {
    const logEntry = {
      user_id: userId,
      action_type: 'system_event',
      action: event,
      details: {
        level: level,
        ...details
      },
      timestamp: new Date().toISOString(),
      request_id: this.generateRequestId()
    };

    return this.addToBuffer(logEntry);
  }

  /**
   * Log data access events for compliance
   */
  async logDataAccess(userId, resource, action, details = {}) {
    const logEntry = {
      user_id: userId,
      action_type: 'data_access',
      action: `${action}_${resource}`,
      details: {
        resource: resource,
        access_type: action,
        ...details
      },
      timestamp: new Date().toISOString(),
      request_id: this.generateRequestId()
    };

    return this.addToBuffer(logEntry);
  }

  /**
   * Log security events (suspicious activity, rate limiting, etc.)
   */
  async logSecurityEvent(userId, event, severity, details = {}, request = null) {
    const logEntry = {
      user_id: userId,
      action_type: 'security_event',
      action: event,
      details: {
        severity: severity,
        ...details
      },
      ip_address: request?.ip || 'unknown',
      user_agent: request?.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      request_id: this.generateRequestId()
    };

    // Security events bypass buffer and are logged immediately
    return this.writeToDatabase([logEntry]);
  }

  /**
   * Add log entry to buffer for batch processing
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);

    // Flush buffer if it's full
    if (this.logBuffer.length >= this.bufferSize) {
      return this.flushBuffer();
    }

    return Promise.resolve();
  }

  /**
   * Flush log buffer to database
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToWrite = [...this.logBuffer];
    this.logBuffer = [];

    return this.writeToDatabase(logsToWrite);
  }

  /**
   * Write logs directly to database
   */
  async writeToDatabase(logs) {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert(logs);

      if (error) {
        console.error('Failed to write audit logs:', error);
        // Re-add failed logs to buffer for retry
        this.logBuffer = [...logs, ...this.logBuffer];
        throw error;
      }

      console.log(`✅ Wrote ${logs.length} audit logs to database`);
    } catch (error) {
      console.error('Audit logging error:', error);
      throw error;
    }
  }

  /**
   * Start periodic buffer flush
   */
  startPeriodicFlush() {
    setInterval(() => {
      this.flushBuffer().catch(error => {
        console.error('Periodic audit log flush failed:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get audit logs for a specific user (for API/dashboard)
   */
  async getUserAuditLogs(userId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        actionType,
        action,
        limit = 100,
        offset = 0
      } = filters;

      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      if (action) {
        query = query.eq('action', action);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        logs: data,
        total: count,
        limit: limit,
        offset: offset
      };
    } catch (error) {
      console.error('Failed to fetch user audit logs:', error);
      throw error;
    }
  }

  /**
   * Get system-wide audit logs (admin only)
   */
  async getSystemAuditLogs(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        actionType,
        userId,
        severity,
        limit = 100,
        offset = 0
      } = filters;

      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (severity) {
        query = query.contains('details', { severity });
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        logs: data,
        total: count,
        limit: limit,
        offset: offset
      };
    } catch (error) {
      console.error('Failed to fetch system audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getAuditStatistics(userId = null, timeframe = '24h') {
    try {
      const timeframes = {
        '1h': new Date(Date.now() - 60 * 60 * 1000),
        '24h': new Date(Date.now() - 24 * 60 * 60 * 1000),
        '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      };

      const since = timeframes[timeframe] || timeframes['24h'];

      let query = this.supabase
        .from('audit_logs')
        .select('action_type, action, details')
        .gte('timestamp', since.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process statistics
      const stats = {
        total_actions: data.length,
        by_action_type: {},
        by_action: {},
        automation_stats: {
          total_executions: 0,
          successful: 0,
          failed: 0,
          by_type: {}
        },
        timeframe: timeframe
      };

      data.forEach(log => {
        // Count by action type
        stats.by_action_type[log.action_type] = 
          (stats.by_action_type[log.action_type] || 0) + 1;

        // Count by specific action
        stats.by_action[log.action] = 
          (stats.by_action[log.action] || 0) + 1;

        // Automation specific stats
        if (log.action_type === 'automation_execution') {
          stats.automation_stats.total_executions++;
          
          const status = log.details?.status;
          if (status === 'success' || status === 'completed') {
            stats.automation_stats.successful++;
          } else if (status === 'failed' || status === 'error') {
            stats.automation_stats.failed++;
          }

          const taskType = log.details?.task_type;
          if (taskType) {
            stats.automation_stats.by_type[taskType] = 
              (stats.automation_stats.by_type[taskType] || 0) + 1;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to generate audit statistics:', error);
      throw error;
    }
  }

  /**
   * Search audit logs with advanced filters
   */
  async searchAuditLogs(searchQuery, filters = {}) {
    try {
      const {
        userId,
        actionType,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = filters;

      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .or(`action.ilike.%${searchQuery}%,details.cs.{"search":"${searchQuery}"}`)
        .order('timestamp', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        results: data,
        total: count,
        query: searchQuery,
        filters: filters
      };
    } catch (error) {
      console.error('Audit log search failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup old audit logs (for maintenance)
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const { error, count } = await this.supabase
        .from('audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) throw error;

      console.log(`🧹 Cleaned up ${count} old audit logs (older than ${retentionDays} days)`);
      
      return { cleaned_count: count, cutoff_date: cutoffDate.toISOString() };
    } catch (error) {
      console.error('Audit log cleanup failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();

module.exports = {
  auditLogger,
  AuditLogger
};