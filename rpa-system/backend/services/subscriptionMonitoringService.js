const { getSupabase } = require('../utils/supabaseClient');
const { getLogger } = require('../utils/logger');
const { firebaseNotificationService } = require('../utils/firebaseAdmin');

class SubscriptionMonitoringService {
  constructor() {
    this.supabase = getSupabase();
    this.logger = getLogger('subscription.monitoring');
  }

  /**
   * Create a new subscription to monitor
   */
  async createSubscription(userId, subscriptionData) {
    try {
      const {
        service_name,
        service_type,
        account_email,
        account_url,
        company_name,
        project_tag,
        current_plan,
        monthly_cost,
        currency,
        plan_limit,
        alert_threshold,
        check_frequency,
        auto_check,
        billing_cycle,
        renewal_date,
        cancel_link,
        notes,
        tags
      } = subscriptionData;

      const { data, error } = await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          service_name,
          service_type,
          account_email,
          account_url,
          company_name,
          project_tag,
          current_plan,
          monthly_cost: monthly_cost || 0,
          currency: currency || 'USD',
          plan_limit,
          alert_threshold: alert_threshold || { default: 0.8 }, // Default 80% threshold
          check_frequency: check_frequency || 'daily',
          auto_check: auto_check !== false,
          billing_cycle: billing_cycle || 'monthly',
          renewal_date,
          cancel_link,
          notes,
          tags: tags || []
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Subscription created', {
        userId,
        subscriptionId: data.id,
        serviceName: service_name
      });

      return { success: true, subscription: data };
    } catch (error) {
      this.logger.error('Failed to create subscription', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all subscriptions for a user, optionally filtered by company
   */
  async getUserSubscriptions(userId, filters = {}) {
    try {
      let query = this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('service_name', { ascending: true });

      if (filters.company_name) {
        query = query.eq('company_name', filters.company_name);
      }

      if (filters.service_name) {
        query = query.eq('service_name', filters.service_name);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, subscriptions: data || [] };
    } catch (error) {
      this.logger.error('Failed to get subscriptions', { error: error.message, userId });
      return { success: false, error: error.message, subscriptions: [] };
    }
  }

  /**
   * Record a usage check result
   */
  async recordUsageCheck(subscriptionId, usageData, executionId = null) {
    try {
      // Get subscription to calculate percentages
      const { data: subscription, error: subError } = await this.supabase
        .from('subscriptions')
        .select('plan_limit, alert_threshold')
        .eq('id', subscriptionId)
        .single();

      if (subError) throw subError;

      // Calculate usage percentages
      const usagePercentages = {};
      const planLimit = subscription.plan_limit || {};
      const alertThreshold = subscription.alert_threshold || { default: 0.8 };

      for (const [key, value] of Object.entries(usageData)) {
        if (typeof value === 'number' && planLimit[key]) {
          usagePercentages[key] = (value / planLimit[key]) * 100;
        }
      }

      // Insert usage check
      const { data: checkData, error: checkError } = await this.supabase
        .from('subscription_usage_checks')
        .insert({
          subscription_id: subscriptionId,
          usage_data: usageData,
          usage_percentages: usagePercentages,
          execution_id: executionId,
          check_successful: true
        })
        .select()
        .single();

      if (checkError) throw checkError;

      // Update subscription with latest usage
      await this.supabase
        .from('subscriptions')
        .update({ current_usage: usageData, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      // Check for threshold alerts
      await this.checkThresholds(subscriptionId, usagePercentages, alertThreshold, checkData.id);

      this.logger.info('Usage check recorded', {
        subscriptionId,
        usagePercentages
      });

      return { success: true, check: checkData };
    } catch (error) {
      this.logger.error('Failed to record usage check', {
        error: error.message,
        subscriptionId
      });

      // Record failed check
      await this.supabase
        .from('subscription_usage_checks')
        .insert({
          subscription_id: subscriptionId,
          usage_data: {},
          check_successful: false,
          error_message: error.message,
          execution_id: executionId || null
        });

      return { success: false, error: error.message };
    }
  }

  /**
   * Check if usage exceeds thresholds and create alerts
   */
  async checkThresholds(subscriptionId, usagePercentages, alertThreshold, usageCheckId) {
    try {
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select('user_id, service_name, company_name, current_usage, monthly_cost')
        .eq('id', subscriptionId)
        .single();

      if (!subscription) return;

      const alerts = [];

      // Check each metric against its threshold
      for (const [metric, percentage] of Object.entries(usagePercentages)) {
        const threshold = alertThreshold[metric] || alertThreshold.default || 0.8;
        const thresholdPercent = threshold * 100;

        if (percentage >= thresholdPercent) {
          let severity = 'warning';
          if (percentage >= 95) severity = 'critical';
          else if (percentage >= thresholdPercent + 10) severity = 'warning';

          const message = `${subscription.service_name} ${metric} usage at ${percentage.toFixed(1)}% (threshold: ${thresholdPercent}%)`;

          alerts.push({
            subscription_id: subscriptionId,
            usage_check_id: usageCheckId,
            alert_type: 'threshold_exceeded',
            severity,
            message,
            threshold_exceeded: { [metric]: threshold },
            current_values: { [metric]: percentage }
          });
        }
      }

      // Insert alerts if any
      if (alerts.length > 0) {
        const { data: insertedAlerts, error: alertError } = await this.supabase
          .from('subscription_alerts')
          .insert(alerts)
          .select();

        if (!alertError && insertedAlerts) {
          // Send notifications for critical alerts
          for (const alert of insertedAlerts) {
            if (alert.severity === 'critical') {
              await this.sendAlertNotification(subscription.user_id, alert, subscription);
            }
          }
        }
      }

      return { success: true, alertsCreated: alerts.length };
    } catch (error) {
      this.logger.error('Failed to check thresholds', { error: error.message, subscriptionId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification for an alert
   */
  async sendAlertNotification(userId, alert, subscription) {
    try {
      const notification = {
        type: 'subscription_alert',
        title: `⚠️ ${subscription.service_name} Usage Alert`,
        body: alert.message,
        priority: alert.severity === 'critical' ? 'high' : 'normal',
        data: {
          alertId: alert.id,
          subscriptionId: alert.subscription_id,
          serviceName: subscription.service_name,
          companyName: subscription.company_name,
          alertType: alert.alert_type
        }
      };

      if (firebaseNotificationService && firebaseNotificationService.isConfigured) {
        await firebaseNotificationService.sendAndStoreNotification(userId, notification);

        // Update alert with notification sent flag
        await this.supabase
          .from('subscription_alerts')
          .update({ notification_sent: true })
          .eq('id', alert.id);
      }
    } catch (error) {
      this.logger.error('Failed to send alert notification', {
        error: error.message,
        alertId: alert.id
      });
    }
  }

  /**
   * Get subscription export data (for spreadsheet export)
   */
  async getExportData(userId, companyFilter = null) {
    try {
      let query = this.supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_alerts!inner(
            id,
            alert_type,
            severity,
            created_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (companyFilter) {
        query = query.eq('company_name', companyFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Format for spreadsheet export
      const exportData = (data || []).map(sub => ({
        Tool: sub.service_name,
        Company: sub.company_name || '',
        Project: sub.project_tag || '',
        Plan: sub.current_plan || '',
        'Monthly Cost': sub.monthly_cost || 0,
        Currency: sub.currency || 'USD',
        'Billing Cycle': sub.billing_cycle || 'monthly',
        'Renewal Date': sub.renewal_date || '',
        'Cancel Link': sub.cancel_link || '',
        Status: sub.status,
        'Last Check': sub.current_usage ? JSON.stringify(sub.current_usage) : '',
        'Has Alerts': sub.subscription_alerts?.length > 0,
        'Latest Alert': sub.subscription_alerts?.[0]?.message || ''
      }));

      return { success: true, data: exportData };
    } catch (error) {
      this.logger.error('Failed to get export data', { error: error.message, userId });
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get subscriptions that need to be checked (based on check_frequency)
   */
  async getSubscriptionsToCheck() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get subscriptions with auto_check enabled and no recent check
      const { data: subscriptions, error } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_usage_checks!left(checked_at)
        `)
        .eq('auto_check', true)
        .eq('is_active', true)
        .order('service_name');

      if (error) throw error;

      // Filter by check frequency
      const toCheck = (subscriptions || []).filter(sub => {
        const lastCheck = sub.subscription_usage_checks?.[0]?.checked_at;
        if (!lastCheck) return true; // Never checked

        const lastCheckDate = new Date(lastCheck);
        const daysSinceCheck = (now - lastCheckDate) / (1000 * 60 * 60 * 24);

        switch (sub.check_frequency) {
          case 'daily':
            return daysSinceCheck >= 1;
          case 'weekly':
            return daysSinceCheck >= 7;
          case 'monthly':
            return daysSinceCheck >= 30;
          default:
            return daysSinceCheck >= 1;
        }
      });

      return { success: true, subscriptions: toCheck };
    } catch (error) {
      this.logger.error('Failed to get subscriptions to check', { error: error.message });
      return { success: false, error: error.message, subscriptions: [] };
    }
  }

  /**
   * Update subscription with latest usage from workflow execution
   */
  async updateSubscriptionFromWorkflow(subscriptionId, executionResult) {
    try {
      const usageData = executionResult.usage_data || {};

      if (Object.keys(usageData).length > 0) {
        await this.recordUsageCheck(subscriptionId, usageData, executionResult.execution_id);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to update subscription from workflow', {
        error: error.message,
        subscriptionId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      // Verify alert belongs to user
      const { data: alert, error: alertError } = await this.supabase
        .from('subscription_alerts')
        .select('subscription_id, subscriptions!inner(user_id)')
        .eq('id', alertId)
        .single();

      if (alertError) throw alertError;
      if (alert.subscriptions.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const { error: updateError } = await this.supabase
        .from('subscription_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { error: error.message, alertId });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SubscriptionMonitoringService();
