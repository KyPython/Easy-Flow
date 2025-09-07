// Real-time Notification Service for EasyFlow
// Handles Firebase Cloud Messaging and Real-time Database notifications

import { 
  messaging, 
  database, 
  auth,
  isFirebaseConfigured,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES 
} from './firebaseConfig';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, push, set, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { supabase } from './supabaseClient';

class NotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.currentUser = null;
    this.listeners = new Map();
    this.unsubscribers = new Map();
    this.fcmToken = null;
    this.userPreferences = null;
    this.isInitializing = false;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.firebaseAuthUser = null;
    this.authStateListener = null;
    this.tokenRefreshTimeout = null;
    this.lastTokenRefresh = null;
    
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

    // Return existing promise if initialization is already in progress
    if (this.initializationPromise) {
      console.log('🔔 Returning existing initialization promise...');
      return await this.initializationPromise;
    }

    // Check if already initialized for this user
    if (this.isInitialized && this.currentUser?.id === user?.id) {
      console.log('🔔 Notifications already initialized for user:', user.id);
      return true;
    }

    // If switching users, cleanup first
    if (this.isInitialized && this.currentUser?.id !== user?.id) {
      console.log('🔔 Switching users, cleaning up previous initialization');
      this.cleanup();
    }

    // Create initialization promise to prevent multiple concurrent calls
    this.initializationPromise = this._performInitialization(user);
    
    try {
      const result = await this.initializationPromise;
      return result;
    } finally {
      this.initializationPromise = null;
    }
  }

  // Ensure Firebase authentication is ready
  async _ensureFirebaseAuth(user) {
    if (!auth) {
      console.warn('🔔 Firebase auth not available');
      return false;
    }

    try {
      // Get Supabase session to create Firebase custom token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('🔔 No Supabase session found');
        return false;
      }

      // Wait for Firebase auth state to be ready
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Firebase auth timeout'));
        }, 10000); // 10 second timeout

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          clearTimeout(timeout);
          unsubscribe();
          
          if (firebaseUser) {
            console.log('🔔 Firebase user authenticated:', firebaseUser.uid);
            this.firebaseAuthUser = firebaseUser;
            resolve(true);
          } else {
            // Try to authenticate with Supabase session
            this._authenticateWithSupabase(session, user)
              .then(resolve)
              .catch(reject);
          }
        });
      });
      
    } catch (error) {
      console.error('🔔 Firebase auth setup failed:', error);
      return false;
    }
  }

  // Authenticate Firebase using Supabase session
  async _authenticateWithSupabase(session, user) {
    try {
      console.log('🔔 Requesting Firebase custom token for user:', user.id);
      
      // Request custom token from backend
      const response = await fetch('/api/firebase/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          additionalClaims: {
            email: user.email,
            role: user.role || 'user'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get Firebase token: ${response.status} - ${errorData.details || errorData.error || 'Unknown error'}`);
      }

      const tokenData = await response.json();
      
      if (!tokenData.success || !tokenData.token) {
        throw new Error('Invalid token response from server');
      }

      console.log('🔔 Received Firebase custom token, signing in...');
      
      // Sign in to Firebase with custom token
      const userCredential = await signInWithCustomToken(auth, tokenData.token);
      const firebaseUser = userCredential.user;
      
      console.log('🔔 Successfully authenticated with Firebase:', firebaseUser.uid);
      this.firebaseAuthUser = firebaseUser;
      
      // Set up token refresh for custom tokens (they expire in 1 hour)
      this.scheduleTokenRefresh(user);
      
      return true;
      
    } catch (error) {
      console.error('🔔 Firebase authentication with custom token failed:', error);
      
      // Fallback to application-level authentication
      console.log('🔔 Falling back to application-level authentication');
      this.firebaseAuthUser = { uid: user.id };
      
      // Still return true to allow initialization to continue with limited functionality
      return true;
    }
  }

  // Schedule token refresh for Firebase custom tokens
  scheduleTokenRefresh(user) {
    // Clear existing timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }

    // Custom tokens expire in 1 hour, refresh after 50 minutes
    const refreshInterval = 50 * 60 * 1000; // 50 minutes
    
    this.tokenRefreshTimeout = setTimeout(async () => {
      try {
        console.log('🔔 Refreshing Firebase token for user:', user.id);
        await this.refreshFirebaseToken(user);
      } catch (error) {
        console.error('🔔 Failed to refresh Firebase token:', error);
        // Try again in 5 minutes
        setTimeout(() => this.scheduleTokenRefresh(user), 5 * 60 * 1000);
      }
    }, refreshInterval);

    console.log('🔔 Token refresh scheduled for', new Date(Date.now() + refreshInterval).toISOString());
  }

  // Refresh Firebase authentication token
  async refreshFirebaseToken(user) {
    if (!user || !this.isInitialized) {
      console.warn('🔔 Cannot refresh token: user not available or service not initialized');
      return false;
    }

    try {
      // Get current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('🔔 No Supabase session found during token refresh');
        return false;
      }

      // Get new custom token
      const success = await this._authenticateWithSupabase(session, user);
      
      if (success) {
        this.lastTokenRefresh = new Date().toISOString();
        console.log('🔔 Firebase token refreshed successfully');
        
        // Emit refresh event for any listeners
        this.dispatchEvent('token_refreshed', {
          userId: user.id,
          timestamp: this.lastTokenRefresh
        });
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('🔔 Token refresh failed:', error);
      
      // Emit error event
      this.dispatchEvent('token_refresh_error', {
        userId: user.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }

  // Enhanced error handling for Firebase operations
  handleFirebaseError(error, operation = 'unknown') {
    const errorInfo = {
      operation,
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };

    console.error(`🔔 Firebase error during ${operation}:`, errorInfo);

    // Handle specific error types
    switch (error.code) {
      case 'auth/id-token-expired':
      case 'auth/token-expired':
        console.log('🔔 Token expired, attempting refresh...');
        if (this.currentUser) {
          this.refreshFirebaseToken(this.currentUser);
        }
        break;
        
      case 'auth/network-request-failed':
        console.log('🔔 Network error, will retry...');
        // Emit network error event for UI feedback
        this.dispatchEvent('network_error', errorInfo);
        break;
        
      case 'auth/too-many-requests':
        console.log('🔔 Rate limited, backing off...');
        // Implement exponential backoff
        this.dispatchEvent('rate_limit_error', errorInfo);
        break;
        
      case 'permission-denied':
        console.log('🔔 Permission denied, may need to refresh token...');
        if (this.currentUser) {
          // Wait a bit before retrying to avoid spam
          setTimeout(() => this.refreshFirebaseToken(this.currentUser), 2000);
        }
        break;
        
      default:
        // Unknown error, emit for potential handling by application
        this.dispatchEvent('firebase_error', errorInfo);
        break;
    }

    return errorInfo;
  }

  // Internal initialization method
  async _performInitialization(user) {
    this.isInitializing = true;
    this.currentUser = user;
    
    try {
      console.log('🔔 Starting initialization for user:', user?.id);
      
      // Ensure Firebase auth is ready before proceeding
      const authReady = await this._ensureFirebaseAuth(user);
      if (!authReady) {
        console.warn('🔔 Firebase authentication not ready, proceeding with limited functionality');
      }
      
      // Load user preferences first
      await this.loadUserPreferences();
      
      // Request notification permission
      await this.requestPermission();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Set up message listener
      this.setupMessageListener();
      
      // Set up real-time database listener (only if auth is ready)
      if (authReady) {
        this.setupRealtimeListener();
      } else {
        console.log('🔔 Skipping real-time listener setup due to auth issues');
      }
      
      this.isInitialized = true;
      console.log('🔔 NotificationService initialization completed for user:', user?.id);
      return true;
      
    } catch (error) {
      console.error('🔔 NotificationService initialization failed:', error);
      this.isInitialized = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // Load user notification preferences
  async loadUserPreferences() {
    if (!this.currentUser) return;

    // Skip loading if preferences already exist for this user
    if (this.userPreferences) {
      console.log('🔔 User preferences already loaded, skipping...');
      return;
    }

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

    // Return existing token if already obtained
    if (this.fcmToken) {
      console.log('🔔 FCM Token already exists, reusing...');
      return this.fcmToken;
    }

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
      // Check if token already exists for this user to avoid redundant updates
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', this.currentUser.id)
        .single();

      // Skip update if token hasn't changed
      if (existingProfile?.fcm_token === token) {
        console.log('🔔 FCM token unchanged, skipping backend update');
        return;
      }

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
        
        // Provide specific error guidance
        if (error.code === 'PGRST301') {
          console.error('🔔 Supabase authentication error. Check if user is properly logged in.');
        } else if (error.message?.includes('profiles')) {
          console.error('🔔 Profiles table error. Check if table exists and user has access.');
        }
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
      
      // Provide more specific error handling
      if (error.code === 'PERMISSION_DENIED') {
        console.error('🔔 Firebase permission denied. Check your Firebase Realtime Database security rules.');
        console.error('🔔 Ensure rules allow authenticated users to write to /notifications/{uid}');
      } else if (error.code === 'NETWORK_ERROR') {
        console.error('🔔 Network error connecting to Firebase. Check internet connection.');
      }
      
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
    
    // Clean up auth listener
    if (this.authStateListener) {
      this.authStateListener();
      this.authStateListener = null;
    }
    
    // Clear token refresh timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
      console.log('🔔 Cleared token refresh timeout');
    }
    
    // Reset state
    this.currentUser = null;
    this.fcmToken = null;
    this.userPreferences = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.firebaseAuthUser = null;
    this.lastTokenRefresh = null;
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