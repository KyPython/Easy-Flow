import React from 'react';
import './RealtimeStatusBanner.css';

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
  if (!status || status.status === 'connected') {
    return null; // Don't show banner when everything is working
  }

  const getBannerConfig = () => {
    switch (status.status) {
      case 'degraded':
        return {
          className: 'realtime-banner realtime-banner--warning',
          icon: '⚠️',
          title: 'Degraded Mode',
          message: status.message || 'Real-time updates temporarily unavailable. Using backup sync every 30 seconds.',
          action: null
        };

      case 'error':
        return {
          className: 'realtime-banner realtime-banner--error',
          icon: '❌',
          title: 'Real-time Updates Unavailable',
          message: status.message || 'Unable to establish real-time connection. Please contact support.',
          action: {
            label: 'Contact Support',
            onClick: () => window.open('/support', '_blank')
          }
        };

      case 'disconnected':
        return {
          className: 'realtime-banner realtime-banner--info',
          icon: '🔌',
          title: 'Reconnecting...',
          message: 'Attempting to restore real-time connection.',
          action: null
        };

      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <div className={config.className} role="alert">
      <div className="realtime-banner__content">
        <span className="realtime-banner__icon" aria-hidden="true">
          {config.icon}
        </span>
        <div className="realtime-banner__text">
          <div className="realtime-banner__title">{config.title}</div>
          <div className="realtime-banner__message">{config.message}</div>
        </div>
      </div>
      {config.action && (
        <button
          className="realtime-banner__action"
          onClick={config.action.onClick}
        >
          {config.action.label}
        </button>
      )}
    </div>
  );
};

export default RealtimeStatusBanner;
