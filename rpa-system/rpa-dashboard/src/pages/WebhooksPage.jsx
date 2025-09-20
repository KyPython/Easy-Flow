import React from 'react';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import styles from './WebhooksPage.module.css';

const WebhooksPage = () => {
  const { theme } = useTheme();
  
  return (
    <PlanGate 
      feature="webhook_management"
      upgradeMessage="Webhook Management allows you to receive real-time notifications and trigger automations from external services. Set up unlimited webhooks with Professional and Enterprise plans."
      onPaywallClose={() => window.location.href = '/app'}
    >
      <div className={`${styles.webhooksPage} ${theme === 'dark' ? styles.darkTheme : ''}`}>
        <header className={styles.header}>
          <h1 className={styles.title}>Webhook Management</h1>
          <p className={styles.subtitle}>Receive and manage real-time notifications</p>
        </header>
        
        <div className={styles.content}>
          <div className={styles.placeholder}>
            <h3>🔔 Webhook Builder Coming Soon</h3>
            <p>Manage webhooks with:</p>
            <ul>
              <li>Unlimited webhook endpoints</li>
              <li>Custom payload handling</li>
              <li>Real-time triggers</li>
              <li>Authentication & security</li>
              <li>Retry logic & error handling</li>
            </ul>
          </div>
        </div>
      </div>
    </PlanGate>
  );
};

export default WebhooksPage;
