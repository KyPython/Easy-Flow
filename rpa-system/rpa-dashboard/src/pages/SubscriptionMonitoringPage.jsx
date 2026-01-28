import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { createLogger } from '../utils/logger';
import { fetchWithAuth } from '../utils/devNetLogger';
import { getEnvMessage } from '../utils/envAwareMessages';
import { trackFeatureUsage } from '../utils/api';
import './SubscriptionMonitoringPage.css';

const logger = createLogger('SubscriptionMonitoringPage');

const SubscriptionMonitoringPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme() || { theme: 'light' };
  const [subscriptions, setSubscriptions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [companies, setCompanies] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    service_name: '',
    service_type: 'usage_based',
    account_email: '',
    account_url: '',
    company_name: '',
    project_tag: '',
    current_plan: '',
    monthly_cost: '',
    currency: 'USD',
    plan_limit: {},
    alert_threshold: { default: 0.8 },
    check_frequency: 'daily',
    auto_check: true,
    billing_cycle: 'monthly',
    renewal_date: '',
    cancel_link: '',
    notes: ''
  });

  useEffect(() => {
    trackFeatureUsage('subscription_monitoring', { action: 'view' });
    fetchSubscriptions();
    fetchAlerts();
  }, [user]);

  useEffect(() => {
    // Extract unique companies
    const uniqueCompanies = [...new Set(subscriptions.map(s => s.company_name).filter(Boolean))];
    setCompanies(uniqueCompanies);
  }, [subscriptions]);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const params = selectedCompany !== 'all' ? `?company_name=${encodeURIComponent(selectedCompany)}` : '';
      const response = await fetchWithAuth(`/api/subscriptions${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      setSubscriptions(data || []);
    } catch (err) {
      logger.error('Failed to fetch subscriptions', { error: err.message });
      setError(getEnvMessage({
        dev: `Failed to load subscriptions: ${err.message}`,
        prod: 'Failed to load subscriptions. Please try again.'
      }));
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany]);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetchWithAuth('/api/subscriptions?include_alerts=true');
      if (response.ok) {
        const data = await response.json();
        // Extract alerts from subscriptions
        const allAlerts = [];
        data.forEach(sub => {
          if (sub.subscription_alerts) {
            allAlerts.push(...sub.subscription_alerts.map(alert => ({
              ...alert,
              subscription: sub
            })));
          }
        });
        setAlerts(allAlerts.filter(a => !a.acknowledged));
      }
    } catch (err) {
      logger.error('Failed to fetch alerts', { error: err.message });
    }
  }, [user]);

  const handleAddSubscription = async (e) => {
    e.preventDefault();
    
    try {
      // Parse plan_limit and alert_threshold from JSON strings if needed
      const payload = {
        ...formData,
        monthly_cost: parseFloat(formData.monthly_cost) || 0,
        plan_limit: typeof formData.plan_limit === 'string' 
          ? JSON.parse(formData.plan_limit || '{}') 
          : formData.plan_limit,
        alert_threshold: typeof formData.alert_threshold === 'string'
          ? JSON.parse(formData.alert_threshold || '{"default": 0.8}')
          : formData.alert_threshold
      };

      const response = await fetchWithAuth('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      await fetchSubscriptions();
      setShowAddModal(false);
      setFormData({
        service_name: '',
        service_type: 'usage_based',
        account_email: '',
        account_url: '',
        company_name: '',
        project_tag: '',
        current_plan: '',
        monthly_cost: '',
        currency: 'USD',
        plan_limit: {},
        alert_threshold: { default: 0.8 },
        check_frequency: 'daily',
        auto_check: true,
        billing_cycle: 'monthly',
        renewal_date: '',
        cancel_link: '',
        notes: ''
      });
    } catch (err) {
      setError(err.message);
      logger.error('Failed to add subscription', { error: err.message });
    }
  };

  const handleExport = async () => {
    try {
      const params = selectedCompany !== 'all' ? `?company=${encodeURIComponent(selectedCompany)}` : '';
      const response = await fetchWithAuth(`/api/subscriptions/export${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to export subscriptions');
      }

      const data = await response.json();
      
      // Convert to CSV
      const headers = Object.keys(data[0] || {});
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(','))
      ];

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
      logger.error('Failed to export subscriptions', { error: err.message });
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      const response = await fetchWithAuth(`/api/subscriptions/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });

      if (response.ok) {
        await fetchAlerts();
      }
    } catch (err) {
      logger.error('Failed to acknowledge alert', { error: err.message });
    }
  };

  const getUsagePercentage = (subscription) => {
    if (!subscription.current_usage || !subscription.plan_limit) return null;
    
    const metrics = [];
    for (const [key, value] of Object.entries(subscription.current_usage)) {
      if (subscription.plan_limit[key]) {
        const percentage = (value / subscription.plan_limit[key]) * 100;
        metrics.push({ key, percentage, value, limit: subscription.plan_limit[key] });
      }
    }
    return metrics;
  };

  if (loading && subscriptions.length === 0) {
    return (
      <div className="subscription-monitoring-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-monitoring-page" data-theme={theme}>
      <div className="page-header">
        <div>
          <h1>Subscription Monitoring</h1>
          <p className="page-description">
            Proactively monitor subscription usage across all your businesses. 
            Get alerts before overages become bills.
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={subscriptions.length === 0}
          >
            📥 Export to Spreadsheet
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + Add Subscription
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="alerts-banner">
          <h3>⚠️ {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</h3>
          {alerts.slice(0, 3).map(alert => (
            <div key={alert.id} className="alert-item">
              <span className={`severity-${alert.severity}`}>{alert.severity}</span>
              <span>{alert.subscription?.service_name}: {alert.message}</span>
              <button 
                className="btn-small"
                onClick={() => handleAcknowledgeAlert(alert.id)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <select 
          value={selectedCompany} 
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Companies</option>
          {companies.map(company => (
            <option key={company} value={company}>{company}</option>
          ))}
        </select>
      </div>

      {/* Subscriptions Grid */}
      <div className="subscriptions-grid">
        {subscriptions.length === 0 ? (
          <div className="empty-state">
            <h2>No subscriptions yet</h2>
            <p>Add your first subscription to start monitoring usage and costs.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              Add Subscription
            </button>
          </div>
        ) : (
          subscriptions.map(subscription => {
            const usageMetrics = getUsagePercentage(subscription);
            
            return (
              <div key={subscription.id} className="subscription-card">
                <div className="card-header">
                  <h3>{subscription.service_name}</h3>
                  <span className={`status-badge status-${subscription.status}`}>
                    {subscription.status}
                  </span>
                </div>
                
                <div className="card-body">
                  {subscription.company_name && (
                    <div className="info-row">
                      <span className="label">Company:</span>
                      <span>{subscription.company_name}</span>
                    </div>
                  )}
                  
                  <div className="info-row">
                    <span className="label">Plan:</span>
                    <span>{subscription.current_plan || 'N/A'}</span>
                  </div>
                  
                  <div className="info-row">
                    <span className="label">Monthly Cost:</span>
                    <span>${subscription.monthly_cost || 0} {subscription.currency}</span>
                  </div>

                  {usageMetrics && usageMetrics.length > 0 && (
                    <div className="usage-section">
                      <h4>Usage</h4>
                      {usageMetrics.map(metric => {
                        const isWarning = metric.percentage >= 80;
                        const isCritical = metric.percentage >= 95;
                        
                        return (
                          <div key={metric.key} className="usage-bar-container">
                            <div className="usage-label">
                              <span>{metric.key}:</span>
                              <span className={isCritical ? 'critical' : isWarning ? 'warning' : ''}>
                                {metric.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div 
                                className={`usage-fill ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}
                                style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                              />
                            </div>
                            <div className="usage-details">
                              {metric.value} / {metric.limit}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {subscription.renewal_date && (
                    <div className="info-row">
                      <span className="label">Renewal:</span>
                      <span>{new Date(subscription.renewal_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {subscription.cancel_link && (
                    <a 
                      href={subscription.cancel_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="cancel-link"
                    >
                      Cancel Link →
                    </a>
                  )}
                </div>

                <div className="card-footer">
                  <span className="check-frequency">
                    Checks: {subscription.check_frequency}
                  </span>
                  {subscription.current_usage && (
                    <span className="last-check">
                      Last: {new Date(subscription.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Subscription</h2>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddSubscription} className="subscription-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Service Name *</label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                    required
                    placeholder="e.g., Airtable, Render, QuotaGuard"
                  />
                </div>

                <div className="form-group">
                  <label>Service Type *</label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                    required
                  >
                    <option value="usage_based">Usage-based</option>
                    <option value="fixed">Fixed</option>
                    <option value="tiered">Tiered</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    placeholder="Which company this belongs to"
                  />
                </div>

                <div className="form-group">
                  <label>Account Email</label>
                  <input
                    type="email"
                    value={formData.account_email}
                    onChange={(e) => setFormData({...formData, account_email: e.target.value})}
                    placeholder="Login email for this service"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Current Plan</label>
                  <input
                    type="text"
                    value={formData.current_plan}
                    onChange={(e) => setFormData({...formData, current_plan: e.target.value})}
                    placeholder="e.g., Pro, Business, Enterprise"
                  />
                </div>

                <div className="form-row-inline">
                  <div className="form-group">
                    <label>Monthly Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthly_cost}
                      onChange={(e) => setFormData({...formData, monthly_cost: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Account URL</label>
                <input
                  type="url"
                  value={formData.account_url}
                  onChange={(e) => setFormData({...formData, account_url: e.target.value})}
                  placeholder="https://dashboard.example.com"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Check Frequency</label>
                  <select
                    value={formData.check_frequency}
                    onChange={(e) => setFormData({...formData, check_frequency: e.target.value})}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.auto_check}
                      onChange={(e) => setFormData({...formData, auto_check: e.target.checked})}
                    />
                    {' '}Auto-check enabled
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Cancel Link</label>
                <input
                  type="url"
                  value={formData.cancel_link}
                  onChange={(e) => setFormData({...formData, cancel_link: e.target.value})}
                  placeholder="URL to cancellation page"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionMonitoringPage;

