import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { api } from '../utils/api';
import logger from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';
import PlanGate from '../components/PlanGate/PlanGate';
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
    id: 'google_meet',
    name: 'Google Meet',
    description: 'Transcribe recordings, process meetings',
    icon: '🎥',
    color: '#00832D',
    oauthSupported: true
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send messages via WhatsApp Business API',
    icon: '💬',
    color: '#25D366',
    oauthSupported: false // Uses API keys
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

  useEffect(() => {
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
        const response = await api.get(`/api/integrations/${service}/oauth/start`, {
          params: {
            redirect_uri: `${window.location.origin}/app/integrations`
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

          // Poll for popup close (OAuth complete)
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              setConnecting(null);
              loadIntegrations(); // Reload to show new connection
            }
          }, 500);

          // Timeout after 5 minutes
          setTimeout(() => {
            if (!popup.closed) {
              popup.close();
              clearInterval(checkClosed);
              setConnecting(null);
              setError('OAuth flow timed out. Please try again.');
            }
          }, 5 * 60 * 1000);
        }
      } else {
        // Manual API key entry (for WhatsApp, etc.)
        const apiKey = prompt(`Enter your ${integration.name} API key:`);
        if (apiKey) {
          await api.post(`/api/integrations/${service}/connect`, {
            credentials: { apiKey },
            displayName: `${integration.name} Integration`
          });
          setSuccess(`${integration.name} connected successfully`);
          loadIntegrations();
        }
      }
    } catch (err) {
      console.error('Failed to connect integration:', err);
      setError(err.response?.data?.error || `Failed to connect ${service}`);
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
        setSuccess(`${service} connection test successful`);
      } else {
        setError(response.data.error || 'Connection test failed');
      }
      
      loadIntegrations(); // Reload to update test status
    } catch (err) {
      console.error('Failed to test integration:', err);
      setError(err.response?.data?.error || `Failed to test ${service}`);
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (service) => {
    if (!confirm(`Are you sure you want to disconnect ${service}?`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      await api.delete(`/api/integrations/${service}`);
      setSuccess(`${service} disconnected successfully`);
      loadIntegrations();
    } catch (err) {
      console.error('Failed to disconnect integration:', err);
      setError(err.response?.data?.error || `Failed to disconnect ${service}`);
    }
  };

  const getIntegrationStatus = (service) => {
    return integrations.find(i => i.service === service);
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
      </div>
    </PlanGate>
  );
};

export default IntegrationsPage;
