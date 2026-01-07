// Workflow Metrics Service
// Tracks success/failure rates, error categories, and execution analytics

const { getSupabase } = require('../utils/supabaseClient');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('service.workflowMetrics');

class WorkflowMetricsService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Record workflow execution metrics
   */
  async recordExecution(execution) {
    if (!this.supabase) return;

    try {
      const metrics = {
        execution_id: execution.id,
        workflow_id: execution.workflow_id,
        user_id: execution.user_id,
        status: execution.status,
        error_category: execution.error_category || null,
        duration_seconds: execution.duration_seconds || null,
        steps_executed: execution.steps_executed || 0,
        steps_total: execution.steps_total || 0,
        triggered_by: execution.triggered_by || 'manual',
        created_at: new Date().toISOString()
      };

      // Store in metrics table if it exists, otherwise log
      const { error } = await this.supabase
        .from('workflow_execution_metrics')
        .insert(metrics)
        .catch(() => {
          // Table might not exist - that's OK, we'll use analytics endpoint instead
          return { error: null };
        });

      if (error && !error.message.includes('does not exist')) {
        logger.warn('Failed to record execution metrics', { error: error.message });
      }
    } catch (err) {
      // Don't fail execution if metrics recording fails
      logger.warn('Error recording execution metrics', { error: err.message });
    }
  }

  /**
   * Get workflow analytics for a user
   */
  async getWorkflowAnalytics(userId, options = {}) {
    const {
      workflowId = null,
      days = 30,
      groupBy = 'day' // 'day', 'week', 'month', 'workflow'
    } = options;

    if (!this.supabase) {
      return this._getMockAnalytics();
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = this.supabase
        .from('workflow_executions')
        .select('id, status, error_category, duration_seconds, created_at, workflow_id')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (workflowId) {
        query = query.eq('workflow_id', workflowId);
      }

      const { data: executions, error } = await query;

      if (error) {
        logger.error('Failed to fetch execution analytics', { error: error.message });
        return this._getMockAnalytics();
      }

      return this._calculateAnalytics(executions || [], groupBy);
    } catch (err) {
      logger.error('Error calculating analytics', { error: err.message });
      return this._getMockAnalytics();
    }
  }

  /**
   * Get error category breakdown
   */
  async getErrorBreakdown(userId, days = 30) {
    if (!this.supabase) {
      return {};
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: executions, error } = await this.supabase
        .from('workflow_executions')
        .select('status, error_category, metadata')
        .eq('user_id', userId)
        .eq('status', 'failed')
        .gte('created_at', startDate.toISOString());

      if (error) {
        logger.error('Failed to fetch error breakdown', { error: error.message });
        return {};
      }

      const breakdown = {};
      (executions || []).forEach(exec => {
        const category = exec.error_category ||
                        this._extractErrorCategory(exec.metadata) ||
                        'UNKNOWN_ERROR';
        breakdown[category] = (breakdown[category] || 0) + 1;
      });

      return breakdown;
    } catch (err) {
      logger.error('Error calculating error breakdown', { error: err.message });
      return {};
    }
  }

  /**
   * Get success rate by workflow type
   */
  async getSuccessRateByWorkflow(userId, days = 30) {
    if (!this.supabase) {
      return [];
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: executions, error } = await this.supabase
        .from('workflow_executions')
        .select('workflow_id, status, workflow:workflows(name, workflow_type)')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        logger.error('Failed to fetch success rates', { error: error.message });
        return [];
      }

      const workflowStats = {};
      (executions || []).forEach(exec => {
        const workflowId = exec.workflow_id || 'unknown';
        if (!workflowStats[workflowId]) {
          workflowStats[workflowId] = {
            workflow_id: workflowId,
            workflow_name: exec.workflow?.name || 'Unknown',
            total: 0,
            successful: 0,
            failed: 0
          };
        }
        workflowStats[workflowId].total++;
        if (exec.status === 'completed') {
          workflowStats[workflowId].successful++;
        } else if (exec.status === 'failed') {
          workflowStats[workflowId].failed++;
        }
      });

      return Object.values(workflowStats).map(stat => ({
        ...stat,
        success_rate: stat.total > 0 ? Math.round((stat.successful / stat.total) * 100) : 0
      })).sort((a, b) => b.total - a.total);
    } catch (err) {
      logger.error('Error calculating success rates', { error: err.message });
      return [];
    }
  }

  /**
   * Calculate analytics from execution data
   */
  _calculateAnalytics(executions, groupBy) {
    const total = executions.length;
    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const cancelled = executions.filter(e => e.status === 'cancelled').length;
    const running = executions.filter(e => e.status === 'running').length;

    const totalDuration = executions
      .filter(e => e.duration_seconds)
      .reduce((sum, e) => sum + e.duration_seconds, 0);
    const avgDuration = executions.filter(e => e.duration_seconds).length > 0
      ? Math.round(totalDuration / executions.filter(e => e.duration_seconds).length)
      : 0;

    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    // Group by time period
    const timeSeries = this._groupByTimePeriod(executions, groupBy);

    // Error category breakdown
    const errorBreakdown = {};
    executions
      .filter(e => e.status === 'failed')
      .forEach(e => {
        const category = e.error_category || 'UNKNOWN_ERROR';
        errorBreakdown[category] = (errorBreakdown[category] || 0) + 1;
      });

    return {
      summary: {
        total,
        successful,
        failed,
        cancelled,
        running,
        success_rate: successRate,
        avg_duration_seconds: avgDuration
      },
      time_series: timeSeries,
      error_breakdown: errorBreakdown
    };
  }

  /**
   * Group executions by time period
   */
  _groupByTimePeriod(executions, groupBy) {
    const groups = {};

    executions.forEach(exec => {
      const date = new Date(exec.created_at);
      let key;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groups[key]) {
        groups[key] = { date: key, total: 0, successful: 0, failed: 0 };
      }
      groups[key].total++;
      if (exec.status === 'completed') {
        groups[key].successful++;
      } else if (exec.status === 'failed') {
        groups[key].failed++;
      }
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Extract error category from metadata
   */
  _extractErrorCategory(metadata) {
    if (!metadata) return null;
    try {
      const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      return meta.error_category || null;
    } catch {
      return null;
    }
  }

  /**
   * Mock analytics for when database unavailable
   */
  _getMockAnalytics() {
    return {
      summary: {
        total: 0,
        successful: 0,
        failed: 0,
        cancelled: 0,
        running: 0,
        success_rate: 0,
        avg_duration_seconds: 0
      },
      time_series: [],
      error_breakdown: {}
    };
  }
}

module.exports = { WorkflowMetricsService };

