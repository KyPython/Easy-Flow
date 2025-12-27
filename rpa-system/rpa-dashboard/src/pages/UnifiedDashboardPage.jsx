import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';
import logger from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';
import { getConfig } from '../utils/dynamicConfig';
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
  }
};

const UnifiedDashboardPage = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [integrations, setIntegrations] = useState([]);
  const [integrationUsage, setIntegrationUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAllStatus = useCallback(async () => {
    if (!user) return;

    try {
      setError('');
      
      // Fetch integrations status (external tools only)
      const integrationsResponse = await api.get('/api/integrations').catch(() => ({ data: { success: false, integrations: [] } }));
      const connectedIntegrations = integrationsResponse.data.success 
        ? integrationsResponse.data.integrations 
        : [];

      // Fetch integration usage stats (workflows, recent activity)
      const usageResponse = await api.get('/api/integrations/usage').catch(() => ({ data: { success: false, usage: {} } }));
      const usageData = usageResponse.data.success 
        ? usageResponse.data.usage 
        : {};

      setIntegrations(connectedIntegrations);
      setIntegrationUsage(usageData);
      setLastRefresh(new Date());
      
      logger.info('[UnifiedDashboard] External tools status refreshed', {
        integrations_count: connectedIntegrations.length
      });
    } catch (err) {
      logger.error('Failed to fetch status', { error: err.message || err });
      setError(sanitizeErrorMessage(err) || getEnvMessage({
        dev: 'Failed to load status: ' + (err.message || 'Unknown error'),
        prod: 'Failed to load status. Please try again.'
      }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllStatus();
    
    // Auto-refresh every 30 seconds
    const refreshInterval = getConfig('intervals.statusRefresh', 30000);
    const interval = setInterval(fetchAllStatus, refreshInterval);
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
            <span className={styles.statLabel}>Total Integrations</span>
            <span className={styles.statValue}>{integrations.length}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Active Integrations</span>
            <span className={styles.statValue}>
              {integrations.filter(i => i.isActive).length}
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
                      {integrationUsage[tool.id] && (
                        <>
                          {integrationUsage[tool.id].workflowCount > 0 && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Used in:</span>
                              <span className={styles.detailValue}>
                                {integrationUsage[tool.id].workflowCount} workflow{integrationUsage[tool.id].workflowCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                          {integrationUsage[tool.id].recentActivityCount > 0 && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Recent Activity:</span>
                              <span className={styles.detailValue}>
                                {integrationUsage[tool.id].recentActivityCount} run{integrationUsage[tool.id].recentActivityCount !== 1 ? 's' : ''} (24h)
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  <div className={styles.toolActions}>
                    {integration ? (
                      <>
                        <button
                          className={styles.actionBtn}
                          onClick={() => navigate('/app/integrations')}
                        >
                          Manage
                        </button>
                        {integrationUsage[tool.id]?.workflows && integrationUsage[tool.id].workflows.length > 0 && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => navigate('/app/workflows')}
                            style={{ marginTop: '8px', fontSize: '0.9em' }}
                          >
                            View Workflows ({integrationUsage[tool.id].workflows.length})
                          </button>
                        )}
                        <button
                          className={styles.actionBtn}
                          onClick={() => navigate(`/app/workflows?create=${tool.id}`)}
                          style={{ marginTop: '8px', fontSize: '0.9em', background: tool.color }}
                        >
                          ➕ Create Automation
                        </button>
                      </>
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

      {/* EasyFlow Automation Activity */}
      {Object.keys(integrationUsage).some(toolId => integrationUsage[toolId]?.recentActivityCount > 0) && (
        <div className={styles.automationActivity}>
          <h2 className={styles.sectionTitle}>🤖 EasyFlow Automation Activity</h2>
          <p className={styles.sectionSubtitle}>
            Recent automations using your connected tools (last 24 hours)
          </p>
          <div className={styles.activityGrid}>
            {Object.entries(integrationUsage)
              .filter(([_, stats]) => stats.recentActivityCount > 0)
              .map(([toolId, stats]) => {
                const tool = Object.values(TOOL_CATEGORIES)
                  .flatMap(cat => cat.tools)
                  .find(t => t.id === toolId);
                if (!tool) return null;
                
                return (
                  <div key={toolId} className={styles.activityCard}>
                    <div className={styles.activityHeader}>
                      <div 
                        className={styles.activityIcon}
                        style={{ background: tool.color }}
                      >
                        {tool.icon}
                      </div>
                      <div>
                        <h3 className={styles.activityToolName}>{tool.name}</h3>
                        <p className={styles.activityCount}>
                          {stats.recentActivityCount} automation{stats.recentActivityCount !== 1 ? 's' : ''} ran
                        </p>
                      </div>
                    </div>
                    {stats.workflows && stats.workflows.length > 0 && (
                      <div className={styles.activityWorkflows}>
                        <span className={styles.activityLabel}>Active in:</span>
                        <div className={styles.workflowTags}>
                          {stats.workflows.slice(0, 3).map(w => (
                            <span key={w.id} className={styles.workflowTag}>
                              {w.name}
                            </span>
                          ))}
                          {stats.workflows.length > 3 && (
                            <span className={styles.workflowTag}>
                              +{stats.workflows.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      className={styles.activityBtn}
                      onClick={() => navigate('/app/workflows')}
                    >
                      View Workflows →
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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
            onClick={() => navigate('/app')}
          >
            📊 View EasyFlow Dashboard
          </button>
          <button 
            className={styles.quickActionBtn}
            onClick={() => navigate('/app/workflows')}
          >
            ➕ Create New Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboardPage;

