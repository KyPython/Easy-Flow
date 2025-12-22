const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('funnel.monitoring');

/**
 * Funnel Monitoring Service
 * Implements rules-based monitoring for conversion funnel metrics
 * 
 * Rules:
 * 1. Visit→Signup: Target 10%, Critical if < 7%, Double down if ≥ 10%
 * 2. Signup→Activation: Target 40%, Warning if < 30%
 * 3. Activation→Usage: Target 3%, Critical if < 1%
 * 4. Usage→Revenue: Target $1000, Critical if $0
 */
class FunnelMonitoringService {
  constructor() {
    this.supabase = getSupabase();
    
    // Rule definitions
    this.rules = {
      visitToSignup: {
        target: 10.0,
        critical: 7.0,
        doubleDown: 10.0,
        timeline: '2 weeks',
        action: 'Test 2-3 landing page variants. Focus on CTA, value prop, social proof.',
        killCondition: '< 7% after 2 weeks',
        doubleDownCondition: '≥ 10%'
      },
      signupToActivation: {
        target: 40.0,
        warning: 30.0,
        critical: 20.0,
        timeline: 'Monitor closely',
        action: 'Improve onboarding flow, reduce friction, add guided tour'
      },
      activationToUsage: {
        target: 3.0,
        critical: 1.0,
        timeline: 'Monitor closely',
        action: 'Address Activation → Usage - this is critical',
        killCondition: 'Reassess if no improvement in 2 weeks'
      },
      usageToRevenue: {
        target: 1000.0,
        critical: 0.0,
        timeline: 'Monitor closely',
        action: 'Address Usage → Revenue - this is critical',
        killCondition: 'Reassess if no improvement in 2 weeks'
      }
    };
  }

  /**
   * Get current funnel metrics
   */
  async getFunnelMetrics(timeframe = '30d') {
    try {
      const days = parseInt(timeframe.replace('d', '')) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        visitsResult,
        signupsResult,
        activatedResult,
        usageResult,
        revenueResult
      ] = await Promise.allSettled([
        // Visits (from marketing_events)
        this.supabase
          .from('marketing_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'page_view')
          .gte('created_at', startDate.toISOString()),
        
        // Signups
        this.supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        
        // Activated (users with workflows)
        this.supabase
          .from('automation_tasks')
          .select('user_id')
          .eq('is_active', true)
          .gte('created_at', startDate.toISOString()),
        
        // Usage (users who ran workflows)
        this.supabase
          .from('automation_runs')
          .select('user_id')
          .gte('created_at', startDate.toISOString()),
        
        // Revenue (from subscriptions)
        this.supabase
          .from('subscriptions')
          .select('user_id, plan_id')
          .eq('status', 'active')
          .gte('created_at', startDate.toISOString())
      ]);

      const visits = visitsResult.status === 'fulfilled' ? (visitsResult.value.count || 0) : 0;
      const signups = signupsResult.status === 'fulfilled' ? (signupsResult.value.count || 0) : 0;
      
      let activated = 0;
      if (activatedResult.status === 'fulfilled' && activatedResult.value.data) {
        activated = new Set(activatedResult.value.data.map(r => r.user_id)).size;
      }
      
      let usage = 0;
      if (usageResult.status === 'fulfilled' && usageResult.value.data) {
        usage = new Set(usageResult.value.data.map(r => r.user_id)).size;
      }

      // Calculate revenue
      let revenue = 0;
      if (revenueResult.status === 'fulfilled' && revenueResult.value.data) {
        const planIds = [...new Set(revenueResult.value.data.map(s => s.plan_id))];
        const { data: plans } = await this.supabase
          .from('plans')
          .select('id, price_monthly')
          .in('id', planIds);
        
        const planPricing = {};
        if (plans) {
          plans.forEach(plan => {
            planPricing[plan.id] = plan.price_monthly || 0;
          });
        }
        
        revenueResult.value.data.forEach(sub => {
          revenue += planPricing[sub.plan_id] || 0;
        });
      }

      // Calculate conversion rates
      const visitToSignup = visits > 0 ? parseFloat((signups / visits * 100).toFixed(1)) : 0;
      const signupToActivation = signups > 0 ? parseFloat((activated / signups * 100).toFixed(1)) : 0;
      const activationToUsage = activated > 0 ? parseFloat((usage / activated * 100).toFixed(1)) : 0;
      const usageToRevenue = usage > 0 ? parseFloat((revenue / usage).toFixed(1)) : 0;

      return {
        timeframe: `${days}d`,
        metrics: {
          visits,
          signups,
          activated,
          usage,
          revenue,
          visitToSignup,
          signupToActivation,
          activationToUsage,
          usageToRevenue
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('[FunnelMonitoring] Error fetching metrics:', error);
      throw error;
    }
  }

  /**
   * Evaluate rules against current metrics
   */
  evaluateRules(metrics) {
    const evaluations = [];

    // Rule 1: Visit → Signup
    const visitToSignupRule = this.rules.visitToSignup;
    const visitToSignupStatus = this.getStatus(
      metrics.visitToSignup,
      visitToSignupRule.target,
      visitToSignupRule.critical
    );
    evaluations.push({
      rule: 'Visit → Signup',
      current: metrics.visitToSignup,
      target: visitToSignupRule.target,
      status: visitToSignupStatus,
      action: visitToSignupRule.action,
      timeline: visitToSignupRule.timeline,
      killCondition: visitToSignupRule.killCondition,
      doubleDownCondition: visitToSignupRule.doubleDownCondition,
      shouldDoubleDown: metrics.visitToSignup >= visitToSignupRule.doubleDown
    });

    // Rule 2: Signup → Activation
    const signupToActivationRule = this.rules.signupToActivation;
    const signupToActivationStatus = this.getStatus(
      metrics.signupToActivation,
      signupToActivationRule.target,
      signupToActivationRule.critical,
      signupToActivationRule.warning
    );
    evaluations.push({
      rule: 'Signup → Activation',
      current: metrics.signupToActivation,
      target: signupToActivationRule.target,
      status: signupToActivationStatus,
      action: signupToActivationRule.action,
      timeline: signupToActivationRule.timeline
    });

    // Rule 3: Activation → Usage
    const activationToUsageRule = this.rules.activationToUsage;
    const activationToUsageStatus = this.getStatus(
      metrics.activationToUsage,
      activationToUsageRule.target,
      activationToUsageRule.critical
    );
    evaluations.push({
      rule: 'Activation → Usage',
      current: metrics.activationToUsage,
      target: activationToUsageRule.target,
      status: activationToUsageStatus,
      action: activationToUsageRule.action,
      timeline: activationToUsageRule.timeline,
      killCondition: activationToUsageRule.killCondition
    });

    // Rule 4: Usage → Revenue
    const usageToRevenueRule = this.rules.usageToRevenue;
    const usageToRevenueStatus = this.getStatus(
      metrics.usageToRevenue,
      usageToRevenueRule.target,
      usageToRevenueRule.critical
    );
    evaluations.push({
      rule: 'Usage → Revenue',
      current: metrics.usageToRevenue,
      target: usageToRevenueRule.target,
      status: usageToRevenueStatus,
      action: usageToRevenueRule.action,
      timeline: usageToRevenueRule.timeline,
      killCondition: usageToRevenueRule.killCondition
    });

    return evaluations;
  }

  /**
   * Get status (critical, warning, ok) based on current vs target
   */
  getStatus(current, target, criticalThreshold, warningThreshold = null) {
    if (current < criticalThreshold) {
      return 'critical';
    }
    if (warningThreshold && current < warningThreshold) {
      return 'warning';
    }
    if (current >= target) {
      return 'ok';
    }
    return 'warning'; // Between critical and target
  }

  /**
   * Get full monitoring report
   */
  async getMonitoringReport(timeframe = '30d') {
    try {
      const metrics = await this.getFunnelMetrics(timeframe);
      const evaluations = this.evaluateRules(metrics.metrics);

      // Count critical issues
      const criticalCount = evaluations.filter(e => e.status === 'critical').length;
      const warningCount = evaluations.filter(e => e.status === 'warning').length;

      return {
        timeframe: metrics.timeframe,
        timestamp: metrics.timestamp,
        metrics: metrics.metrics,
        evaluations,
        summary: {
          critical: criticalCount,
          warning: warningCount,
          ok: evaluations.length - criticalCount - warningCount,
          total: evaluations.length
        }
      };
    } catch (error) {
      logger.error('[FunnelMonitoring] Error generating report:', error);
      throw error;
    }
  }
}

module.exports = new FunnelMonitoringService();

