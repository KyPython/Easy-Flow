import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FounderMetrics.css';

const API_BASE = window.ENV?.API_BASE || process.env.REACT_APP_API_BASE || 'http://localhost:3030';

export default function FounderMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('metrics');

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/founder/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMetrics(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="founder-metrics-container">
        <div className="loading-spinner">Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="founder-metrics-container">
        <div className="error-message">
          <h3>Error Loading Metrics</h3>
          <p>{error}</p>
          <button onClick={fetchMetrics} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="founder-metrics-container">
      <header className="founder-header">
        <h1>🎯 Rockefeller Dashboard</h1>
        <p>Your daily command center</p>
      </header>

      <div className="metrics-tabs">
        <button 
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
        <button 
          className={`tab ${activeTab === 'quarterly' ? 'active' : ''}`}
          onClick={() => setActiveTab('quarterly')}
        >
          Quarterly Goal
        </button>
      </div>

      {activeTab === 'metrics' && (
        <div className="metrics-grid">
          <MetricCard
            title="New Signups Today"
            value={metrics?.daily_metrics?.new_signups_today || 0}
            trend={metrics?.trends?.signup_trend}
            subtitle={`7-day avg: ${metrics?.daily_metrics?.seven_day_avg || 0}`}
          />
          
          <MetricCard
            title="Activation Rate"
            value={`${metrics?.daily_metrics?.activation_rate || 0}%`}
            health={metrics?.health?.activation_status}
            subtitle="Users who created workflows"
          />
          
          <MetricCard
            title="MRR"
            value={`$${metrics?.daily_metrics?.mrr || 0}`}
            subtitle={`${metrics?.daily_metrics?.paying_customers || 0} paying customers`}
          />
          
          <MetricCard
            title="Active Users"
            value={metrics?.daily_metrics?.active_users || 0}
            subtitle="Last 30 days"
          />

          <MetricCard
            title="Workflow Executions"
            value={metrics?.daily_metrics?.workflow_executions_today || 0}
            subtitle="Today"
          />

          <MetricCard
            title="Engagement Score"
            value={`${metrics?.trends?.engagement_score || 0}%`}
            health={metrics?.health?.engagement_status}
            subtitle="DAU/MAU ratio"
          />
        </div>
      )}

      {activeTab === 'quarterly' && metrics?.quarterly_priority && (
        <div className="quarterly-section">
          <h2>Q4 2025 Priority</h2>
          <div className="quarterly-goal">
            <h3>{metrics.quarterly_priority.priority}</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${metrics.quarterly_priority.progress_percentage || 0}%` }}
              />
            </div>
            <p className="progress-text">
              {metrics.quarterly_priority.progress_percentage || 0}% Complete
            </p>
            
            {metrics.quarterly_priority.supporting_initiatives && (
              <div className="initiatives">
                <h4>Supporting Initiatives:</h4>
                <ul>
                  {metrics.quarterly_priority.supporting_initiatives.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="quick-actions">
        <button onClick={fetchMetrics} className="btn-refresh">
          🔄 Refresh Metrics
        </button>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, health, subtitle }) {
  const getHealthColor = (status) => {
    if (status === 'healthy') return 'green';
    if (status === 'warning') return 'orange';
    if (status === 'critical') return 'red';
    return 'gray';
  };

  return (
    <div className={`metric-card ${health ? `health-${health}` : ''}`}>
      <h3>{title}</h3>
      <div className="metric-value">
        {value}
        {trend && <span className={`trend trend-${trend}`}>
          {trend === 'up' ? '↑' : '↓'}
        </span>}
        {health && <span className={`health-indicator ${health}`} />}
      </div>
      {subtitle && <p className="metric-subtitle">{subtitle}</p>}
    </div>
  );
}
