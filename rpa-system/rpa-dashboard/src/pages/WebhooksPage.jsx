import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import styles from './WebhooksPage.module.css';

const WebhooksPage = () => {
 const { theme } = useTheme();
 const navigate = useNavigate();
 
 return (
 <PlanGate 
 requiredPlan="Professional"
 feature="webhook_management"
 upgradeMessage="Webhook Management allows you to receive real-time notifications and trigger automations from external services. Set up unlimited webhooks with Professional and Enterprise plans."
 onPaywallClose={() => {
 console.log('[WebhooksPage] Paywall dismissed, navigating back');
 navigate(-1);
 }}
 >
 <div className={`${styles.webhooksPage} ${theme === 'dark' ? styles.darkTheme : ''}`}>
 <header className={styles.header}>
 <h1 className={styles.title}>Webhook Management</h1>
 <p className={styles.subtitle}>Receive and manage real-time notifications</p>
 </header>
 
 <div className={styles.content}>
 <div className={styles.placeholder}>
 <h2>🔔 Webhook Builder Coming Soon</h2>
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
