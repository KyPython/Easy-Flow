import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FounderDashboard.css';

/**
 * Founder Dashboard - Rockefeller Operating System
 *
 * Your daily command center. Check this every morning.
 * Based on Rockefeller's principle: "Know your numbers better than anyone."
 */

const FounderDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('metrics');

  useEffect(() => {
    fetchDashboardData();
    fetchDailyChecklist();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/api/founder/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load founder dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
      setLoading(false);
    }
  };

  const fetchDailyChecklist = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/api/founder/daily-checklist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChecklist(response.data);
    } catch (err) {
      console.error('Failed to load daily checklist:', err);
    }
  };

  const updateChecklistItem = async (itemKey, value) => {
    try {
      const token = localStorage.getItem('token');
      const updatedItems = { ...checklist.items, [itemKey]: value };

      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/api/founder/daily-checklist`,
        {
          date: checklist.date,
          items: updatedItems,
          priority_task: checklist.priority_task,
          moved_closer_to_goal: checklist.moved_closer_to_goal,
          daily_learning: checklist.daily_learning
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setChecklist({ ...checklist, items: updatedItems });
    } catch (err) {
      console.error('Failed to update checklist:', err);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTrendIcon = (trend) => {
    return trend === 'up' ? '↗️' : '↘️';
  };

  if (loading) {
    return (
      <div className="founder-dashboard loading">
        <div className="loading-spinner">Loading your command center...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="founder-dashboard error">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button onClick={fetchDashboardData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="founder-dashboard">
      <header className="dashboard-header">
        <h1>🎯 Founder Command Center</h1>
        <p className="dashboard-subtitle">
          "Know your numbers better than anyone" - John D. Rockefeller
        </p>
        <p className="last-checked">{dashboard?.last_checked}</p>
      </header>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          📊 Daily Metrics
        </button>
        <button
          className={`tab ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          ✅ Daily Checklist
        </button>
        <button
          className={`tab ${activeTab === 'quarterly' ? 'active' : ''}`}
          onClick={() => setActiveTab('quarterly')}
        >
          🎯 Quarterly Goal
        </button>
      </div>

      {/* METRICS TAB */}
      {activeTab === 'metrics' && dashboard && (
        <div className="metrics-view">
          {/* The 5 Numbers You Check Every Morning */}
          <section className="core-metrics">
            <h2>Core Metrics</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">New Signups Today</div>
                <div className="metric-value large">
                  {dashboard.daily_metrics.new_signups_today}
                </div>
                <div className="metric-context">
                  7d avg: {dashboard.daily_metrics.seven_day_avg} |
                  30d avg: {dashboard.daily_metrics.thirty_day_avg}
                </div>
                <div className="metric-trend">
                  {getTrendIcon(dashboard.trends.signup_trend)}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Activation Rate</div>
                <div className="metric-value large">
                  {dashboard.daily_metrics.activation_rate}%
                </div>
                <div className="metric-context">
                  Target: 40%
                </div>
                <div
                  className="health-bar"
                  style={{
                    width: `${Math.min(dashboard.daily_metrics.activation_rate, 100)}%`,
                    backgroundColor: getHealthColor(dashboard.health.activation_status)
                  }}
                />
              </div>

              <div className="metric-card">
                <div className="metric-label">Active Users (30d)</div>
                <div className="metric-value large">
                  {dashboard.daily_metrics.active_users}
                </div>
                <div className="metric-context">
                  Engagement: {dashboard.trends.engagement_score}%
                </div>
                <div
                  className="health-indicator"
                  style={{
                    backgroundColor: getHealthColor(dashboard.health.engagement_status)
                  }}
                />
              </div>

              {dashboard.daily_metrics.mrr !== null && (
                <div className="metric-card highlight">
                  <div className="metric-label">💰 MRR</div>
                  <div className="metric-value large">
                    ${dashboard.daily_metrics.mrr}
                  </div>
                  <div className="metric-context">
                    {dashboard.daily_metrics.paying_customers} paying customers
                  </div>
                </div>
              )}

              <div className="metric-card">
                <div className="metric-label">Workflows Today</div>
                <div className="metric-value large">
                  {dashboard.daily_metrics.workflow_executions_today}
                </div>
                <div className="metric-context">
                  User activity indicator
                </div>
              </div>
            </div>
          </section>

          {/* Health Indicators */}
          <section className="health-section">
            <h2>System Health</h2>
            <div className="health-grid">
              <div className="health-card">
                <div className="health-label">Growth</div>
                <div
                  className="health-status"
                  style={{ backgroundColor: getHealthColor(dashboard.health.growth_status) }}
                >
                  {dashboard.health.growth_status}
                </div>
                <div className="health-detail">
                  {dashboard.daily_metrics.seven_day_avg} signups/day (target: 5+)
                </div>
              </div>

              <div className="health-card">
                <div className="health-label">Activation</div>
                <div
                  className="health-status"
                  style={{ backgroundColor: getHealthColor(dashboard.health.activation_status) }}
                >
                  {dashboard.health.activation_status}
                </div>
                <div className="health-detail">
                  {dashboard.daily_metrics.activation_rate}% activation (target: 40%+)
                </div>
              </div>

              <div className="health-card">
                <div className="health-label">Engagement</div>
                <div
                  className="health-status"
                  style={{ backgroundColor: getHealthColor(dashboard.health.engagement_status) }}
                >
                  {dashboard.health.engagement_status}
                </div>
                <div className="health-detail">
                  {dashboard.trends.engagement_score}% DAU/MAU (target: 20%+)
                </div>
              </div>
            </div>
          </section>

          {/* Support Metrics */}
          {dashboard.support && (
            <section className="support-section">
              <h2>Support Status</h2>
              <div className="support-stats">
                <div className="support-stat">
                  <span className="stat-label">Open Tickets:</span>
                  <span className="stat-value">{dashboard.support.open_tickets}</span>
                </div>
                <div className="support-stat">
                  <span className="stat-label">Last 7 Days:</span>
                  <span className="stat-value">{dashboard.support.total_tickets_7d}</span>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* DAILY CHECKLIST TAB */}
      {activeTab === 'checklist' && checklist && (
        <div className="checklist-view">
          <section className="checklist-section">
            <h2>Daily Rockefeller Checklist</h2>
            <p className="checklist-description">
              Complete these 8 items every day to operate like Rockefeller
            </p>

            <div className="checklist-items">
              {Object.entries({
                morning_metrics_reviewed: 'Morning metrics review (5 min)',
                efficiency_improvement_identified: 'One efficiency improvement identified',
                competitive_intelligence_checked: 'Competitive intelligence checked',
                customer_feedback_reviewed: 'Customer feedback reviewed',
                values_applied_to_decision: 'Values applied to one decision',
                strategy_articulated: 'Strategy articulated once',
                evening_log_completed: 'Evening log completed',
                tomorrow_priority_set: "Tomorrow's #1 priority set"
              }).map(([key, label]) => (
                <div key={key} className="checklist-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={checklist.items[key] || false}
                      onChange={(e) => updateChecklistItem(key, e.target.checked)}
                    />
                    <span className="checklist-label">{label}</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="checklist-completion">
              <div className="completion-bar">
                <div
                  className="completion-progress"
                  style={{
                    width: `${(Object.values(checklist.items).filter(Boolean).length / 8) * 100}%`
                  }}
                />
              </div>
              <p className="completion-text">
                {Object.values(checklist.items).filter(Boolean).length} of 8 completed
              </p>
            </div>

            <div className="checklist-notes">
              <div className="note-field">
                <label>Today's #1 Priority Task:</label>
                <input
                  type="text"
                  value={checklist.priority_task || ''}
                  onChange={(e) => setChecklist({ ...checklist, priority_task: e.target.value })}
                  placeholder="What's the ONE thing to accomplish today?"
                />
              </div>

              <div className="note-field">
                <label>Did I move closer to the quarterly goal?</label>
                <select
                  value={checklist.moved_closer_to_goal === null ? '' : checklist.moved_closer_to_goal}
                  onChange={(e) => setChecklist({
                    ...checklist,
                    moved_closer_to_goal: e.target.value === 'true'
                  })}
                >
                  <option value="">Select...</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="note-field">
                <label>What did I learn today?</label>
                <textarea
                  value={checklist.daily_learning || ''}
                  onChange={(e) => setChecklist({ ...checklist, daily_learning: e.target.value })}
                  placeholder="One key learning or insight from today..."
                  rows={3}
                />
              </div>

              <button
                className="save-button"
                onClick={() => {
                  const token = localStorage.getItem('token');
                  axios.post(
                    `${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/api/founder/daily-checklist`,
                    checklist,
                    { headers: { Authorization: `Bearer ${token}` } }
                  ).then(() => alert('Checklist saved!'));
                }}
              >
                Save Checklist
              </button>
            </div>
          </section>
        </div>
      )}

      {/* QUARTERLY GOAL TAB */}
      {activeTab === 'quarterly' && dashboard?.quarterly_progress && (
        <div className="quarterly-view">
          <section className="quarterly-section">
            <h2>Q4 2025 #1 Priority</h2>
            <div className="quarterly-goal">
              <h3>{dashboard.quarterly_progress.q4_goal}</h3>

              <div className="progress-tracker">
                <div className="progress-label">
                  Progress: {dashboard.quarterly_progress.current_paying} / 5 customers
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${dashboard.quarterly_progress.progress_percent}%`,
                      backgroundColor: dashboard.quarterly_progress.on_track ? '#10b981' : '#f59e0b'
                    }}
                  />
                </div>
                <div className="progress-percent">
                  {dashboard.quarterly_progress.progress_percent}% Complete
                </div>
              </div>

              <div className="quarterly-status">
                <span className={`status-badge ${dashboard.quarterly_progress.on_track ? 'on-track' : 'needs-attention'}`}>
                  {dashboard.quarterly_progress.on_track ? '✅ On Track' : '⚠️ Needs Attention'}
                </span>
              </div>

              <div className="quarterly-actions">
                <h4>Focus Areas:</h4>
                <ul>
                  <li>Validate product-market fit</li>
                  <li>Create testimonial base</li>
                  <li>Generate first revenue</li>
                  <li>Break psychological barrier</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Quick Actions */}
      <section className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button onClick={() => window.location.href = '/founder/competitive-intel'}>
            📊 Competitive Intel
          </button>
          <button onClick={() => window.location.href = '/founder/efficiency'}>
            ⚡ Efficiency Tracker
          </button>
          <button onClick={() => window.location.href = '/founder/weekly-review'}>
            📝 Weekly Review
          </button>
          <button onClick={fetchDashboardData}>
            🔄 Refresh Dashboard
          </button>
        </div>
      </section>
    </div>
  );
};

export default FounderDashboard;
