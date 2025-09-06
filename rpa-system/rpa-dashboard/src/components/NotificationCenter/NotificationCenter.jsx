// Notification Center Component for EasyFlow
// Displays notifications with real-time updates

import React, { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../utils/AuthContext';
import styles from './NotificationCenter.module.css';

const NotificationCenter = () => {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isInitialized,
    hasPermission,
    status,
    requestPermission,
    sendTestNotification,
    markAsRead,
    markAllAsRead,
    clearAll
  } = useNotifications(user);
  
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, read

  const toggleNotificationCenter = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Handle notification-specific actions
    if (notification.data?.url) {
      window.location.href = notification.data.url;
    }
  };

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  const handleSendTest = async () => {
    await sendTestNotification();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_completed': return '✅';
      case 'task_failed': return '❌';
      case 'task_started': return '🚀';
      case 'system_alert': return '⚠️';
      case 'email_sent': return '📧';
      case 'email_failed': return '📧❌';
      case 'welcome': return '🎉';
      default: return '🔔';
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'critical': return styles.critical;
      case 'high': return styles.high;
      case 'normal': return styles.normal;
      case 'low': return styles.low;
      default: return styles.normal;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread': return !notification.read;
      case 'read': return notification.read;
      default: return true;
    }
  });

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!status.isSupported) {
    return (
      <div className={styles.notificationCenter}>
        <button className={styles.bellButton} disabled title="Notifications not supported">
          🔔
          <span className={styles.disabledBadge}>×</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.notificationCenter}>
      {/* Notification Bell */}
      <button 
        className={styles.bellButton} 
        onClick={toggleNotificationCenter}
        title={`${unreadCount} unread notifications`}
      >
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className={styles.notificationPanel}>
          {/* Header */}
          <div className={styles.header}>
            <h3>Notifications</h3>
            <div className={styles.headerActions}>
              {!hasPermission && (
                <button 
                  className={styles.permissionButton}
                  onClick={handleRequestPermission}
                  title="Enable browser notifications"
                >
                  🔔 Enable
                </button>
              )}
              {process.env.NODE_ENV === 'development' && (
                <button 
                  className={styles.testButton}
                  onClick={handleSendTest}
                  title="Send test notification"
                >
                  🧪 Test
                </button>
              )}
              <button 
                className={styles.closeButton}
                onClick={toggleNotificationCenter}
              >
                ×
              </button>
            </div>
          </div>

          {/* Status Bar */}
          {!status.isConfigured && (
            <div className={styles.statusBar}>
              ⚠️ Firebase not configured. Real-time notifications disabled.
            </div>
          )}

          {!isInitialized && status.isConfigured && (
            <div className={styles.statusBar}>
              🔄 Initializing notifications...
            </div>
          )}

          {/* Filter Tabs */}
          <div className={styles.filterTabs}>
            <button 
              className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'unread' ? styles.active : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'read' ? styles.active : ''}`}
              onClick={() => setFilter('read')}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className={styles.actions}>
              {unreadCount > 0 && (
                <button 
                  className={styles.actionButton}
                  onClick={markAllAsRead}
                >
                  Mark all read
                </button>
              )}
              <button 
                className={styles.actionButton}
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className={styles.notificationsList}>
            {filteredNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                {filter === 'unread' ? (
                  <>
                    <div className={styles.emptyIcon}>✨</div>
                    <p>All caught up!</p>
                    <small>No unread notifications</small>
                  </>
                ) : filter === 'read' ? (
                  <>
                    <div className={styles.emptyIcon}>📭</div>
                    <p>No read notifications</p>
                  </>
                ) : (
                  <>
                    <div className={styles.emptyIcon}>🔔</div>
                    <p>No notifications yet</p>
                    <small>You'll see notifications here when they arrive</small>
                  </>
                )}
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`${styles.notificationItem} ${
                    !notification.read ? styles.unread : styles.read
                  } ${getPriorityClass(notification.priority)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationTitle}>
                      {notification.title}
                    </div>
                    <div className={styles.notificationBody}>
                      {notification.body}
                    </div>
                    <div className={styles.notificationMeta}>
                      <span className={styles.timestamp}>
                        {formatTimestamp(notification.timestamp)}
                      </span>
                      {!notification.read && (
                        <span className={styles.unreadDot}>●</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <small>
              {isInitialized ? (
                hasPermission ? 
                  '🟢 Real-time notifications enabled' : 
                  '🟡 Enable browser notifications for alerts'
              ) : (
                '🔴 Notifications service unavailable'
              )}
            </small>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div 
          className={styles.overlay} 
          onClick={toggleNotificationCenter}
        />
      )}
    </div>
  );
};

export default NotificationCenter;