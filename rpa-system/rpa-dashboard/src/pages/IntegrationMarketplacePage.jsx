import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';
import logger from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';
import PlanGate from '../components/PlanGate/PlanGate';
import IntegrationKeyModal from '../components/IntegrationKeyModal/IntegrationKeyModal';
import styles from './IntegrationsPage.module.css';

// Integration catalog for marketplace (superset of IntegrationsPage)
const CATALOG = [
  // Communication
  { id: 'slack', name: 'Slack', description: 'Send messages, read channels, collect feedback', icon: '💬', color: '#4A154B', oauthSupported: true, category: 'Communication' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Post messages, collaborate across channels (scaffold)', icon: '💼', color: '#6264A7', oauthSupported: true, category: 'Communication' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Send messages via WhatsApp Business API', icon: '💬', color: '#25D366', oauthSupported: true, category: 'Communication' },

  // Google Workspace
  { id: 'gmail', name: 'Gmail', description: 'Send emails, read inbox, collect feedback', icon: '📧', color: '#EA4335', oauthSupported: true, category: 'Google Workspace' },
  { id: 'google_sheets', name: 'Google Sheets', description: 'Read/write data, compile feedback', icon: '📊', color: '#0F9D58', oauthSupported: true, category: 'Google Workspace' },
  { id: 'google_drive', name: 'Google Drive', description: 'Upload files, create folders', icon: '📁', color: '#4285F4', oauthSupported: true, category: 'Google Workspace' },
  { id: 'google_meet', name: 'Google Meet', description: 'Transcribe, process recordings', icon: '🎥', color: '#00832D', oauthSupported: true, category: 'Google Workspace' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Read and manage events', icon: '📅', color: '#4285F4', oauthSupported: true, category: 'Google Workspace' },

  // Storage & Files
  { id: 'dropbox', name: 'Dropbox', description: 'Manage files and folders (scaffold)', icon: '🗂️', color: '#0061FF', oauthSupported: true, category: 'Storage' },

  // CRM / Sales / Marketing
  { id: 'salesforce', name: 'Salesforce', description: 'Query data, manage records (scaffold)', icon: '☁️', color: '#00A1E0', oauthSupported: true, category: 'CRM' },
  { id: 'hubspot', name: 'HubSpot', description: 'Sync contacts and activities (scaffold)', icon: '🧲', color: '#FF7A59', oauthSupported: true, category: 'CRM' },

  // Accounting
  { id: 'quickbooks', name: 'QuickBooks', description: 'Import invoices and data (scaffold)', icon: '💵', color: '#2CA01C', oauthSupported: true, category: 'Accounting' },

  // Project Management
  { id: 'asana', name: 'Asana', description: 'Create tasks and manage projects (scaffold)', icon: '✅', color: '#F06A6A', oauthSupported: true, category: 'Project Management' },
  { id: 'trello', name: 'Trello', description: 'Boards, lists, and cards (token-based)', icon: '🧩', color: '#0079BF', oauthSupported: false, category: 'Project Management' },

  // Social
  { id: 'linkedin', name: 'LinkedIn', description: 'Read profile and share content (scaffold)', icon: '🔗', color: '#0A66C2', oauthSupported: true, category: 'Social' },
  { id: 'twitter', name: 'Twitter/X', description: 'Read user/tweet data (scaffold)', icon: '🐦', color: '#1DA1F2', oauthSupported: true, category: 'Social' },

  // Knowledge & Others
  { id: 'notion', name: 'Notion', description: 'Read and write pages, databases', icon: '📝', color: '#000000', oauthSupported: true, category: 'Knowledge' },
  { id: 'reddit', name: 'Reddit', description: 'Monitor subs, analyze sentiment (no auth)', icon: '📱', color: '#FF4500', oauthSupported: false, category: 'Social' },
];

const IntegrationMarketplacePage = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [testing, setTesting] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  useEffect(() => {
    const initializePage = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const successParam = urlParams.get('success');
      const errorParam = urlParams.get('error');

      if (successParam === 'true') {
        setSuccess(getEnvMessage({
          dev: 'Integration connected successfully! Testing connection...',
          prod: 'Integration connected successfully!'
        }));
        setError('');
        cleanupUrl();
        await loadIntegrations();
      } else if (errorParam) {
        const decodedError = decodeURIComponent(errorParam);
        const errorMsg = formatOAuthError(decodedError);
        setError(errorMsg);
        setSuccess('');
        cleanupUrl();
        await loadIntegrations();
      } else {
        await loadIntegrations();
      }
    };

    initializePage();
  }, []);

  const cleanupUrl = () => {
    const currentPath = window.location.pathname;
    window.history.replaceState({}, '', currentPath);
  };

  const formatOAuthError = (decodedError) => {
    return getEnvMessage({
      dev: decodedError,
      prod: decodedError.includes('redirect_uri')
        ? 'OAuth configuration error. Please contact support.'
        : decodedError.includes('invalid') || decodedError.includes('expired')
        ? 'Authentication expired. Please try connecting again.'
        : decodedError.includes('not configured')
        ? 'This integration is temporarily unavailable. Please contact support.'
        : 'Connection failed. Please try again or contact support if this persists.'
    });
  };

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const [integrationsResp] = await Promise.all([
        api.get('/api/integrations')
      ]);

      if (integrationsResp.data.success) {
        setIntegrations(integrationsResp.data.integrations);
      }
    } catch (err) {
      logger.error('Failed to load integrations', err);
      setError(sanitizeErrorMessage(err) || getEnvMessage({
        dev: 'Failed to load integrations: ' + (err.message || 'Unknown error'),
        prod: 'Failed to load integrations. Please try again.'
      }));
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (service) => integrations.find(i => i.service === service);

  const handleConnect = async (service) => {
    try {
      setConnecting(service);
      setError('');
      setSuccess('');

      // Reddit requires no auth; Trello can use API key modal
      if (service === 'reddit') {
        const response = await api.post(`/api/integrations/${service}/test`);
        if (response.data.success) {
          setSuccess(getEnvMessage({
            dev: 'Reddit connection test successful - ready to use in workflows',
            prod: 'Reddit is now available in your workflows!'
          }));
          loadIntegrations();
        } else {
          setError(getEnvMessage({
            dev: 'Reddit connection test failed',
            prod: 'Failed to connect to Reddit. Please try again.'
          }));
        }
        setConnecting(null);
        return;
      }

      const integration = CATALOG.find(i => i.id === service);
      if (!integration) throw new Error('Unknown integration');

      if (!integration.oauthSupported) {
        // Show API key modal for Trello (and any future token-based providers)
        setSelectedIntegration(integration);
        setShowKeyModal(true);
        return;
      }

      // Start OAuth flow using existing endpoint
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isSlack = service === 'slack';
      const callbackBaseUrl = (isDevelopment && !isSlack)
        ? 'http://localhost:3030'
        : 'https://easyflow-backend-ad8e.onrender.com';
      const redirectUri = `${callbackBaseUrl}/api/integrations/${service}/oauth/callback`;
      const returnPath = window.location.pathname + window.location.search;

      const response = await api.get(`/api/integrations/${service}/oauth/start`, {
        params: { redirect_uri: redirectUri, return_path: returnPath }
      });

      if (response.data.success) {
        openOAuthPopup(response.data.oauthUrl, service);
      }
    } catch (err) {
      handleConnectError(err, service);
    } finally {
      setConnecting(null);
    }
  };

  const openOAuthPopup = (oauthUrl, service) => {
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      oauthUrl,
      `${service}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      setError('Popup blocked. Please allow popups for this site and try again.');
      setConnecting(null);
      return;
    }

    const checkClosed = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnecting(null);
          loadIntegrations();
        }
      } catch (e) {
        // Expected COOP error
      }
    }, 500);

    setTimeout(() => {
      try { if (!popup.closed) popup.close(); } catch (err) {}
      clearInterval(checkClosed);
      setConnecting(null);
      setError('OAuth flow timed out. Please try again.');
    }, 5 * 60 * 1000);
  };

  const handleConnectError = (err, service) => {
    const integration = CATALOG.find(i => i.id === service);
    const serviceName = integration?.name || service;

    if (err.response?.data?.error?.includes('not configured')) {
      setError(getEnvMessage({
        dev: `${serviceName} OAuth is not configured. Please set ${serviceName.toUpperCase()}_CLIENT_ID and ${serviceName.toUpperCase()}_CLIENT_SECRET in the environment.`,
        prod: `${serviceName} integration is temporarily unavailable. Please contact support.`
      }));
    } else {
      logger.error('Failed to connect integration:', err);
      setError(sanitizeErrorMessage(err) || getEnvMessage({
        dev: `Failed to connect ${serviceName}: ${err.message || 'Unknown error'}`,
        prod: `Failed to connect ${serviceName}. Please try again.`
      }));
    }
  };

  const handleTest = async (service) => {
    try {
      setTesting(service);
      setError('');
      setSuccess('');

      const response = await api.post(`/api/integrations/${service}/test`);
      const integration = CATALOG.find(i => i.id === service);
      const serviceName = integration?.name || service;

      if (response.data.success) {
        setSuccess(getEnvMessage({
          dev: `${service} connection test successful`,
          prod: `${serviceName} connection test successful!`
        }));
      } else {
        handleTestError(response.data, service, serviceName);
      }

      loadIntegrations();
    } catch (err) {
      handleTestException(err, service);
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (service) => {
    const integration = CATALOG.find(i => i.id === service);
    const serviceName = integration?.name || service;
    const confirmMsg = getEnvMessage({
      dev: `Are you sure you want to disconnect ${service}?`,
      prod: `Are you sure you want to disconnect ${serviceName}?`
    });

    if (!confirm(confirmMsg)) return;

    try {
      setError('');
      setSuccess('');

      await api.delete(`/api/integrations/${service}`);
      setSuccess(getEnvMessage({
        dev: `${service} disconnected successfully`,
        prod: `${serviceName} disconnected successfully`
      }));
      loadIntegrations();
    } catch (err) {
      console.error('Failed to disconnect integration:', err);
      setError(getEnvMessage({
        dev: err.response?.data?.error || `Failed to disconnect ${service}`,
        prod: err.response?.data?.error || `Failed to disconnect ${serviceName}. Please try again.`
      }));
    }
  };

  const handleTestError = (data, service, serviceName) => {
    if (data.actionUrl && data.isConfigIssue) {
      setError(
        <div>
          <p>{data.error}</p>
          <a 
            href={data.actionUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-block',
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none'
            }}
          >
            Open Provider Console
          </a>
        </div>
      );
    } else if (data.needsReconnect) {
      setError(
        <div>
          <p>{data.error}</p>
          <button 
            onClick={() => handleDisconnect(service)}
            style={{ 
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reconnect Integration
          </button>
        </div>
      );
    } else {
      setError(getEnvMessage({
        dev: data.error || `Connection test failed for ${service}`,
        prod: data.error?.includes('credentials') || data.error?.includes('authentication')
          ? `${serviceName} connection failed. Please reconnect the integration.`
          : `Connection test failed for ${serviceName}. Please try again.`
      }));
    }
  };

  const handleTestException = (err, service) => {
    console.error('Failed to test integration:', err);
    const integration = CATALOG.find(i => i.id === service);
    const serviceName = integration?.name || service;
    const errorMsg = err.response?.data?.error || err.message;

    if (err.response?.data?.actionUrl && err.response?.data?.isConfigIssue) {
      setError(
        <div>
          <p>{err.response.data.error}</p>
          <a 
            href={err.response.data.actionUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-block',
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none'
            }}
          >
            Open Provider Console
          </a>
        </div>
      );
    } else {
      setError(getEnvMessage({
        dev: errorMsg || `Failed to test ${service}`,
        prod: errorMsg?.includes('credentials') || errorMsg?.includes('authentication')
          ? `${serviceName} connection failed. Please reconnect the integration.`
          : `Failed to test ${serviceName}. Please try again.`
      }));
    }
  };

  const handleApiKeyConnect = async (credentials) => {
    if (!selectedIntegration) return;

    try {
      setConnecting(selectedIntegration.id);
      setError('');
      setSuccess('');

      await api.post(`/api/integrations/${selectedIntegration.id}/connect`, {
        credentials,
        displayName: `${selectedIntegration.name} Integration`
      });

      setSuccess(getEnvMessage({
        dev: `${selectedIntegration.id} connected successfully`,
        prod: `${selectedIntegration.name} connected successfully!`
      }));
      setShowKeyModal(false);
      setSelectedIntegration(null);
      loadIntegrations();
    } catch (err) {
      logger.error('Failed to connect integration:', err);
      const errorMsg = err.response?.data?.error || err.message;
      throw new Error(getEnvMessage({
        dev: errorMsg || `Failed to connect ${selectedIntegration.id}`,
        prod: errorMsg || `Failed to connect ${selectedIntegration.name}. Please try again.`
      }));
    } finally {
      setConnecting(null);
    }
  };

  // Simple category grouping for readability
  const categories = Array.from(new Set(CATALOG.map(i => i.category)));

  return (
    <PlanGate 
      requiredPlan="Professional"
      feature="custom_integrations"
      upgradeMessage="Discover and connect integrations. Available on Professional and Enterprise plans."
      onPaywallClose={() => navigate(-1)}
    >
      <div className={styles.integrationsPage} data-theme={theme}>
        <header className={styles.header}>
          <h1 className={styles.title}>Integration Marketplace</h1>
          <p className={styles.subtitle}>Discover and connect integrations to power your workflows</p>
        </header>

        {error && (
          <div 
            className={styles.alert} 
            style={{ background: 'var(--color-error-50)', color: 'var(--color-error-700)', borderColor: 'var(--color-error-200)' }}
          >
            {error}
          </div>
        )}

        {success && (
          <div 
            className={styles.alert} 
            style={{ background: 'var(--color-success-50)', color: 'var(--color-success-700)', borderColor: 'var(--color-success-200)' }}
          >
            {success}
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Loading integrations...</div>
        ) : (
          <>
            {categories.map(category => (
              <div key={category} style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, margin: '24px 0 12px', fontWeight: 600 }}>{category}</h2>
                <div className={styles.integrationsGrid}>
                  {CATALOG.filter(i => i.category === category).map(integration => {
                    const status = getIntegrationStatus(integration.id);
                    const isConnected = !!status;
                    const isActive = status?.isActive;
                    const testStatus = status?.testStatus;

                    return (
                      <div key={integration.id} className={styles.integrationCard}>
                        <div className={styles.cardHeader}>
                          <div className={styles.icon} style={{ background: integration.color }}>
                            {integration.icon}
                          </div>
                          <div className={styles.cardInfo}>
                            <h2 className={styles.cardTitle}>{integration.name}</h2>
                            <p className={styles.cardDescription}>{integration.description}</p>
                          </div>
                        </div>

                        <div className={styles.cardStatus}>
                          {isConnected ? (
                            <>
                              <div className={styles.statusBadge}>
                                <span className={styles.statusDot} style={{ background: isActive ? 'var(--color-success-600)' : 'var(--color-error-500)' }}></span>
                                {isActive ? 'Connected' : 'Inactive'}
                              </div>
                              {testStatus && (
                                <div className={styles.testStatus}>
                                  Test: {testStatus === 'success' ? '✅' : testStatus === 'failed' ? '❌' : '⏳'}
                                </div>
                              )}
                              {status?.lastUsedAt && (
                                <div className={styles.lastUsed}>
                                  Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
                                </div>
                              )}
                            </>
                          ) : integration.id === 'reddit' ? (
                            <div className={styles.statusBadge}>
                              <span className={styles.statusDot} style={{ background: 'var(--color-success-600)' }}></span>
                              Available (No Auth Required)
                            </div>
                          ) : (
                            <div className={styles.statusBadge}>
                              <span className={styles.statusDot} style={{ background: 'var(--text-muted)' }}></span>
                              Not Connected
                            </div>
                          )}
                        </div>

                        <div className={styles.cardActions}>
                          {isConnected ? (
                            <>
                              <button
                                className={styles.btnSecondary}
                                onClick={() => handleTest(integration.id)}
                                disabled={testing === integration.id}
                              >
                                {testing === integration.id ? 'Testing...' : 'Test Connection'}
                              </button>
                              <button
                                className={styles.btnDanger}
                                onClick={() => handleDisconnect(integration.id)}
                              >
                                Disconnect
                              </button>
                            </>
                          ) : integration.id === 'reddit' ? (
                            <button
                              className={styles.btnSecondary}
                              onClick={() => handleConnect(integration.id)}
                              disabled={connecting === integration.id}
                              style={{ minWidth: '140px' }}
                            >
                              {connecting === integration.id ? 'Testing...' : 'Test Connection'}
                            </button>
                          ) : (
                            <button
                              className={styles.btnPrimary}
                              onClick={() => handleConnect(integration.id)}
                              disabled={connecting === integration.id}
                              style={{ background: integration.color }}
                            >
                              {connecting === integration.id ? 'Connecting...' : 'Connect'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <div className={styles.infoSection}>
          <h2>How the Marketplace Works</h2>
          <ul>
            <li>OAuth is supported for most providers. Trello uses API key & token via the secure key modal.</li>
            <li>Credentials are encrypted at rest. You can test and disconnect at any time.</li>
            <li>This page includes scaffolding for several providers. Some actions are pending full implementation.</li>
          </ul>
        </div>

        <IntegrationKeyModal
          isOpen={showKeyModal}
          onClose={() => { setShowKeyModal(false); setSelectedIntegration(null); }}
          integration={selectedIntegration}
          onConnect={handleApiKeyConnect}
        />
      </div>
    </PlanGate>
  );
};

export default IntegrationMarketplacePage;
