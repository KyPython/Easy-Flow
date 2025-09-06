// Real-time Notification Service for EasyFlow
// Handles Firebase Cloud Messaging and Real-time Database notifications

import { 
  messaging, 
  database, 
  isFirebaseConfigured,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES 
} from './firebaseConfig';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, push, set, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { supabase } from './supabaseClient';

class NotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.currentUser = null;
    this.listeners = new Map();
    this.unsubscribers = new Map();
    this.fcmToken = null;
    this.userPreferences = null;
    
    console.log('🔔 NotificationService initialized:', {
      isSupported: this.isSupported,
      firebaseConfigured: isFirebaseConfigured
    });
  }

  // Check if notifications are supported
  checkSupport() {
    return (
      isFirebaseConfigured &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      messaging !== null
    );
  }

  // Initialize the service for a specific user
  async initialize(user) {
    if (!this.isSupported) {
      console.warn('🔔 Notifications not supported or not configured');
      return false;
    }

    this.currentUser = user;
    
    try {
      // Load user preferences first
      await this.loadUserPreferences();
      
      // Request notification permission
      await this.requestPermission();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Set up message listener
      this.setupMessageListener();
      
      // Set up real-time database listener
      this.setupRealtimeListener();
      
      console.log('🔔 NotificationService initialized for user:', user?.id);
      return true;
      
    } catch (error) {
      console.error('🔔 NotificationService initialization failed:', error);
      return false;
    }
  }

  // Load user notification preferences
  async loadUserPreferences() {
    if (!this.currentUser) return;

    try {
      const response = await fetch('/api/user/notifications', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (response.ok) {
        this.userPreferences = await response.json();
        console.log('🔔 User preferences loaded:', this.userPreferences);
      } else {
        console.warn('🔔 Failed to load user preferences, using defaults');
        this.userPreferences = this.getDefaultPreferences();
      }
    } catch (error) {
      console.error('🔔 Error loading user preferences:', error);
      this.userPreferences = this.getDefaultPreferences();
    }
  }

  // Get default notification preferences
  getDefaultPreferences() {
    return {
      preferences: {
        email_notifications: true,
        weekly_reports: true,
        sms_alerts: false,
        push_notifications: true,
        task_completion: true,
        task_failures: true,
        system_alerts: true,
        marketing_emails: true,
        security_alerts: true
      },
      fcm_token: null,
      phone_number: null,
      can_receive_sms: false,
      can_receive_push: false
    };
  }

  // Check if a specific type of notification is enabled
  isNotificationEnabled(type) {
    if (!this.userPreferences) return true; // Default to enabled if preferences not loaded
    
    const prefs = this.userPreferences.preferences;
    
    // Map notification types to preference keys
    const typeMapping = {
      'task_completion': 'task_completion',
      'task_failure': 'task_failures',
      'task_error': 'task_failures',
      'system_alert': 'system_alerts',
      'security_alert': 'security_alerts',
      'email': 'email_notifications',
      'weekly_report': 'weekly_reports',
      'sms': 'sms_alerts',
      'push': 'push_notifications',
      'marketing': 'marketing_emails'
    };

    const prefKey = typeMapping[type] || type;
    return prefs[prefKey] !== false; // Default to true if not explicitly set to false
  }

  // Request notification permission from user
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    let permission = Notification.permission;
    
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission === 'granted') {
      console.log('🔔 Notification permission granted');
      return true;
    } else {
      console.warn('🔔 Notification permission denied');
      return false;
    }
  }

  // Get FCM token for push notifications
  async getFCMToken() {
    if (!messaging) return null;

    try {
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY
      });
      
      this.fcmToken = token;
      console.log('🔔 FCM Token obtained:', token ? 'Success' : 'Failed');
      
      // Save token to backend for sending notifications
      if (token && this.currentUser) {
        await this.saveFCMTokenToBackend(token);
      }
      
      return token;
    } catch (error) {
      console.error('🔔 Error getting FCM token:', error);
      return null;
    }
  }

  // Save FCM token to backend
  async saveFCMTokenToBackend(token) {
    try {
      // Update user profile with FCM token
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: this.currentUser.id,
          fcm_token: token,
          notification_preferences: {
            push_enabled: true,
            email_enabled: true,
            task_updates: true,
            system_alerts: true
          },
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('🔔 Error saving FCM token:', error);
      } else {
        console.log('🔔 FCM token saved successfully');
      }
    } catch (error) {
      console.error('🔔 Error saving FCM token to backend:', error);
    }
  }

  // Set up listener for foreground messages
  setupMessageListener() {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('🔔 Foreground message received:', payload);
      
      const { notification, data } = payload;
      
      // Show browser notification
      if (notification) {
        this.showBrowserNotification({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/favicon.ico',
          data: data
        });
      }
      
      // Trigger custom event for app components
      this.triggerNotificationEvent({
        type: data?.type || 'message',
        title: notification?.title,
        body: notification?.body,
        data: data,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Set up real-time database listener
  setupRealtimeListener() {
    if (!database || !this.currentUser) return;

    const userNotificationsRef = ref(database, `notifications/${this.currentUser.id}`);
    const recentQuery = query(userNotificationsRef, orderByChild('timestamp'), limitToLast(50));
    
    const unsubscribe = onValue(recentQuery, (snapshot) => {
      const notifications = [];
      snapshot.forEach((childSnapshot) => {
        notifications.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      console.log('🔔 Real-time notifications updated:', notifications.length);
      
      // Trigger event with all notifications
      this.triggerNotificationEvent({
        type: 'notifications_updated',
        notifications: notifications.reverse() // Most recent first
      });
    });
    
    this.unsubscribers.set('notifications', unsubscribe);
  }

  // Send notification to Firebase (to be picked up by backend)
  async sendNotification(userId, notification) {
    if (!database) {
      console.warn('🔔 Database not available');
      return false;
    }

    // Check if this type of notification is enabled
    if (!this.isNotificationEnabled(notification.type)) {
      console.log(`🔔 Notification type '${notification.type}' is disabled for user, skipping`);
      return false;
    }

    try {
      const notificationData = {
        ...notification,
        timestamp: new Date().toISOString(),
        read: false,
        id: Date.now().toString()
      };

      const userNotificationsRef = ref(database, `notifications/${userId}`);
      await push(userNotificationsRef, notificationData);
      
      console.log('🔔 Notification sent to Firebase:', notificationData);
      return true;
    } catch (error) {
      console.error('🔔 Error sending notification:', error);
      return false;
    }
  }

  // Show browser notification
  showBrowserNotification({ title, body, icon, data }) {
    if (Notification.permission !== 'granted') return;

    // Check if push notifications are enabled
    if (!this.isNotificationEnabled('push')) {
      console.log('🔔 Push notifications are disabled, skipping browser notification');
      return;
    }

    // Check specific notification type if provided
    if (data?.type && !this.isNotificationEnabled(data.type)) {
      console.log(`🔔 Notification type '${data.type}' is disabled, skipping browser notification`);
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/badge-icon.png',
      tag: data?.type || 'general',
      requireInteraction: data?.priority === NOTIFICATION_PRIORITIES.CRITICAL,
      silent: data?.priority === NOTIFICATION_PRIORITIES.LOW
    });

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      notification.close();
      
      // Trigger click event
      this.triggerNotificationEvent({
        type: 'notification_clicked',
        data: data
      });
    };

    // Auto-close after 5 seconds (unless critical)
    if (data?.priority !== NOTIFICATION_PRIORITIES.CRITICAL) {
      setTimeout(() => notification.close(), 5000);
    }
  }

  // Add event listener for notification events
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Remove event listener
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Trigger notification event
  triggerNotificationEvent(eventData) {
    const eventName = eventData.type || 'notification';
    
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error('🔔 Error in notification event listener:', error);
        }
      });
    }

    // Also trigger a general 'notification' event
    if (eventName !== 'notification' && this.listeners.has('notification')) {
      this.listeners.get('notification').forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error('🔔 Error in general notification listener:', error);
        }
      });
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    if (!database || !this.currentUser) return false;

    try {
      const notificationRef = ref(database, `notifications/${this.currentUser.id}/${notificationId}`);
      await set(notificationRef, { read: true });
      console.log('🔔 Notification marked as read:', notificationId);
      return true;
    } catch (error) {
      console.error('🔔 Error marking notification as read:', error);
      return false;
    }
  }

  // Clear all notifications
  async clearAllNotifications() {
    if (!database || !this.currentUser) return false;

    try {
      const userNotificationsRef = ref(database, `notifications/${this.currentUser.id}`);
      await set(userNotificationsRef, null);
      console.log('🔔 All notifications cleared');
      return true;
    } catch (error) {
      console.error('🔔 Error clearing notifications:', error);
      return false;
    }
  }

  // Cleanup when user logs out
  cleanup() {
    console.log('🔔 Cleaning up NotificationService');
    
    // Remove all database listeners
    this.unsubscribers.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log(`🔔 Unsubscribed from ${key}`);
    });
    this.unsubscribers.clear();
    
    // Clear event listeners
    this.listeners.clear();
    
    // Reset state
    this.currentUser = null;
    this.fcmToken = null;
  }

  // Get current notification status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isConfigured: isFirebaseConfigured,
      hasPermission: Notification.permission === 'granted',
      currentUser: this.currentUser?.id || null,
      hasFCMToken: !!this.fcmToken
    };
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Helper functions for common notification types
export const NotificationHelpers = {
  // Task completion notification
  taskCompleted: (taskName, userId) => ({
    type: NOTIFICATION_TYPES.TASK_COMPLETED,
    title: 'Task Completed',
    body: `Your task "${taskName}" has completed successfully`,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    userId
  }),

  // Task failure notification
  taskFailed: (taskName, error, userId) => ({
    type: NOTIFICATION_TYPES.TASK_FAILED,
    title: 'Task Failed',
    body: `Your task "${taskName}" failed: ${error}`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    userId
  }),

  // System alert notification
  systemAlert: (message, userId) => ({
    type: NOTIFICATION_TYPES.SYSTEM_ALERT,
    title: 'System Alert',
    body: message,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    userId
  }),

  // Welcome notification
  welcome: (userName, userId) => ({
    type: NOTIFICATION_TYPES.WELCOME,
    title: 'Welcome to EasyFlow!',
    body: `Hi ${userName}! Your account is ready. Start automating your workflows today.`,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    userId
  })
};

export default notificationService;
export { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES };