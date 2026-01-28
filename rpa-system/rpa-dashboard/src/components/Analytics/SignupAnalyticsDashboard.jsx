/**
 * Signup Analytics Dashboard Component
 * Displays marketing events analytics including signup funnel, A/B test performance, and failure alerts
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useTheme } from '../../utils/ThemeContext';
import styles from './SignupAnalyticsDashboard.module.css';

export default function SignupAnalyticsDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/business-metrics/marketing-events', {
        params: { days }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load analytics');
      console.error('Signup analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} data-theme={theme}>
        <div className={styles.loading}>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container} data-theme={theme}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container} data-theme={theme}>
        <div className={styles.error}>No data available</div>
      </div>
    );
  }

  const { summary, funnel, ab_tests, failure_breakdown, daily_breakdown, utm_breakdown, alerts } = data;

  return (
    <div className={styles.container} data-theme={theme}>
      <div className={styles.header}>
        <h2 className={styles.title}>Signup Analytics Dashboard</h2>
        <div className={styles.controls}>
          <label>
            Timeframe:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className={styles.select}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <h3 className={styles.sectionTitle}>⚠️ Alerts</h3>
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`${styles.alert} ${styles[`alert${alert.severity === 'critical' ? 'Critical' : 'Warning'}`]}`}
            >
              <div className={styles.alertIcon}>
                {alert.severity === 'critical' ? '🔴' : '⚠️'}
              </div>
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>{alert.message}</div>
                {alert.failure_rate && (
                  <div className={styles.alertDetails}>
                    Failure Rate: {alert.failure_rate}% | Failures: {alert.failures} | Attempts: {alert.attempts}
                  </div>
                )}
                {alert.error_type && (
                  <div className={styles.alertDetails}>
                    Error Type: {alert.error_type} | Count: {alert.count} | Percentage: {alert.percentage}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Funnel Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Form Views</div>
          <div className={styles.metricValue}>{funnel.views}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Attempts</div>
          <div className={styles.metricValue}>{funnel.attempts}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Successes</div>
          <div className={styles.metricValue}>{funnel.successes}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Conversion Rate</div>
          <div className={styles.metricValue}>{funnel.conversion_rate}%</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Failure Rate</div>
          <div className={`${styles.metricValue} ${parseFloat(funnel.failure_rate) > 20 ? styles.metricValueError : ''}`}>
            {funnel.failure_rate}%
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Validation Errors</div>
          <div className={styles.metricValue}>{funnel.validation_errors}</div>
        </div>
      </div>

      {/* A/B Test Performance */}
      {ab_tests && Object.keys(ab_tests).length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>A/B Test Performance</h3>
          {Object.entries(ab_tests).map(([testName, variants]) => (
            <div key={testName} className={styles.abTestCard}>
              <h4 className={styles.testName}>{testName}</h4>
              <div className={styles.variantsGrid}>
                {Object.entries(variants).map(([variant, metrics]) => (
                  <div key={variant} className={styles.variantCard}>
                    <div className={styles.variantHeader}>
                      <span className={styles.variantLabel}>Variant {variant}</span>
                      <span className={`${styles.conversionRate} ${metrics.conversion_rate > variants[variant === 'A' ? 'B' : 'A']?.conversion_rate ? styles.winner : ''}`}>
                        {metrics.conversion_rate}% conversion
                      </span>
                    </div>
                    <div className={styles.variantMetrics}>
                      <div>Views: {metrics.views}</div>
                      <div>Conversions: {metrics.conversions}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failure Breakdown */}
      {failure_breakdown && Object.keys(failure_breakdown).length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Failure Breakdown by Error Type</h3>
          <div className={styles.failureBreakdown}>
            {Object.entries(failure_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([errorType, count]) => (
                <div key={errorType} className={styles.failureItem}>
                  <div className={styles.failureType}>{errorType}</div>
                  <div className={styles.failureCount}>{count}</div>
                  <div className={styles.failureBar}>
                    <div
                      className={styles.failureBarFill}
                      style={{
                        width: `${(count / funnel.failures) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Daily Breakdown Chart */}
      {daily_breakdown && daily_breakdown.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Daily Signup Funnel</h3>
          <div className={styles.chartContainer}>
            <div className={styles.chart}>
              {daily_breakdown.map((day, index) => {
                const maxValue = Math.max(
                  day.form_viewed,
                  day.attempts,
                  day.failures,
                  day.successes
                );
                return (
                  <div key={index} className={styles.chartDay}>
                    <div className={styles.chartBars}>
                      <div
                        className={styles.chartBar}
                        style={{
                          height: `${(day.form_viewed / maxValue) * 100}%`,
                          backgroundColor: 'var(--color-info-500)'
                        }}
                        title={`Views: ${day.form_viewed}`}
                      />
                      <div
                        className={styles.chartBar}
                        style={{
                          height: `${(day.attempts / maxValue) * 100}%`,
                          backgroundColor: 'var(--color-primary-500)'
                        }}
                        title={`Attempts: ${day.attempts}`}
                      />
                      <div
                        className={styles.chartBar}
                        style={{
                          height: `${(day.successes / maxValue) * 100}%`,
                          backgroundColor: 'var(--color-success-500)'
                        }}
                        title={`Successes: ${day.successes}`}
                      />
                      <div
                        className={styles.chartBar}
                        style={{
                          height: `${(day.failures / maxValue) * 100}%`,
                          backgroundColor: 'var(--color-error-500)'
                        }}
                        title={`Failures: ${day.failures}`}
                      />
                    </div>
                    <div className={styles.chartLabel}>
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-info-500)' }} />
                Views
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-primary-500)' }} />
                Attempts
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-success-500)' }} />
                Successes
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-error-500)' }} />
                Failures
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UTM Source Breakdown */}
      {utm_breakdown && Object.keys(utm_breakdown).length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Traffic Sources</h3>
          <div className={styles.utmBreakdown}>
            {Object.entries(utm_breakdown)
              .sort((a, b) => b[1].conversions - a[1].conversions)
              .map(([source, metrics]) => (
                <div key={source} className={styles.utmItem}>
                  <div className={styles.utmSource}>{source}</div>
                  <div className={styles.utmMetrics}>
                    <div>Views: {metrics.views}</div>
                    <div>Conversions: {metrics.conversions}</div>
                    <div className={styles.utmConversionRate}>
                      Conversion Rate: {metrics.conversion_rate}%
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
