import React from 'react';
import styles from './RealtimeStatusBanner.module.css';
import { useTheme } from '../../utils/ThemeContext';

/**
 * RealtimeStatusBanner - Shows user-facing realtime connection status
 *
 * Usage:
 *   <RealtimeStatusBanner status={realtimeStatus} />
 *
 * Status object shape:
 *   {
 *     status: 'connected' | 'degraded' | 'error' | 'disconnected',
 *     message: string | null,
 *     channels: { [channelKey]: { status, message, timestamp } }
 *   }
 */
export const RealtimeStatusBanner = ({ status }) => {
  const { theme } = useTheme();

  if (!status || status.status === 'connected') {
    return null; // Don't show banner when everything is working
  }

  const getBannerConfig = () => {
    switch (status.status) {
      case 'degraded':
        return {
          className: `${styles.banner} ${styles['banner--warning']} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`,
          icon: '⚠️',
          title: 'Degraded Mode',
          message: status.message || 'Real-time updates temporarily unavailable. Using backup sync every 30 seconds.',
          action: null,
        };

      case 'error':
        return {
          className: `${styles.banner} ${styles['banner--error']} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`,
          icon: '❌',
          title: 'Real-time Updates Unavailable',
          message: status.message || 'Unable to establish real-time connection. Please contact support.',
          action: {
            label: 'Contact Support',
            onClick: () => window.open('/support', '_blank'),
          },
        };

      case 'disconnected':
        return {
          className: `${styles.banner} ${styles['banner--info']} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`,
          icon: '🔌',
          title: 'Reconnecting...',
          message: 'Attempting to restore real-time connection.',
          action: null,
        };

      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  // Compose elements using CSS module class names for predictable styling
  return (
    <div className={config.className} role="alert" aria-live="polite">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          {config.icon}
        </span>
        <div className={styles.text}>
          <div className={styles.title}>{config.title}</div>
          <div className={styles.message}>{config.message}</div>
        </div>
      </div>
      {config.action && (
        <button className={styles.action} onClick={config.action.onClick}>
          {config.action.label}
        </button>
      )}
    </div>
  );
};

export default RealtimeStatusBanner;
