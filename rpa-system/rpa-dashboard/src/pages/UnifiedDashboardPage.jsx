import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';
import logger from '../utils/logger';
import styles from './UnifiedDashboardPage.module.css';

const TOOL_CATEGORIES = {
  communication: {
    name: 'Communication',
    tools: [
      { id: 'slack', name: 'Slack', icon: '💬', color: '#4A154B' },
      { id: 'gmail', name: 'Gmail', icon: '📧', color: '#EA4335' },
      { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366' }
    ]
  },
  productivity: {
    name: 'Productivity',
    tools: [
      { id: 'google_sheets', name: 'Google Sheets', icon: '📊', color: '#0F9D58' },
      { id: 'google_meet', name: 'Google Meet', icon: '🎥', color: '#00832D' },
      { id: 'notion', name: 'Notion', icon: '📝', color: '#000000' }
    ]
  },
  automation: {
    name: 'Automation',
    tools: [
      { id: 'easyflow', name: 'EasyFlow', icon: '🤖', color: '#6366F1' }
    ]
  }
};

const UnifiedDashboardPage = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [integrations, setIntegrations] = useState([]);
  const [automationStats, setAutomationStats] = useState({
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    activeWorkflows: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAllStatus = useCallback(async () => {
    if (!user) return;

    try {
      setError('');
      
      // Fetch integrations status
      const integrationsResponse = await api.get('/api/integrations').catch(() => ({ data: { success: false, integrations: [] } }));
      const connectedIntegrations = integrationsResponse.data.success 
        ? integrationsResponse.data.integrations 
        : [];

      // Fetch automation stats
      const dashboardResponse = await api.get('/api/dashboard').catch(() => ({ data: {} }));
      const dashboardData = dashboardResponse.data || {};

      setIntegrations(connectedIntegrations);
      setAutomationStats({
        totalRuns: dashboardData.totalRuns || 0,
        completedRuns: dashboardData.recentRuns?.filter(r => r.status === 'completed').length || 0,
        failedRuns: dashboardData.recentRuns?.filter(r => r.status === 'failed').length || 0,
        activeWorkflows: dashboardData.activeWorkflows || 0
      });
      
      setLastRefresh(new Date());
      
      logger.info('[UnifiedDashboard] Status refreshed', {
        integrations_count: connectedIntegrations.length,
        total_runs: dashboardData.totalRuns || 0
      });
    } catch (err) {
      logger.error('[UnifiedDashboard] Failed to fetch status', { error: err.message });
      setError('Failed to load status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAllStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchAllStatus]);

  const getToolStatus = (toolId) => {
    const integration = integrations.find(i => i.service === toolId);
    if (!integration) {
      return { status: 'not_connected', label: 'Not Connected', color: 'var(--text-muted)' };
    }
    
    if (!integration.isActive) {
      return { status: 'inactive', label: 'Inactive', color: 'var(--color-error-500)' };
    }
    
    if (integration.testStatus === 'success') {
      return { status: 'connected', label: 'Connected', color: 'var(--color-success-600)' };
    }
    
    if (integration.testStatus === 'failed') {
      return { status: 'error', label: 'Connection Error', color: 'var(--color-error-500)' };
    }
    
    return { status: 'unknown', label: 'Unknown', color: 'var(--text-muted)' };
  };

  const getOverallHealth = () => {
    const allTools = Object.values(TOOL_CATEGORIES).flatMap(cat => cat.tools);
    const connectedCount = allTools.filter(tool => {
      const status = getToolStatus(tool.id);
      return status.status === 'connected';
    }).length;
    
    const total = allTools.length;
    const healthPercentage = (connectedCount / total) * 100;
    
    if (healthPercentage >= 80) return { level: 'excellent', color: 'var(--color-success-600)', label: 'Excellent' };
    if (healthPercentage >= 60) return { level: 'good', color: 'var(--color-warning-500)', label: 'Good' };
    if (healthPercentage >= 40) return { level: 'fair', color: 'var(--color-warning-600)', label: 'Fair' };
    return { level: 'poor', color: 'var(--color-error-500)', label: 'Needs Attention' };
  };

  const overallHealth = getOverallHealth();

  if (loading) {
    return (
      <div className={styles.loadingContainer} data-theme={theme}>
        <div className={styles.spinner}></div>
        <p>Loading unified dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.unifiedDashboard} data-theme={theme}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Unified Dashboard</h1>
          <p className={styles.subtitle}>Status across all your tools in one place</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.refreshBtn}
            onClick={fetchAllStatus}
            title="Refresh status"
          >
            🔄 Refresh
          </button>
          <span className={styles.lastRefresh}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </header>

      {error && (
        <div className={styles.alert} style={{ background: 'var(--color-error-50)', color: 'var(--color-error-700)' }}>
          {error}
        </div>
      )}

      {/* Overall Health Score */}
      <div className={styles.healthCard}>
        <div className={styles.healthHeader}>
          <h2>Overall System Health</h2>
          <span 
            className={styles.healthBadge}
            style={{ background: overallHealth.color }}
          >
            {overallHealth.label}
          </span>
        </div>
        <div className={styles.healthStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Connected Tools</span>
            <span className={styles.statValue}>
              {integrations.filter(i => i.isActive).length} / {Object.values(TOOL_CATEGORIES).flatMap(cat => cat.tools).length}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Automation Runs</span>
            <span className={styles.statValue}>{automationStats.totalRuns}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Success Rate</span>
            <span className={styles.statValue}>
              {automationStats.totalRuns > 0 
                ? Math.round((automationStats.completedRuns / automationStats.totalRuns) * 100)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Tool Categories */}
      {Object.entries(TOOL_CATEGORIES).map(([categoryId, category]) => (
        <div key={categoryId} className={styles.categorySection}>
          <h2 className={styles.categoryTitle}>{category.name}</h2>
          <div className={styles.toolsGrid}>
            {category.tools.map(tool => {
              const toolStatus = getToolStatus(tool.id);
              const integration = integrations.find(i => i.service === tool.id);
              
              return (
                <div key={tool.id} className={styles.toolCard}>
                  <div className={styles.toolHeader}>
                    <div 
                      className={styles.toolIcon}
                      style={{ background: tool.color }}
                    >
                      {tool.icon}
                    </div>
                    <div className={styles.toolInfo}>
                      <h3 className={styles.toolName}>{tool.name}</h3>
                      <div className={styles.toolStatus}>
                        <span 
                          className={styles.statusDot}
                          style={{ background: toolStatus.color }}
                        ></span>
                        <span>{toolStatus.label}</span>
                      </div>
                    </div>
                  </div>
                  
                  {integration && (
                    <div className={styles.toolDetails}>
                      {integration.lastUsedAt && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Last Used:</span>
                          <span className={styles.detailValue}>
                            {new Date(integration.lastUsedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {integration.testStatus && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Test Status:</span>
                          <span className={styles.detailValue}>
                            {integration.testStatus === 'success' ? '✅ Passed' : '❌ Failed'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={styles.toolActions}>
                    {integration ? (
                      <button
                        className={styles.actionBtn}
                        onClick={() => navigate('/app/integrations')}
                      >
                        Manage
                      </button>
                    ) : (
                      <button
                        className={styles.actionBtn}
                        onClick={() => navigate('/app/integrations')}
                        style={{ background: tool.color }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Automation Stats */}
      <div className={styles.automationSection}>
        <h2 className={styles.sectionTitle}>Automation Activity</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{automationStats.totalRuns}</div>
              <div className={styles.statLabel}>Total Runs</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{automationStats.completedRuns}</div>
              <div className={styles.statLabel}>Completed</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>❌</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{automationStats.failedRuns}</div>
              <div className={styles.statLabel}>Failed</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔄</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{automationStats.activeWorkflows}</div>
              <div className={styles.statLabel}>Active Workflows</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <button 
            className={styles.quickActionBtn}
            onClick={() => navigate('/app/integrations')}
          >
            🔌 Manage Integrations
          </button>
          <button 
            className={styles.quickActionBtn}
            onClick={() => navigate('/app/history')}
          >
            📜 View History
          </button>
          <button 
            className={styles.quickActionBtn}
            onClick={() => navigate('/app/analytics')}
          >
            📈 View Analytics
          </button>
          <button 
            className={styles.quickActionBtn}
            onClick={() => navigate('/app')}
          >
            ➕ Create Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboardPage;

