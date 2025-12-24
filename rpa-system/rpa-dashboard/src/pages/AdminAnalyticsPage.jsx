/**
 * Admin Analytics Dashboard
 * Internal dashboard to see what ALL users are doing with EasyFlow
 * Addresses Pain Point #4: "Not knowing what users do with your product"
 * 
 * Access: Admin-only (requires ADMIN_EMAILS env var)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';
import styles from './AdminAnalyticsPage.module.css';

const AdminAnalyticsPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const logger = createLogger('AdminAnalyticsPage');
  
  const [overview, setOverview] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [workflowUsage, setWorkflowUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) return;
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [overviewRes, activityRes, usageRes] = await Promise.all([
        api.get('/api/admin/analytics/overview'),
        api.get('/api/admin/analytics/user-activity?days=30'),
        api.get('/api/admin/analytics/workflow-usage')
      ]);

      setOverview(overviewRes.data);
      setUserActivity(activityRes.data);
      setWorkflowUsage(usageRes.data);
    } catch (err) {
      logger.error('Failed to load admin analytics', {
        error: err.message,
        status: err.response?.status
      });
      
      if (err.response?.status === 403) {
        setError('Admin access required. Add your email to ADMIN_EMAILS environment variable.');
      } else {
        setError(err.message || 'Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} data-theme={theme}>
        <div className={styles.loading}>Loading admin analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page} data-theme={theme}>
        <div className={styles.error}>
          <h2>Access Denied</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <h1 className={styles.title}>📊 Admin Analytics Dashboard</h1>
        <p className={styles.subtitle}>See what your users are actually doing with EasyFlow</p>
        <button onClick={loadAllData} className={styles.refreshButton}>
          🔄 Refresh
        </button>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Activity
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'workflows' ? styles.active : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          Workflow Usage
        </button>
      </div>

      {activeTab === 'overview' && overview && (
        <div className={styles.content}>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{overview.overview?.totalUsers || 0}</div>
              <div className={styles.metricLabel}>Total Users</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{overview.overview?.activeUsers || 0}</div>
              <div className={styles.metricLabel}>Active Users (30d)</div>
              <div className={styles.metricSubtext}>
                {overview.overview?.activeUserRate || 0}% of total
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{overview.overview?.totalWorkflows || 0}</div>
              <div className={styles.metricLabel}>Total Workflows</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{overview.overview?.totalRuns || 0}</div>
              <div className={styles.metricLabel}>Total Runs</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{overview.overview?.failureRate || 0}%</div>
              <div className={styles.metricLabel}>Failure Rate</div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔥 Most Popular Templates</h2>
            <div className={styles.list}>
              {overview.popularTemplates?.map((template, idx) => (
                <div key={idx} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <strong>{template.name}</strong>
                    <span className={styles.badge}>{template.usageCount} uses</span>
                  </div>
                  <div className={styles.listItemSub}>⭐ {template.rating}/5.0</div>
                </div>
              )) || <p>No templates yet</p>}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔌 Most Used Integrations</h2>
            <div className={styles.list}>
              {overview.integrationUsage?.map((integration, idx) => (
                <div key={idx} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <strong>{integration.type}</strong>
                    <span className={styles.badge}>{integration.count} users</span>
                  </div>
                </div>
              )) || <p>No integrations yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && userActivity && (
        <div className={styles.content}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              👥 User Activity ({userActivity.period})
            </h2>
            <p className={styles.sectionSubtitle}>
              {userActivity.totalActiveUsers} active users
            </p>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Total Runs</th>
                    <th>Completed</th>
                    <th>Failed</th>
                    <th>Success Rate</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {userActivity.userActivity?.map((user, idx) => (
                    <tr key={idx}>
                      <td>{user.email}</td>
                      <td>{user.plan}</td>
                      <td>{user.totalRuns}</td>
                      <td>{user.completedRuns}</td>
                      <td>{user.failedRuns}</td>
                      <td>{user.successRate}%</td>
                      <td>{new Date(user.lastActivity).toLocaleDateString()}</td>
                    </tr>
                  )) || <tr><td colSpan="7">No activity data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workflows' && workflowUsage && (
        <div className={styles.content}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>📋 Task Type Breakdown</h2>
            <div className={styles.list}>
              {workflowUsage.taskTypeBreakdown?.map((item, idx) => (
                <div key={idx} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <strong>{item.type || 'Unknown'}</strong>
                    <span className={styles.badge}>{item.count} workflows</span>
                  </div>
                </div>
              )) || <p>No workflow data yet</p>}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>⭐ Popular Templates</h2>
            <div className={styles.list}>
              {workflowUsage.popularTemplates?.map((template, idx) => (
                <div key={idx} className={styles.listItem}>
                  <div className={styles.listItemMain}>
                    <strong>{template.name}</strong>
                    <span className={styles.badge}>{template.usageCount} uses</span>
                  </div>
                  <div className={styles.listItemSub}>Category: {template.category}</div>
                </div>
              )) || <p>No template data yet</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;

