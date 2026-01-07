// Real-time Notification Service for EasyFlow

// Robust environment detection for both Vite and Webpack/CRA
let MODE = 'development';
if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.MODE === 'string') {
  MODE = import.meta.env.MODE;
} else if (typeof process !== 'undefined' && process.env && typeof process.env.NODE_ENV === 'string') {
  MODE = process.env.NODE_ENV;
}
const isDev = MODE !== 'production';
// Handles Firebase Cloud Messaging and Real-time Database notifications
// Use lazy initialization to avoid bundling firebase packages at startup
import { initFirebase, isFirebaseConfigured, isMessagingConfigured, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from './firebaseConfig';
import supabase, { initSupabase } from './supabaseClient';
import { buildApiUrl } from './config';
import { createLogger } from './logger';

const logger = createLogger('NotificationService');

class NotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.currentUser = null;
    this.listeners = new Map();
    this.unsubscribers = new Map();
    this.fcmToken = null;
    this.userPreferences = null;
  this.pushEnabled = false;
    this.isInitializing = false;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.firebaseAuthUser = null;
    this.authStateListener = null;
    this.tokenRefreshTimeout = null;
    this.lastTokenRefresh = null;
  this._loggedBackendFallbackOnce = false;
    
    if (isDev) {
      console.log('🔔 NotificationService initialized:', {
        isSupported: this.isSupported,
        firebaseConfigured: isFirebaseConfigured
      });
    }
  }

  // Check if notifications are supported
  checkSupport() {
    return (
  isFirebaseConfigured && isMessagingConfigured &&
      typeof window !== 'undefined' &&
  typeof Notification !== 'undefined' && 'Notification' in window &&
      'serviceWorker' in navigator
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
      if (isDev) {
        console.log('🔔 Returning existing initialization promise...');
      }
      return await this.initializationPromise;
    }

    // Check if already initialized for this user
    if (this.isInitialized && this.currentUser?.id === user?.id) {
      if (isDev) {
        console.log('🔔 Notifications already initialized for user:', user.id);
      }
      return true;
    }

    // If switching users, cleanup first
    if (this.isInitialized && this.currentUser?.id !== user?.id) {
      if (isDev) {
        console.log('🔔 Switching users, cleaning up previous initialization');
      }
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
    // Ensure Firebase initialized (lazy)
    const { auth } = await initFirebase();
    if (!auth) {
      console.warn('🔔 Firebase auth not available (not configured)');
      return false;
    }

    try {
      // Get Supabase session to create Firebase custom token
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session) {
        console.warn('🔔 No Supabase session found');
        return false;
      }

      // Wait for Firebase auth state to be ready
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Firebase auth timeout'));
        }, 10000); // 10 second timeout

        const firebaseAuth = await import('firebase/auth');
        const { onAuthStateChanged } = firebaseAuth;

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          clearTimeout(timeout);
          unsubscribe();
          
          if (firebaseUser) {
            if (isDev) {
              console.log('🔔 Firebase user authenticated:', firebaseUser.uid);
            }
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
  if (isDev) {
        console.log('🔔 Requesting Firebase custom token for user:', user.id);
      }
      
      // Request custom token from backend
      const tokenUrl = buildApiUrl('/api/firebase/token');
      
      if (isDev) {
        console.log('🔔 Making request to:', tokenUrl);
      }
      const { api } = require('./api');
      const { data: tokenData } = await api.post(tokenUrl, {
        additionalClaims: {
          email: user.email,
          role: user.role || 'user'
        }
      }, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (!tokenData || !tokenData.success || !tokenData.token) {
        throw new Error('Invalid token response from server');
      }
      
      if (!tokenData.success || !tokenData.token) {
        throw new Error('Invalid token response from server');
      }

      if (isDev) {
        console.log('🔔 Received Firebase custom token, signing in...');
      }
      
      // Sign in to Firebase with custom token
      const firebaseAuth = await import('firebase/auth');
      const { signInWithCustomToken } = firebaseAuth;
      const { auth } = await initFirebase();
      const userCredential = await signInWithCustomToken(auth, tokenData.token);
      const firebaseUser = userCredential.user;
      
      if (isDev) {
        console.log('🔔 Successfully authenticated with Firebase:', firebaseUser.uid);
      }
      this.firebaseAuthUser = firebaseUser;
      
      // Set up token refresh for custom tokens (they expire in 1 hour)
      this.scheduleTokenRefresh(user);
      
      return true;
      
    } catch (error) {
      // ✅ CRITICAL: Enhanced error logging for Firebase authentication failures
      // This is often the root cause of the authentication cascade
      const errorCode = error?.code || error?.errorInfo?.code || 'UNKNOWN';
      const is401 = errorCode.includes('401') || errorCode.includes('auth/') || error.message?.includes('401');
      
      logger.error('\n🔥🔥🔥 FIREBASE AUTHENTICATION FAILURE 🔥🔥🔥', {
        message: error.message,
        code: errorCode,
        userId: user.id,
        email: user.email,
        cascade_impact: 'This failure will cascade: FCM -> Supabase -> Polling fallback',
        likely_cause: is401 
          ? 'Project ID mismatch between backend and frontend Firebase configs'
          : 'Invalid credentials or configuration',
        fix: is401
          ? 'Ensure FIREBASE_PROJECT_ID in backend .env matches REACT_APP_FIREBASE_PROJECT_ID in frontend .env.local'
          : 'Verify Firebase credentials are valid and belong to the same project',
        stack: isDev ? error.stack : undefined
      });
      
      // Check for specific error codes that indicate configuration issues
      if (error?.code === 'auth/request-had-invalid-authentication-credentials' || is401) {
        logger.error('🔔 Firebase token validation failed - LIKELY CAUSE: Project ID mismatch');
        logger.error('🔔 Backend and frontend must use the same Firebase project ID');
        logger.error('🔔 Check: FIREBASE_PROJECT_ID in backend .env matches REACT_APP_FIREBASE_PROJECT_ID in frontend .env.local');
      } else if (error?.code === 'auth/invalid-custom-token') {
        logger.error('🔔 Invalid custom token format - check backend token generation logic');
      } else if (error?.code === 'auth/custom-token-mismatch') {
        logger.error('🔔 Token project mismatch - ensure Firebase project IDs match between frontend and backend');
      }
      
      // In development, log additional diagnostic info
      if (isDev) {
        try {
          const { initFirebase } = require('./firebaseConfig');
          const frontendConfig = require('./firebaseConfig');
          logger.error('🔍 Diagnostic Info:', {
            frontend_project_id: frontendConfig.firebaseConfig?.projectId || '(not loaded)',
            backend_project_id: 'Check backend .env FIREBASE_PROJECT_ID',
            note: 'Backend and frontend MUST use the same Firebase project ID'
          });
        } catch (configError) {
          // Ignore if firebaseConfig can't be loaded
        }
      }
      
      // Don't fallback silently - return false to indicate failure
      // This prevents the cascade by stopping Firebase initialization
      return false;
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
        if (isDev) {
          console.log('🔔 Refreshing Firebase token for user:', user.id);
        }
        await this.refreshFirebaseToken(user);
      } catch (error) {
        console.error('🔔 Failed to refresh Firebase token:', error);
        // Try again in 5 minutes
        setTimeout(() => this.scheduleTokenRefresh(user), 5 * 60 * 1000);
      }
    }, refreshInterval);

    if (isDev) {
      console.log('🔔 Token refresh scheduled for', new Date(Date.now() + refreshInterval).toISOString());
    }
  }

  // Refresh Firebase authentication token
  async refreshFirebaseToken(user) {
    if (!user || !this.isInitialized) {
      console.warn('🔔 Cannot refresh token: user not available or service not initialized');
      return false;
    }

    try {
      // Get current Supabase session
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session) {
        console.warn('🔔 No Supabase session found during token refresh');
        return false;
      }

      // Get new custom token
      const success = await this._authenticateWithSupabase(session, user);
      
      if (success) {
        this.lastTokenRefresh = new Date().toISOString();
        if (isDev) {
          console.log('🔔 Firebase token refreshed successfully');
        }
        
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
        if (isDev) {
          console.log('🔔 Token expired, attempting refresh...');
        }
        if (this.currentUser) {
          this.refreshFirebaseToken(this.currentUser);
        }
        break;
        
      case 'auth/network-request-failed':
        if (isDev) {
          console.log('🔔 Network error, will retry...');
        }
        // Emit network error event for UI feedback
        this.dispatchEvent('network_error', errorInfo);
        break;
        
      case 'auth/too-many-requests':
        if (isDev) {
          console.log('🔔 Rate limited, backing off...');
        }
        // Implement exponential backoff
        this.dispatchEvent('rate_limit_error', errorInfo);
        break;
        
      case 'permission-denied':
        if (isDev) {
          console.log('🔔 Permission denied, may need to refresh token...');
        }
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
      if (isDev) {
        console.log('🔔 Starting initialization for user:', user?.id);
      }
      
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
        if (isDev) {
          console.log('🔔 Skipping real-time listener setup due to auth issues');
        }
      }
      
      this.isInitialized = true;
      if (isDev) {
        console.log('🔔 NotificationService initialization completed for user:', user?.id);
      }
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
      if (isDev) {
        console.log('🔔 User preferences already loaded, skipping...');
      }
      return;
    }

    try {
      const { api } = require('./api');
      const { data: prefs } = await api.get(buildApiUrl('/api/user/notifications'));
      if (prefs) {
        this.userPreferences = prefs;
        this.pushEnabled = !!this.userPreferences?.preferences?.push_notifications;
        if (isDev) {
          console.log('🔔 User preferences loaded:', this.userPreferences);
        }
      } else {
        console.warn('🔔 Failed to load user preferences, using defaults');
        this.userPreferences = this.getDefaultPreferences();
        this.pushEnabled = !!this.userPreferences?.preferences?.push_notifications;
      }
    } catch (error) {
      console.error('🔔 Error loading user preferences:', error);
      this.userPreferences = this.getDefaultPreferences();
      this.pushEnabled = !!this.userPreferences?.preferences?.push_notifications;
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

  // Helper: get merged preferences with overrides
  _mergePreferences(overrides = {}) {
    const base = (this.userPreferences && this.userPreferences.preferences)
      ? { ...this.userPreferences.preferences }
      : { ...this.getDefaultPreferences().preferences };
    return { ...base, ...overrides };
  }

  // Enable push notifications in-app (persist preference and token)
  async enablePush() {
    if (!this.currentUser) return false;
    // Ensure permission
    const permitted = await this.requestPermission();
    if (!permitted) return false;
    // Ensure token
    const token = await this.getFCMToken();
    if (!token) return false;

    // Persist via backend API
    try {
      const merged = this._mergePreferences({ push_notifications: true });
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      const { api } = require('./api');
      await api.put(buildApiUrl('/api/user/notifications'), {
        preferences: merged,
        fcm_token: token,
        phone_number: this.userPreferences?.phone_number || null
      }, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      // Update local state
      if (!this.userPreferences) this.userPreferences = this.getDefaultPreferences();
      this.userPreferences.preferences = merged;
      this.userPreferences.fcm_token = token;
      this.userPreferences.can_receive_push = true;
      this.pushEnabled = true;
      this.dispatchEvent('preferences_updated', { preferences: this.userPreferences });
      return true;
    } catch (e) {
      console.error('🔔 Failed to persist push enable:', e);
      return false;
    }
  }

  // Disable push notifications in-app (persist preference and revoke token)
  async disablePush() {
    if (!this.currentUser) return false;
    try {
      // Best-effort revoke token locally
      try {
        const { messaging } = await initFirebase();
        if (messaging) {
          const firebaseMessaging = await import('firebase/messaging');
          const { deleteToken } = firebaseMessaging;
          await deleteToken(messaging).catch(() => {});
          this.fcmToken = null;
        }
      } catch (revokeErr) {
        console.warn('🔔 Failed to delete FCM token (continuing):', revokeErr?.message || revokeErr);
      }
      const { api } = require('./api');
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      const merged = this._mergePreferences({ push_notifications: false });
      await api.put(buildApiUrl('/api/user/notifications'), {
        preferences: merged,
        fcm_token: null,
        phone_number: this.userPreferences?.phone_number || null
      }, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });

      // Update local state
      if (!this.userPreferences) this.userPreferences = this.getDefaultPreferences();
      this.userPreferences.preferences = merged;
      this.userPreferences.fcm_token = null;
      this.userPreferences.can_receive_push = false;
      this.pushEnabled = false;
      this.dispatchEvent('preferences_updated', { preferences: this.userPreferences });
      return true;
    } catch (e) {
      console.error('🔔 Failed to persist push disable:', e);
      return false;
    }
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
    if (typeof window === 'undefined' || !('Notification' in window) || typeof Notification === 'undefined') {
      console.info('🔔 Notification API not available in this environment');
      return false;
    }
    let permission = Notification.permission;
    
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (e) {
        console.warn('🔔 Notification.requestPermission failed:', e?.message || e);
        return false;
      }
    }
    
    if (permission === 'granted') {
      if (isDev) {
        console.log('🔔 Notification permission granted');
      }
      return true;
    } else {
      console.warn('🔔 Notification permission denied');
      return false;
    }
  }

  // Get FCM token for push notifications
  async getFCMToken() {
    const { messaging } = await initFirebase();
    if (!messaging) return null;

    // Return existing token if already obtained
    if (this.fcmToken) {
      if (isDev) {
        console.log('🔔 FCM Token already exists, reusing...');
      }
      return this.fcmToken;
    }

    try {
      // Ensure the messaging SW is registered before requesting a token
      // Note: CRA serves public/* at the root, so this path is correct in dev/prod
      let swReg = null;
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
        if (isDev) {
          console.log('🔔 Messaging service worker ready');
        }
      } catch (swErr) {
        console.warn('🔔 Unable to register messaging service worker:', swErr?.message || swErr);
      }

      const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
      const vapidKey = runtimeEnv.REACT_APP_FIREBASE_VAPID_KEY || process.env.REACT_APP_FIREBASE_VAPID_KEY;

      if (!vapidKey || typeof vapidKey !== 'string' || vapidKey.length < 20) {
        console.error('🔔 Invalid or missing VAPID key for FCM. Check REACT_APP_FIREBASE_VAPID_KEY.');
        return null;
      }

      // Firebase messaging getToken accepts a base64 VAPID string or expects to convert; ensure conversion to Uint8Array when needed
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      if (isDev) {
        console.log('🔔 Using VAPID key length:', vapidKey.length, 'preview:', `${vapidKey.slice(0,8)}...${vapidKey.slice(-8)}`);
      }

      let token = null;
      try {
        const firebaseMessaging = await import('firebase/messaging');
        const { getToken } = firebaseMessaging;
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg || undefined
        });
      } catch (err) {
        console.warn('🔔 getToken failed, will try manual PushManager.subscribe fallback if appropriate:', err?.message || err);
        // If the error indicates InvalidAccessError for applicationServerKey, try manual subscribe with Uint8Array
        if (err && err.name === 'InvalidAccessError' && navigator.serviceWorker && navigator.serviceWorker.ready) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });
            // If subscription exists, use endpoint or convert to a token-like string for backend
            token = subscription.endpoint || JSON.stringify(subscription);
            console.log('🔔 Manual PushManager.subscribe succeeded');
          } catch (subErr) {
            console.error('🔔 Manual PushManager.subscribe also failed:', subErr);
          }
        }
      }
      
  this.fcmToken = token;
      if (isDev) {
        console.log('🔔 FCM Token obtained:', token ? 'Success' : 'Failed');
      }
      
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
      // Persist via backend preferences endpoint so server sees fcm_token
      const merged = this._mergePreferences({ push_notifications: true });
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      const { api } = require('./api');
      try {
        await api.put(buildApiUrl('/api/user/notifications'), {
          preferences: merged,
          fcm_token: token,
          phone_number: this.userPreferences?.phone_number || null
        }, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
        if (isDev) {
          console.log('🔔 FCM token saved via API');
        }
        if (!this.userPreferences) this.userPreferences = this.getDefaultPreferences();
        this.userPreferences.preferences = merged;
        this.userPreferences.fcm_token = token;
        this.userPreferences.can_receive_push = true;
        this.pushEnabled = true;
        this.dispatchEvent('preferences_updated', { preferences: this.userPreferences });
      } catch (err) {
        console.error('🔔 Error saving FCM token via API:', err);
      }
    } catch (error) {
      console.error('🔔 Error saving FCM token to backend:', error);
    }
  }

  // Set up listener for foreground messages
  setupMessageListener() {
    // Ensure messaging available
    (async () => {
      const { messaging } = await initFirebase();
      if (!messaging) return;
      const firebaseMessaging = await import('firebase/messaging');
      const { onMessage } = firebaseMessaging;

      onMessage(messaging, (payload) => {
      if (isDev) {
        console.log('🔔 Foreground message received:', payload);
      }
      
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
    })();
  }

  // Set up real-time database listener
  setupRealtimeListener() {
    (async () => {
      const { database } = await initFirebase();
      if (!database || !this.currentUser) return;

      const firebaseDatabase = await import('firebase/database');
      const { ref, query, orderByChild, limitToLast, onValue } = firebaseDatabase;

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

        if (isDev) {
          console.log('🔔 Real-time notifications updated:', notifications.length);
        }

        // Trigger event with all notifications
        this.triggerNotificationEvent({
          type: 'notifications_updated',
          notifications: notifications.reverse() // Most recent first
        });
      });

      this.unsubscribers.set('notifications', unsubscribe);
    })();
  }

  // Send notification to Firebase (to be picked up by backend)
  async sendNotification(userId, notification) {
    const { database, auth } = await initFirebase();
    if (!database) {
      console.warn('🔔 Database not available');
      return false;
    }

    // Guard: require Firebase authenticated user to satisfy rules.
    if (!auth?.currentUser) {
      if (!this._loggedBackendFallbackOnce) {
        console.info('🔔 No Firebase auth user present; using backend fallback for notifications');
        this._loggedBackendFallbackOnce = true;
      }
      return await this._sendViaBackendFallback(userId, notification);
    }

    if (auth.currentUser.uid !== userId) {
      if (!this._loggedBackendFallbackOnce) {
        console.info('🔔 UID mismatch; using backend fallback for notifications');
        this._loggedBackendFallbackOnce = true;
      }
      return await this._sendViaBackendFallback(userId, notification);
    }

    // Check if this type of notification is enabled
    if (!this.isNotificationEnabled(notification.type)) {
      if (isDev) {
        console.log(`🔔 Notification type '${notification.type}' is disabled for user, skipping`);
      }
      return false;
    }

    try {
      const notificationData = {
        ...notification,
        timestamp: new Date().toISOString(),
        read: false,
        id: Date.now().toString()
      };

      const firebaseDatabase = await import('firebase/database');
      const { ref, push } = firebaseDatabase;
      const userNotificationsRef = ref(database, `notifications/${userId}`);
      await push(userNotificationsRef, notificationData);
      
      if (isDev) {
        console.log('🔔 Notification sent to Firebase:', notificationData);
      }
      return true;
    } catch (error) {
      console.error('🔔 Error sending notification:', error);
      
      // Provide more specific error handling
      if (error.code === 'PERMISSION_DENIED') {
        console.error('🔔 Firebase permission denied. Check your Firebase Realtime Database security rules.');
        console.error('🔔 Ensure rules allow authenticated users to write to /notifications/{uid}');
        console.warn('🔔 Falling back to server API notification creation');
        return await this._sendViaBackendFallback(userId, notification);
      } else if (error.code === 'NETWORK_ERROR') {
        console.error('🔔 Network error connecting to Firebase. Check internet connection.');
      }
      
      return false;
    }
  }

  // Backend fallback using privileged server endpoint
  // ⚠️ NOTE: This endpoint requires 'priority_support' feature (premium plans only)
  async _sendViaBackendFallback(userId, notification) {
    try {
      const client = await initSupabase();
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        console.warn('🔔 Cannot use backend fallback: no Supabase session');
        return false;
      }

      // ✅ SECURITY: Check plan before calling premium endpoint
      // The /api/notifications/create endpoint requires 'priority_support' feature
      // Check plan via API to avoid 403 errors for Starter plan users
      const { api } = require('./api');
      try {
        // Fetch user plan to check if they have priority_support feature
        const planResponse = await api.get(buildApiUrl('/api/plans/current'));
        const planData = planResponse?.data;
        
        // Check if user has priority_support feature
        const hasPrioritySupport = planData?.limits?.priority_support === true || 
                                   (typeof planData?.limits?.priority_support === 'string' && 
                                    planData.limits.priority_support.toLowerCase() !== 'no');
        
        if (!hasPrioritySupport) {
          if (isDev) {
            console.warn('🔔 Notification creation requires premium plan. User is on:', planData?.plan?.name || 'Unknown');
          }
          // Silently fail - don't show error to user, just don't create notification
          return false;
        }
      } catch (planError) {
        // If plan check fails, log but don't block (might be network issue)
        console.warn('🔔 Could not verify plan before notification creation:', planError?.message || planError);
        // Continue to attempt notification creation - backend will enforce plan check
      }

      await api.post(buildApiUrl('/api/notifications/create'), {
        type: notification.type || 'system_alert',
        title: notification.title || 'Notification',
        body: notification.body || 'You have a new notification',
        priority: notification.priority || 'normal',
        data: notification.data || {}
      }, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (isDev) {
        console.log('🔔 Notification stored via backend fallback');
      }
      return true;
    } catch (e) {
      // Handle 403 errors gracefully (plan restriction)
      if (e?.response?.status === 403) {
        if (isDev) {
          console.warn('🔔 Notification creation blocked: Premium plan required', e?.response?.data);
        }
        // Silently fail - don't show error to user
        return false;
      }
      console.error('🔔 Backend fallback error:', e);
      return false;
    }
  }

  // Show browser notification
  showBrowserNotification({ title, body, icon, data }) {
    // Hard guards for environments without the Notification API (iOS webviews, older browsers)
    if (typeof window === 'undefined' || typeof Notification === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') return;

    // Check if push notifications are enabled
    if (!this.isNotificationEnabled('push')) {
      if (isDev) {
        console.log('🔔 Push notifications are disabled, skipping browser notification');
      }
      return;
    }

    // Check specific notification type if provided
    if (data?.type && !this.isNotificationEnabled(data.type)) {
      if (isDev) {
        console.log(`🔔 Notification type '${data.type}' is disabled, skipping browser notification`);
      }
      return;
    }

    let notification;
    try {
      notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/badge-icon.png',
        tag: data?.type || 'general',
        requireInteraction: data?.priority === NOTIFICATION_PRIORITIES.CRITICAL,
        silent: data?.priority === NOTIFICATION_PRIORITIES.LOW
      });
    } catch (err) {
      // Some platforms expose Notification but don't allow constructing it
      console.warn('🔔 Unable to create Notification instance:', err?.message || err);
      return;
    }

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

  // Dispatch custom event (missing method that was causing the TypeError)
  dispatchEvent(eventName, eventData = {}) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => {
        try {
          callback({ type: eventName, ...eventData });
        } catch (error) {
          console.error(`🔔 Error in event listener for '${eventName}':`, error);
        }
      });
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
    const { database } = await initFirebase();
    if (!database || !this.currentUser) return false;

    try {
      const firebaseDatabase = await import('firebase/database');
      const { ref, set } = firebaseDatabase;
      const notificationRef = ref(database, `notifications/${this.currentUser.id}/${notificationId}`);
      await set(notificationRef, { read: true });
      if (isDev) {
        console.log('🔔 Notification marked as read:', notificationId);
      }
      return true;
    } catch (error) {
      console.error('🔔 Error marking notification as read:', error);
      return false;
    }
  }

  // Clear all notifications
  async clearAllNotifications() {
    const { database } = await initFirebase();
    if (!database || !this.currentUser) return false;

    try {
      const firebaseDatabase = await import('firebase/database');
      const { ref, set } = firebaseDatabase;
      const userNotificationsRef = ref(database, `notifications/${this.currentUser.id}`);
      await set(userNotificationsRef, null);
      if (isDev) {
        console.log('🔔 All notifications cleared');
      }
      return true;
    } catch (error) {
      console.error('🔔 Error clearing notifications:', error);
      return false;
    }
  }

  // Cleanup when user logs out
  cleanup() {
    if (isDev) {
      console.log('🔔 Cleaning up NotificationService');
    }
    
    // Remove all database listeners
    this.unsubscribers.forEach((unsubscribe, key) => {
      unsubscribe();
      if (isDev) {
        console.log(`🔔 Unsubscribed from ${key}`);
      }
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
      if (isDev) {
        console.log('🔔 Cleared token refresh timeout');
      }
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
      hasPermission: (typeof Notification !== 'undefined' && 'permission' in Notification)
        ? Notification.permission === 'granted'
        : false,
      currentUser: this.currentUser?.id || null,
  hasFCMToken: !!this.fcmToken,
  pushEnabled: !!this.pushEnabled
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