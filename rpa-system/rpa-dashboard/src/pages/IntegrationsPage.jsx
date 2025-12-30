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

const INTEGRATIONS = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages, read channels, collect feedback',
    icon: '💬',
    color: '#4A154B',
    oauthSupported: true
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send emails, read inbox, collect feedback',
    icon: '📧',
    color: '#EA4335',
    oauthSupported: true
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Read and write data, compile feedback',
    icon: '📊',
    color: '#0F9D58',
    oauthSupported: true
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Upload files, create folders, manage documents',
    icon: '📁',
    color: '#4285F4',
    oauthSupported: true
  },
  {
    id: 'google_meet',
    name: 'Google Meet',
    description: 'Transcribe recordings, process meetings',
    icon: '🎥',
    color: '#00832D',
    oauthSupported: true
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Read events, create meetings, manage schedules',
    icon: '📅',
    color: '#4285F4',
    oauthSupported: true
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send messages via WhatsApp Business API (Meta OAuth or Twilio API keys)',
    icon: '💬',
    color: '#25D366',
    oauthSupported: true // Supports Meta OAuth (can also use API keys for Twilio)
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and write pages, databases, and content',
    icon: '📝',
    color: '#000000',
    oauthSupported: true
  }
];

const IntegrationsPage = () => {
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
    // Check for OAuth callback query parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const errorParam = urlParams.get('error');
    
    if (successParam === 'true') {
      setSuccess(getEnvMessage({
        dev: 'Integration connected successfully! Testing connection...',
        prod: 'Integration connected successfully!'
      }));
      setError('');
      // Clean up URL (remove query params, keep current path)
      const currentPath = window.location.pathname;
      window.history.replaceState({}, '', currentPath);
      
      // Wait a moment for the automatic test to complete, then reload integrations
      // The backend automatically tests connections after OAuth
      setTimeout(() => {
        loadIntegrations();
      }, 2000); // Give backend 2 seconds to complete the test
    } else if (errorParam) {
      const decodedError = decodeURIComponent(errorParam);
      // Format error message based on environment
      const errorMsg = getEnvMessage({
        dev: decodedError,
        prod: decodedError.includes('redirect_uri') 
          ? 'OAuth configuration error. Please contact support.'
          : decodedError.includes('invalid') || decodedError.includes('expired')
          ? 'Authentication expired. Please try connecting again.'
          : decodedError.includes('not configured')
          ? 'This integration is temporarily unavailable. Please contact support.'
          : 'Connection failed. Please try again or contact support if this persists.'
      });
      setError(errorMsg);
      setSuccess('');
      // Clean up URL (remove query params, keep current path)
      const currentPath = window.location.pathname;
      window.history.replaceState({}, '', currentPath);
    }
    
    // Load integrations (will show the newly connected integration if success)
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/integrations');
      if (response.data.success) {
        setIntegrations(response.data.integrations);
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

  const handleConnect = async (service) => {
    try {
      setConnecting(service);
      setError('');
      setSuccess('');

      const integration = INTEGRATIONS.find(i => i.id === service);
      
      if (integration.oauthSupported) {
        // Start OAuth flow
        // Use localhost callback URL for development (Google allows HTTP in testing mode)
        // BUT: Slack requires HTTPS, so always use production URL for Slack
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isSlack = service === 'slack';
        const callbackBaseUrl = (isDevelopment && !isSlack)
          ? 'http://localhost:3030' 
          : 'https://easyflow-backend-ad8e.onrender.com';
        const redirectUri = `${callbackBaseUrl}/api/integrations/${service}/oauth/callback`;
        
        // Store the current page to redirect back after OAuth
        const returnPath = window.location.pathname + window.location.search;
        
        const response = await api.get(`/api/integrations/${service}/oauth/start`, {
          params: {
            redirect_uri: redirectUri,
            return_path: returnPath
          }
        });

        if (response.data.success) {
          // Open OAuth URL in popup
          const width = 600;
          const height = 700;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          
          const popup = window.open(
            response.data.oauthUrl,
            `${service}_oauth`,
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
          );

          if (!popup) {
            setError('Popup blocked. Please allow popups for this site and try again.');
            setConnecting(null);
            return;
          }

          // Poll for popup close (OAuth complete)
          // Note: This may throw COOP errors when OAuth provider redirects, which is expected
          const checkClosed = setInterval(() => {
            try {
              if (popup.closed) {
                clearInterval(checkClosed);
                setConnecting(null);
                loadIntegrations(); // Reload to show new connection
              }
            } catch (e) {
              // Cross-Origin-Opener-Policy error is expected when OAuth provider redirects
              // The OAuth callback will redirect to the main window with success/error params
              // which is handled by the useEffect hook, so we can ignore this error
            }
          }, 500);

          // Timeout after 5 minutes
          setTimeout(() => {
            try {
              if (!popup.closed) {
                popup.close();
              }
            } catch (e) {
              // Ignore COOP errors
            }
            clearInterval(checkClosed);
            setConnecting(null);
            setError('OAuth flow timed out. Please try again.');
          }, 5 * 60 * 1000);
        }
      } else {
        // Show API key modal (for WhatsApp, etc.)
        setSelectedIntegration(integration);
        setShowKeyModal(true);
      }
    } catch (err) {
      // Handle OAuth configuration errors gracefully
      const integration = INTEGRATIONS.find(i => i.id === service);
      if (err.response?.data?.error?.includes('not configured') || err.response?.data?.error?.includes('FACEBOOK_APP_ID')) {
        const serviceName = integration?.name || service;
        
        // For WhatsApp, fall back to API key modal if OAuth is not configured
        if (service === 'whatsapp') {
          setError(
            getEnvMessage({
              dev: 'WhatsApp OAuth (Meta) is not configured. Falling back to API key connection (Twilio).',
              prod: 'Connecting via API key...'
            })
          );
          setSelectedIntegration(integration);
          setShowKeyModal(true);
          setConnecting(null);
          return;
        }
        
        setError(
          getEnvMessage({
            dev: `${serviceName} OAuth is not configured. Please set ${serviceName.toUpperCase()}_CLIENT_ID and ${serviceName.toUpperCase()}_CLIENT_SECRET environment variables.`,
            prod: `${serviceName} integration is temporarily unavailable. Please contact support if this persists.`
          })
        );
      } else {
        logger.error('Failed to connect integration:', err);
        setError(sanitizeErrorMessage(err) || getEnvMessage({
          dev: `Failed to connect ${integration?.name || service}: ${err.message || 'Unknown error'}`,
          prod: `Failed to connect ${integration?.name || service}. Please try again.`
        }));
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleTest = async (service) => {
    try {
      setTesting(service);
      setError('');
      setSuccess('');

      const response = await api.post(`/api/integrations/${service}/test`);
      
      if (response.data.success) {
        const integration = INTEGRATIONS.find(i => i.id === service);
        const serviceName = integration?.name || service;
        setSuccess(getEnvMessage({
          dev: `${service} connection test successful`,
          prod: `${serviceName} connection test successful!`
        }));
      } else {
        const integration = INTEGRATIONS.find(i => i.id === service);
        const serviceName = integration?.name || service;
        setError(getEnvMessage({
          dev: response.data.error || `Connection test failed for ${service}`,
          prod: response.data.error?.includes('credentials') || response.data.error?.includes('authentication')
            ? `${serviceName} connection failed. Please reconnect the integration.`
            : `Connection test failed for ${serviceName}. Please try again.`
        }));
      }
      
      loadIntegrations(); // Reload to update test status
    } catch (err) {
      console.error('Failed to test integration:', err);
      const integration = INTEGRATIONS.find(i => i.id === service);
      const serviceName = integration?.name || service;
      const errorMsg = err.response?.data?.error || err.message;
      setError(getEnvMessage({
        dev: errorMsg || `Failed to test ${service}`,
        prod: errorMsg?.includes('credentials') || errorMsg?.includes('authentication')
          ? `${serviceName} connection failed. Please reconnect the integration.`
          : `Failed to test ${serviceName}. Please try again.`
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (service) => {
    const integration = INTEGRATIONS.find(i => i.id === service);
    const serviceName = integration?.name || service;
    const confirmMsg = getEnvMessage({
      dev: `Are you sure you want to disconnect ${service}?`,
      prod: `Are you sure you want to disconnect ${serviceName}?`
    });
    
    if (!confirm(confirmMsg)) {
      return;
    }

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

  const getIntegrationStatus = (service) => {
    return integrations.find(i => i.service === service);
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
  
  return (
    <PlanGate 
      requiredPlan="Professional"
      feature="custom_integrations"
      upgradeMessage="Connect EasyFlow with Slack, Gmail, Google Sheets, and more. Available on Professional and Enterprise plans."
      onPaywallClose={() => navigate(-1)}
    >
      <div className={styles.integrationsPage} data-theme={theme}>
        <header className={styles.header}>
          <h1 className={styles.title}>Integrations</h1>
          <p className={styles.subtitle}>Connect EasyFlow with your favorite tools</p>
        </header>
        
        {error && (
          <div 
            className={styles.alert} 
            style={{ 
              background: 'var(--color-error-50)', 
              color: 'var(--color-error-700)',
              borderColor: 'var(--color-error-200)'
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div 
            className={styles.alert} 
            style={{ 
              background: 'var(--color-success-50)', 
              color: 'var(--color-success-700)',
              borderColor: 'var(--color-success-200)'
            }}
          >
            {success}
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Loading integrations...</div>
        ) : (
          <div className={styles.integrationsGrid}>
            {INTEGRATIONS.map(integration => {
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
                      <h3 className={styles.cardTitle}>{integration.name}</h3>
                      <p className={styles.cardDescription}>{integration.description}</p>
                    </div>
                  </div>

                  <div className={styles.cardStatus}>
                    {isConnected ? (
                      <>
                        <div className={styles.statusBadge}>
                          <span 
                            className={styles.statusDot} 
                            style={{ 
                              background: isActive 
                                ? 'var(--color-success-600)' 
                                : 'var(--color-error-500)'
                            }}
                          ></span>
                          {isActive ? 'Connected' : 'Inactive'}
                        </div>
                        {testStatus && (
                          <div className={styles.testStatus}>
                            Test: {testStatus === 'success' ? '✅' : '❌'}
                          </div>
                        )}
                        {status.lastUsedAt && (
                          <div className={styles.lastUsed}>
                            Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.statusBadge}>
                        <span 
                          className={styles.statusDot} 
                          style={{ background: 'var(--text-muted)' }}
                        ></span>
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
        )}

        <div className={styles.infoSection}>
          <h3>How Integrations Work</h3>
          <ul>
            <li>Connect your accounts securely via OAuth (no passwords stored)</li>
            <li>Use integrations in workflows to send messages, read data, and collect feedback</li>
            <li>All credentials are encrypted and stored securely</li>
            <li>Test connections anytime to verify they're working</li>
          </ul>
        </div>

        <IntegrationKeyModal
          isOpen={showKeyModal}
          onClose={() => {
            setShowKeyModal(false);
            setSelectedIntegration(null);
          }}
          integration={selectedIntegration}
          onConnect={handleApiKeyConnect}
        />
      </div>
    </PlanGate>
  );
};

export default IntegrationsPage;
