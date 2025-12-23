import React, { useState, useEffect } from 'react';
import { useTheme } from '../utils/ThemeContext';
import { api } from '../utils/api';
import styles from './BusinessMetricsPage.module.css';

/**
 * Business Metrics Page
 * Mobile-friendly view of business metrics from easyflow-metrics
 * Automatically reads from /api/business-metrics/overview (which uses cached metrics)
 */
const BusinessMetricsPage = () => {
  const { theme } = useTheme();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadMetrics();
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/api/business-metrics/overview');
      if (data.metrics) {
        setMetrics(data.metrics);
        setLastUpdated(new Date(data.timestamp || Date.now()));
      } else {
        setError('No metrics data available');
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError(err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toLocaleString() || '0';
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  if (loading && !metrics) {
    return (
      <div className={styles.page} data-theme={theme}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className={styles.page} data-theme={theme}>
        <div className={styles.error}>
          <h2>⚠️ Error Loading Metrics</h2>
          <p>{error}</p>
          <button onClick={loadMetrics} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.header}>
        <h1 className={styles.title}>📊 Business Metrics</h1>
        {lastUpdated && (
          <p className={styles.subtitle}>
            Last updated: {lastUpdated.toLocaleTimeString()}
            {metrics?.source === 'cached' && ' (from daily batch)'}
          </p>
        )}
        <button onClick={loadMetrics} className={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      {metrics && (
        <div className={styles.metricsGrid}>
          {/* Users */}
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>👥</div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricValue}>{formatNumber(metrics.totalUsers)}</h3>
              <p className={styles.metricLabel}>Total Users</p>
              {metrics.activeUsers > 0 && (
                <p className={styles.metricSubtext}>{formatNumber(metrics.activeUsers)} active</p>
              )}
            </div>
          </div>

          {/* Signups */}
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>📈</div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricValue}>{formatNumber(metrics.newSignups)}</h3>
              <p className={styles.metricLabel}>New Signups</p>
              {metrics.activationRate > 0 && (
                <p className={styles.metricSubtext}>
                  {metrics.activationRate.toFixed(1)}% activated
                </p>
              )}
            </div>
          </div>

          {/* Workflows */}
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>⚡</div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricValue}>{formatNumber(metrics.workflowsCreated)}</h3>
              <p className={styles.metricLabel}>Workflows Created</p>
              {metrics.workflowsRun > 0 && (
                <p className={styles.metricSubtext}>{formatNumber(metrics.workflowsRun)} runs</p>
              )}
            </div>
          </div>

          {/* MRR */}
          {metrics.mrr > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>💰</div>
              <div className={styles.metricContent}>
                <h3 className={styles.metricValue}>{formatCurrency(metrics.mrr)}</h3>
                <p className={styles.metricLabel}>Monthly Recurring Revenue</p>
              </div>
            </div>
          )}

          {/* Conversion Rate */}
          {metrics.conversionRate > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>🎯</div>
              <div className={styles.metricContent}>
                <h3 className={styles.metricValue}>{metrics.conversionRate.toFixed(1)}%</h3>
                <p className={styles.metricLabel}>Conversion Rate</p>
                <p className={styles.metricSubtext}>Visit → Signup</p>
              </div>
            </div>
          )}

          {/* Engagement */}
          {metrics.avgWorkflowsPerUser > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>📊</div>
              <div className={styles.metricContent}>
                <h3 className={styles.metricValue}>{metrics.avgWorkflowsPerUser.toFixed(1)}</h3>
                <p className={styles.metricLabel}>Avg Workflows/User</p>
                {metrics.avgRunsPerUser > 0 && (
                  <p className={styles.metricSubtext}>
                    {metrics.avgRunsPerUser.toFixed(1)} runs/user
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {metrics && (
        <div className={styles.footer}>
          <p className={styles.footerText}>
            📱 Mobile-friendly • Auto-updates every 5 min • 
            {metrics.source === 'cached' 
              ? ' Data from daily batch (easyflow-metrics)' 
              : ' Real-time data'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BusinessMetricsPage;

