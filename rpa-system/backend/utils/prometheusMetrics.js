const { getSupabase } = require('./supabaseClient');
const { logger } = require('./logger');

/**
 * Prometheus Metrics Exporter for Business KPIs
 * Exposes business metrics in Prometheus format for Grafana dashboards
 */

class PrometheusMetricsExporter {
  constructor() {
    this.metrics = {
      totalUsers: 0,
      activeUsers: 0,
      newSignups: 0,
      activatedUsers: 0,
      workflowsCreated: 0,
      workflowsRun: 0,
      mrr: 0,
      conversionRate: 0,
      visitToSignupRate: 0
    };
    this.lastUpdate = null;
    this.updateInterval = 60000; // Update every minute
    this.updateTimer = null;
  }

  /**
   * Start periodic metric updates
   */
  start() {
    this.updateMetrics();
    this.updateTimer = setInterval(() => {
      this.updateMetrics().catch(err => {
        logger.error('[PrometheusMetrics] Failed to update metrics:', err);
      });
    }, this.updateInterval);
    logger.info('✅ [PrometheusMetrics] Started periodic metric updates');
  }

  /**
   * Stop periodic updates
   */
  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Update all metrics from database
   */
  async updateMetrics() {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        logger.warn('[PrometheusMetrics] Supabase not available, skipping update');
        return;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      const startDateISO = startDate.toISOString();

      // Fetch all metrics in parallel
      const [
        totalUsersResult,
        activeUsersResult,
        newSignupsResult,
        activatedUsersResult,
        workflowsCreatedResult,
        workflowsRunResult,
        mrrResult,
        visitsResult
      ] = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', startDateISO),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startDateISO),
        supabase.from('automation_tasks').select('user_id').eq('is_active', true),
        supabase.from('automation_tasks').select('id', { count: 'exact', head: true }).gte('created_at', startDateISO),
        supabase.from('automation_runs').select('id', { count: 'exact', head: true }).gte('created_at', startDateISO),
        supabase.from('subscriptions').select('plan_id, status').eq('status', 'active'),
        supabase.from('marketing_events').select('id', { count: 'exact', head: true }).eq('event_name', 'page_view').gte('created_at', startDateISO)
      ]);

      // Extract counts
      this.metrics.totalUsers = totalUsersResult.status === 'fulfilled' ? (totalUsersResult.value.count || 0) : 0;
      this.metrics.activeUsers = activeUsersResult.status === 'fulfilled' ? (activeUsersResult.value.count || 0) : 0;
      this.metrics.newSignups = newSignupsResult.status === 'fulfilled' ? (newSignupsResult.value.count || 0) : 0;

      if (activatedUsersResult.status === 'fulfilled' && activatedUsersResult.value.data) {
        this.metrics.activatedUsers = new Set(activatedUsersResult.value.data.map(r => r.user_id)).size;
      }

      this.metrics.workflowsCreated = workflowsCreatedResult.status === 'fulfilled' ? (workflowsCreatedResult.value.count || 0) : 0;
      this.metrics.workflowsRun = workflowsRunResult.status === 'fulfilled' ? (workflowsRunResult.value.count || 0) : 0;

      // Calculate MRR
      if (mrrResult.status === 'fulfilled' && mrrResult.value.data) {
        const planIds = [...new Set(mrrResult.value.data.map(s => s.plan_id))];
        const { data: plans } = await supabase
          .from('plans')
          .select('id, price_monthly')
          .in('id', planIds);

        const planPricing = {};
        if (plans) {
          plans.forEach(plan => {
            planPricing[plan.id] = plan.price_monthly || 0;
          });
        }

        this.metrics.mrr = 0;
        mrrResult.value.data.forEach(sub => {
          this.metrics.mrr += planPricing[sub.plan_id] || 0;
        });
      }

      // Calculate conversion rate
      if (this.metrics.newSignups > 0) {
        this.metrics.conversionRate = (this.metrics.activatedUsers / this.metrics.newSignups) * 100;
      }

      // Calculate visit to signup rate
      const visits = visitsResult.status === 'fulfilled' ? (visitsResult.value.count || 0) : 0;
      if (visits > 0) {
        this.metrics.visitToSignupRate = (this.metrics.newSignups / visits) * 100;
      }

      this.lastUpdate = new Date();
    } catch (error) {
      logger.error('[PrometheusMetrics] Error updating metrics:', error);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat() {
    const lines = [
      '# HELP easyflow_total_users Total number of users',
      '# TYPE easyflow_total_users gauge',
      `easyflow_total_users ${this.metrics.totalUsers}`,
      '',
      '# HELP easyflow_active_users Number of active users (last 30 days)',
      '# TYPE easyflow_active_users gauge',
      `easyflow_active_users ${this.metrics.activeUsers}`,
      '',
      '# HELP easyflow_new_signups Number of new signups (last 30 days)',
      '# TYPE easyflow_new_signups gauge',
      `easyflow_new_signups ${this.metrics.newSignups}`,
      '',
      '# HELP easyflow_activated_users Number of activated users (with workflows)',
      '# TYPE easyflow_activated_users gauge',
      `easyflow_activated_users ${this.metrics.activatedUsers}`,
      '',
      '# HELP easyflow_workflows_created Number of workflows created (last 30 days)',
      '# TYPE easyflow_workflows_created gauge',
      `easyflow_workflows_created ${this.metrics.workflowsCreated}`,
      '',
      '# HELP easyflow_workflows_run Number of workflows run (last 30 days)',
      '# TYPE easyflow_workflows_run gauge',
      `easyflow_workflows_run ${this.metrics.workflowsRun}`,
      '',
      '# HELP easyflow_mrr Monthly recurring revenue in USD',
      '# TYPE easyflow_mrr gauge',
      `easyflow_mrr ${this.metrics.mrr}`,
      '',
      '# HELP easyflow_conversion_rate Activation rate percentage',
      '# TYPE easyflow_conversion_rate gauge',
      `easyflow_conversion_rate ${this.metrics.conversionRate}`,
      '',
      '# HELP easyflow_visit_to_signup_rate Visit to signup conversion rate percentage',
      '# TYPE easyflow_visit_to_signup_rate gauge',
      `easyflow_visit_to_signup_rate ${this.metrics.visitToSignupRate}`,
      '',
      '# HELP easyflow_metrics_last_update Timestamp of last metrics update',
      '# TYPE easyflow_metrics_last_update gauge',
      `easyflow_metrics_last_update ${this.lastUpdate ? Math.floor(this.lastUpdate.getTime() / 1000) : 0}`
    ];

    return lines.join('\n');
  }
}

// Create singleton instance
const prometheusMetricsExporter = new PrometheusMetricsExporter();

module.exports = { prometheusMetricsExporter, PrometheusMetricsExporter };

