import React from 'react';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import styles from './IntegrationsPage.module.css';

const IntegrationsPage = () => {
  const { theme } = useTheme();
  
  return (
    <PlanGate 
      feature="custom_integrations"
      upgradeMessage="Custom Integrations allow you to connect with any API or service. Build custom webhooks, API calls, and data synchronization. Available on Professional and Enterprise plans."
      onPaywallClose={() => window.location.href = '/app'}
    >
      <div className={`${styles.integrationsPage} ${theme === 'dark' ? styles.darkTheme : ''}`}>
        <header className={styles.header}>
          <h1 className={styles.title}>Custom Integrations</h1>
          <p className={styles.subtitle}>Connect EasyFlow with any service or API</p>
        </header>
        
        <div className={styles.content}>
          <div className={styles.placeholder}>
            <h3>🔗 Integration Builder Coming Soon</h3>
            <p>Create custom integrations with:</p>
            <ul>
              <li>REST API connections</li>
              <li>Webhook management</li>
              <li>Data transformation</li>
              <li>Authentication handling</li>
            </ul>
          </div>
        </div>
      </div>
    </PlanGate>
  );
};

export default IntegrationsPage;
