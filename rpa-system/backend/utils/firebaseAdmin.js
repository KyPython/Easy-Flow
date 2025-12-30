
const { logger, getLogger } = require('./logger');
// Firebase Admin SDK for EasyFlow Backend
// Handles server-side Firebase operations for notifications

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  // If firebase-admin is not installed (common in lightweight dev setups),
  // provide a no-op shim so the app can start and feature flags / notifications
  // are simply disabled.
  logger.warn('⚠️ firebase-admin not available; Firebase notifications disabled for local dev');
  admin = null;
}
const path = require('path');

// Firebase Admin configuration
let firebaseApp = null;
let messaging = null;
let database = null;

// Helper to safely read environment variables (treat blank/whitespace/'null'/'undefined' as missing)
function getSanitizedEnv(name) {
  try {
    const raw = process.env[name];
    if (raw === undefined || raw === null) return undefined;
    const val = String(raw).trim();
    if (!val) return undefined;
    const lower = val.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === '""' || lower === "''") return undefined;
    return val;
  } catch {
    return undefined;
  }
}

const initializeFirebaseAdmin = () => {
  logger.info('🔍 [DEBUG] Firebase Admin initialization starting...');
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔍 Initializing Firebase Admin...');
  }
  
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔍 Firebase already initialized, returning existing instance');
      }
      return { app: firebaseApp, messaging, database };
    }

    // Configuration from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    
    // ✅ CRITICAL: Validate project ID matches frontend configuration
    // Frontend expects: easyflow-77db9 (from firebaseConfig.js)
    const EXPECTED_PROJECT_ID = 'easyflow-77db9';
    if (projectId && projectId !== EXPECTED_PROJECT_ID) {
      const errorMessage = `🔥 CRITICAL: Firebase Project ID mismatch!\n` +
        `Backend uses: '${projectId}'\n` +
        `Frontend expects: '${EXPECTED_PROJECT_ID}'\n` +
        `Impact: This will cause 401 authentication failures, FCM failures, and cascade to Supabase real-time instability\n` +
        `Fix: Set FIREBASE_PROJECT_ID=${EXPECTED_PROJECT_ID} in backend .env file`;
      
      logger.error(errorMessage, {
        backend_project_id: projectId,
        frontend_expected_project_id: EXPECTED_PROJECT_ID,
        error: 'Backend and frontend must use the same Firebase project',
        fix: `Set FIREBASE_PROJECT_ID=${EXPECTED_PROJECT_ID} in backend .env file`,
        cascade_impact: '401 auth failures → FCM failures → Supabase instability → Polling fallback'
      });
      
      // ✅ CRITICAL: In development, fail initialization to prevent cascade
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
        throw new Error(errorMessage);
      }
      // In production, log but continue (to avoid breaking production if config is temporarily wrong)
      // But this will cause authentication failures
    } else if (projectId === EXPECTED_PROJECT_ID) {
      logger.info('✅ Firebase Project ID matches frontend configuration', {
        project_id: projectId
      });
    }
    
    // Debug output for troubleshooting
    logger.info('🔍 [DEBUG] Firebase environment variables check:', {
      NODE_ENV: process.env.NODE_ENV,
      FIREBASE_PROJECT_ID: projectId ? `set (${projectId})` : 'missing',
      FIREBASE_CLIENT_EMAIL: clientEmail ? 'set' : 'missing',
      FIREBASE_PRIVATE_KEY: privateKey ? `set (${privateKey.length} chars)` : 'missing',
      FIREBASE_DATABASE_URL: databaseURL ? 'set' : 'missing',
      allRequiredSet: !!(projectId && clientEmail && privateKey),
      project_id_matches_frontend: projectId === EXPECTED_PROJECT_ID
    });

    // Check if service account key file exists
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                              path.join(__dirname, '../config/firebase-service-account.json');

    let credential;

    // Try to use service account file first, then environment variables
    try {
      if (!admin) throw new Error('firebase-admin not loaded');
      if (require('fs').existsSync(serviceAccountPath)) {
        credential = admin.credential.cert(serviceAccountPath);
        if (process.env.NODE_ENV === 'development') logger.info('🔥 Using Firebase service account file');
      } else {
        throw new Error('Service account file not found');
      }
    } catch (fileError) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔍 Firebase environment variables check:', {
          FIREBASE_PROJECT_ID: projectId ? 'set' : 'missing',
          FIREBASE_CLIENT_EMAIL: clientEmail ? 'set' : 'missing',
          FIREBASE_PRIVATE_KEY: privateKey ? `set (${privateKey.length} chars)` : 'missing',
          FIREBASE_DATABASE_URL: databaseURL ? 'set' : 'missing'
        });
      }
      
      if (projectId && clientEmail && privateKey) {
        try {
          credential = admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
          });
          if (process.env.NODE_ENV === 'development') logger.info('🔥 Using Firebase environment variables');
        } catch (credentialError) {
          logger.error('🔥 Failed to create Firebase credential:', credentialError.message);
          return { app: null, messaging: null, database: null };
        }
      } else {
        logger.warn('🔥 Firebase Admin not configured - notifications will be disabled');
        logger.warn('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_DATABASE_URL');
        return { app: null, messaging: null, database: null };
      }
    }

    if (!admin) {
      logger.warn('⚠️ firebase-admin is not installed; skipping initialization');
      return { app: null, messaging: null, database: null };
    }

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential,
      databaseURL: databaseURL || `https://${projectId}-default-rtdb.firebaseio.com/`,
      projectId
    });

    messaging = admin.messaging(firebaseApp);
    database = admin.database(firebaseApp);

    if (process.env.NODE_ENV === 'development') logger.info('🔥 Firebase Admin initialized successfully');
    return { app: firebaseApp, messaging, database };

  } catch (error) {
    logger.error('🔥 Firebase Admin initialization error:', error.message);
    return { app: null, messaging: null, database: null };
  }
};

// Firebase instances - will be initialized lazily
let firebaseAdminApp = null;
let firebaseMessaging = null;
let firebaseDatabase = null;
let hasLoggedSupabaseMissing = false;

function isSupabaseServerConfigured() {
  const url = getSanitizedEnv('SUPABASE_URL');
  const key = getSanitizedEnv('SUPABASE_SERVICE_ROLE') || getSanitizedEnv('SUPABASE_SERVICE_ROLE_KEY') || getSanitizedEnv('SUPABASE_KEY');
  return !!(url && key);
}

// Notification service class
class FirebaseNotificationService {
  constructor() {
    // Don't initialize Firebase here - use lazy initialization
    this.messaging = null;
    this.database = null;
    this.isConfigured = false;
  }

  // Ensure Firebase Admin is initialized lazily (call after dotenv has loaded)
  async ensureInitialized() {
    if (firebaseAdminApp && firebaseMessaging && firebaseDatabase) {
      // already initialized
      this.messaging = firebaseMessaging;
      this.database = firebaseDatabase;
      this.isConfigured = !!this.messaging && !!this.database;
      return;
    }

    const { app, messaging: msg, database: db } = initializeFirebaseAdmin() || {};
    firebaseAdminApp = app || null;
    firebaseMessaging = msg || null;
    firebaseDatabase = db || null;

    this.messaging = firebaseMessaging;
    this.database = firebaseDatabase;
    this.isConfigured = !!this.messaging && !!this.database;
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔍 [DEBUG] Firebase lazy initialization complete; configured=', this.isConfigured);
    }
  }

  // Send push notification to a specific user
  async sendNotificationToUser(userId, notification) {
    await this.ensureInitialized();
    if (!this.isConfigured) {
      logger.warn('🔥 Firebase not configured - notification not sent');
      return { success: false, error: 'Firebase not configured' };
    }

    try {
      // Get user's FCM token from Supabase
      const { createClient } = require('@supabase/supabase-js');
      const SUPABASE_URL = getSanitizedEnv('SUPABASE_URL');
      const supabaseKey = getSanitizedEnv('SUPABASE_SERVICE_ROLE') || getSanitizedEnv('SUPABASE_SERVICE_ROLE_KEY') || getSanitizedEnv('SUPABASE_KEY');
      if (!SUPABASE_URL || !supabaseKey) {
        logger.warn('🔥 Supabase not configured for notification lookups');
        return { success: false, error: 'Supabase not configured' };
      }
      let supabase;
      try {
        supabase = createClient(SUPABASE_URL, supabaseKey);
      } catch (e) {
        logger.warn('🔥 Supabase client creation failed for notifications:', e?.message || e);
        return { success: false, error: 'Supabase client init failed' };
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', userId)
        .single();

      if (error || !profile?.fcm_token) {
        logger.warn(`🔥 No FCM token found for user ${userId}`);
        return { success: false, error: 'No FCM token found' };
      }

      // Send push notification
      // Note: Firebase Cloud Messaging notification object only supports 'title' and 'body'
      // 'icon' is only valid in webpush.notification, not in the top-level notification object
      const message = {
        token: profile.fcm_token,
        notification: {
          title: notification.title,
          body: notification.body
          // icon is NOT supported in top-level notification object
        },
        data: {
          type: notification.type || 'general',
          priority: notification.priority || 'normal',
          timestamp: new Date().toISOString(),
          ...(notification.data || {})
        },
        webpush: {
          notification: {
            icon: notification.icon || '/favicon.ico',
            badge: '/badge-icon.png',
            requireInteraction: notification.priority === 'critical',
            silent: notification.priority === 'low',
            actions: notification.actions || []
          }
        }
      };

      const response = await this.messaging.send(message);
      if (process.env.NODE_ENV === 'development') logger.info(`🔥 Push notification sent to user ${userId}:`, response);

      return { success: true, messageId: response };

    } catch (error) {
      // Handle expected errors gracefully (user not registered for push notifications)
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        // This is expected - user hasn't registered for push notifications
        // Don't log as error, just return quietly
        return { success: false, error: error.message, expected: true };
      }
      
      // Log unexpected errors
      logger.error('🔥 Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple users
  async sendNotificationToUsers(userIds, notification) {
    await this.ensureInitialized();
    if (!this.isConfigured) {
      logger.warn('🔥 Firebase not configured - notifications not sent');
      return { success: false, error: 'Firebase not configured' };
    }

    const results = await Promise.allSettled(
      userIds.map(userId => this.sendNotificationToUser(userId, notification))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    if (process.env.NODE_ENV === 'development') logger.info(`🔥 Bulk notification results: ${successful} successful, ${failed} failed`);

    return {
      success: successful > 0,
      successful,
      failed,
      results
    };
  }

  // Optimized batch notification system
  async sendBatchNotifications(notifications) {
    await this.ensureInitialized();
    if (!this.isConfigured) {
      logger.warn('🔥 Firebase not configured - batch notifications not sent');
      return { success: false, error: 'Firebase not configured' };
    }

    // FCM allows up to 500 messages per batch
    const batches = this.chunkArray(notifications, 500);
    const results = [];

    for (const batch of batches) {
      try {
        const batchResult = await this.processBatch(batch);
        results.push(batchResult);
      } catch (error) {
        logger.error('🔥 Batch processing error:', error);
        results.push({ success: false, error: error.message, count: batch.length });
      }
    }

    return this.aggregateResults(results);
  }

  // Helper: Split array into chunks
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Helper: Process a batch of notifications
  async processBatch(batch) {
    const results = await Promise.allSettled(
      batch.map(({ userId, notification }) => 
        this.sendAndStoreNotification(userId, notification)
      )
    );

    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.push?.success
    ).length;
    const failed = results.length - successful;

    return {
      success: successful > 0,
      successful,
      failed,
      totalProcessed: batch.length
    };
  }

  // Helper: Aggregate batch results
  aggregateResults(results) {
    const totals = results.reduce((acc, result) => ({
      successful: acc.successful + (result.successful || 0),
      failed: acc.failed + (result.failed || 0),
      totalProcessed: acc.totalProcessed + (result.totalProcessed || 0)
    }), { successful: 0, failed: 0, totalProcessed: 0 });

    if (process.env.NODE_ENV === 'development') logger.info(`🔥 Batch notification summary: ${totals.successful} successful, ${totals.failed} failed, ${totals.totalProcessed} total`);

    return {
      success: totals.successful > 0,
      ...totals,
      results
    };
  }

  // Store notification in real-time database
  async storeNotification(userId, notification) {
    await this.ensureInitialized();
    if (!this.database) {
      logger.warn('🔥 Firebase database not configured');
      return { success: false, error: 'Database not configured' };
    }

    try {
      const notificationData = {
        ...notification,
        timestamp: new Date().toISOString(),
        read: false,
        id: Date.now().toString()
      };

      const ref = this.database.ref(`notifications/${userId}`);
      const newNotificationRef = await ref.push(notificationData);

      if (process.env.NODE_ENV === 'development') logger.info(`🔥 Notification stored for user ${userId}:`, newNotificationRef.key);

      // Clean up old notifications (keep only last 100)
      const snapshot = await ref.orderByChild('timestamp').once('value');
      const notifications = [];
      snapshot.forEach(child => {
        notifications.push({ key: child.key, ...child.val() });
      });

      if (notifications.length > 100) {
        const toDelete = notifications
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(100);

        await Promise.all(
          toDelete.map(notif => ref.child(notif.key).remove())
        );

        if (process.env.NODE_ENV === 'development') logger.info(`🔥 Cleaned up ${toDelete.length} old notifications for user ${userId}`);
      }

      return { success: true, notificationId: newNotificationRef.key };

    } catch (error) {
      logger.error('🔥 Error storing notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send both push notification and store in database
  async sendAndStoreNotification(userId, notification) {
    await this.ensureInitialized();
    const pushPromise = isSupabaseServerConfigured()
      ? this.sendNotificationToUser(userId, notification)
      : (async () => {
          if (!hasLoggedSupabaseMissing) {
            logger.warn('🔥 Supabase not configured for push lookups; skipping push send');
            hasLoggedSupabaseMissing = true;
          }
          return { success: false, error: 'supabase_not_configured' };
        })();

    const [pushResult, storeResult] = await Promise.allSettled([
      pushPromise,
      this.storeNotification(userId, notification)
    ]);

    const result = {
      push: pushResult.status === 'fulfilled' ? pushResult.value : { success: false, error: pushResult.reason?.message },
      store: storeResult.status === 'fulfilled' ? storeResult.value : { success: false, error: storeResult.reason?.message }
    };

    // Critical notification fallback
    if (!result.push.success && notification.priority === 'critical') {
      await this.handleCriticalNotificationFallback(userId, notification);
    }

    return result;
  }

  // Critical notification fallback system
  async handleCriticalNotificationFallback(userId, notification) {
    try {
      logger.warn(`🔥 Critical notification push failed for user ${userId}, attempting email fallback`);
      
      // Get user email from Supabase
      const { createClient } = require('@supabase/supabase-js');
      const SUPABASE_URL = getSanitizedEnv('SUPABASE_URL');
      const supabaseKey = getSanitizedEnv('SUPABASE_SERVICE_ROLE') || getSanitizedEnv('SUPABASE_SERVICE_ROLE_KEY') || getSanitizedEnv('SUPABASE_KEY');
      if (!SUPABASE_URL || !supabaseKey) {
        logger.warn('🔥 Supabase not configured for critical email fallback');
        return;
      }
      let supabase;
      try {
        supabase = createClient(SUPABASE_URL, supabaseKey);
      } catch (e) {
        logger.warn('🔥 Supabase client creation failed for critical fallback:', e?.message || e);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profile?.email) {
        // Add to email queue for critical notification
        await supabase
          .from('email_queue')
          .insert({
            profile_id: userId,
            email_type: 'critical_notification',
            email_data: {
              subject: `CRITICAL: ${notification.title}`,
              message: notification.body,
              notification_type: notification.type,
              original_priority: notification.priority,
              fallback_reason: 'push_notification_failed'
            },
            status: 'pending'
          });

        if (process.env.NODE_ENV === 'development') logger.info(`🔥 Critical notification added to email queue for user ${userId}`);
      }
    } catch (error) {
      logger.error('🔥 Critical notification fallback failed:', error);
    }
  }

  // Send system-wide notification
  async sendSystemNotification(notification, userIds = null) {
    if (!userIds) {
      // If no specific users, get all users with FCM tokens
      const { createClient } = require('@supabase/supabase-js');
      const SUPABASE_URL = getSanitizedEnv('SUPABASE_URL');
      const supabaseKey = getSanitizedEnv('SUPABASE_SERVICE_ROLE') || getSanitizedEnv('SUPABASE_SERVICE_ROLE_KEY') || getSanitizedEnv('SUPABASE_KEY');
      if (!SUPABASE_URL || !supabaseKey) {
        logger.warn('🔥 Supabase not configured for system notifications');
        return { success: false, error: 'Supabase not configured' };
      }
      let supabase;
      try {
        supabase = createClient(SUPABASE_URL, supabaseKey);
      } catch (e) {
        logger.warn('🔥 Supabase client creation failed for system notification:', e?.message || e);
        return { success: false, error: 'Supabase client init failed' };
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .not('fcm_token', 'is', null);

      userIds = profiles?.map(p => p.id) || [];
    }

    if (userIds.length === 0) {
      logger.warn('🔥 No users found for system notification');
      return { success: false, error: 'No users found' };
    }

    return await this.sendNotificationToUsers(userIds, {
      ...notification,
      type: 'system_alert',
      priority: notification.priority || 'high'
    });
  }

  // Get service status
  getStatus() {
    return {
      isConfigured: this.isConfigured,
      hasMessaging: !!this.messaging,
      hasDatabase: !!this.database,
      projectId: firebaseAdminApp?.options?.projectId || null,
      databaseURL: firebaseAdminApp?.options?.databaseURL || null,
      configurationMethod: this.getConfigurationMethod()
    };
  }

  // Get detailed health status
  async getHealthStatus() {
  await this.ensureInitialized();
  const status = this.getStatus();
    
    // Test Firebase connection
    let databaseHealth = false;
    let messagingHealth = false;

    try {
      if (this.database) {
        // Test database connection with a simple read
        await this.database.ref('.info/connected').once('value');
        databaseHealth = true;
      }
    } catch (error) {
      logger.warn('🔥 Firebase database health check failed:', error.message);
    }

    try {
      if (this.messaging) {
        // Test messaging service (this doesn't actually send)
        messagingHealth = true; // Messaging doesn't have a simple health check
      }
    } catch (error) {
      logger.warn('🔥 Firebase messaging health check failed:', error.message);
    }

    return {
      ...status,
      health: {
        database: databaseHealth,
        messaging: messagingHealth,
        overall: databaseHealth && messagingHealth
      },
      timestamp: new Date().toISOString()
    };
  }

  // Generate Firebase custom token for Supabase user
  async generateCustomToken(supabaseUserId, additionalClaims = {}) {
    await this.ensureInitialized();
    if (!firebaseAdminApp) {
      logger.warn('🔥 Firebase Admin not configured - cannot generate custom token');
      return { success: false, error: 'Firebase Admin not configured' };
    }

    // Validate uid format
    if (!supabaseUserId || typeof supabaseUserId !== 'string') {
      logger.error('🔥 Invalid user ID for Firebase token:', { userId: supabaseUserId, type: typeof supabaseUserId });
      return { success: false, error: 'Invalid user ID: must be a non-empty string', code: 'INVALID_UID' };
    }

    if (supabaseUserId.length === 0) {
      logger.error('🔥 Empty user ID for Firebase token');
      return { success: false, error: 'User ID cannot be empty', code: 'EMPTY_UID' };
    }

    if (supabaseUserId.length > 128) {
      logger.error('🔥 User ID too long for Firebase token:', { userId: supabaseUserId, length: supabaseUserId.length });
      return { success: false, error: 'User ID exceeds 128 character limit', code: 'UID_TOO_LONG' };
    }

    // Firebase UID must not contain certain reserved characters
    // Valid characters: letters, numbers, and these: -_@.
    const invalidChars = /[^a-zA-Z0-9\-_@.]/;
    if (invalidChars.test(supabaseUserId)) {
      logger.warn('🔥 User ID contains potentially invalid characters for Firebase:', { userId: supabaseUserId });
      // Don't fail, but log a warning - Firebase might still accept it
    }

    try {
      // Create custom claims that include Supabase user ID (do NOT include reserved fields like 'auth_time')
      const claims = {
        supabase_uid: supabaseUserId,
        provider: 'supabase',
        ...additionalClaims
      };

      // Generate custom token with Supabase user ID as the Firebase UID
      // This creates a consistent mapping between Supabase and Firebase users
      const customToken = await admin.auth(firebaseAdminApp).createCustomToken(supabaseUserId, claims);

      if (process.env.NODE_ENV === 'development') {
        logger.info(`🔥 Generated custom token for Supabase user: ${supabaseUserId}`, {
          tokenLength: customToken?.length || 0,
          hasClaims: !!claims
        });
      }

      return {
        success: true,
        token: customToken,
        expiresIn: 3600, // Custom tokens expire in 1 hour
        claims
      };

    } catch (error) {
      // ✅ CRITICAL: Enhanced error logging for 401 authentication failures
      const projectId = firebaseAdminApp?.options?.projectId || process.env.FIREBASE_PROJECT_ID;
      const EXPECTED_PROJECT_ID = 'easyflow-77db9';
      const projectMismatch = projectId && projectId !== EXPECTED_PROJECT_ID;
      
      logger.error('🔥 Error generating custom token:', {
        error: error.message,
        code: error.code,
        userId: supabaseUserId,
        userIdLength: supabaseUserId?.length || 0,
        firebaseInitialized: !!firebaseAdminApp,
        backend_project_id: projectId,
        frontend_expected_project_id: EXPECTED_PROJECT_ID,
        project_id_mismatch: projectMismatch,
        stack: error.stack
      });
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-uid') {
        errorMessage = 'Invalid user ID format for Firebase';
      } else if (error.code === 'app/invalid-credential') {
        errorMessage = projectMismatch 
          ? `Firebase Admin credentials belong to project '${projectId}' but frontend expects '${EXPECTED_PROJECT_ID}'. Update FIREBASE_PROJECT_ID in backend .env to match frontend configuration.`
          : 'Firebase Admin credentials are invalid or expired. Verify FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY belong to the correct Firebase project.';
      } else if (error.code === 'app/invalid-argument') {
        errorMessage = 'Invalid argument provided to Firebase Admin';
      } else if (projectMismatch) {
        // Add project mismatch warning even if error code doesn't indicate it
        errorMessage = `Project ID mismatch: Backend uses '${projectId}' but frontend expects '${EXPECTED_PROJECT_ID}'. This will cause 401 authentication failures.`;
      }
      
      return {
        success: false,
        error: errorMessage,
        code: error.code || 'TOKEN_GENERATION_FAILED',
        projectMismatch: projectMismatch || undefined
      };
    }
  }

  // Verify Firebase custom token (useful for testing)
  async verifyCustomToken(idToken) {
    await this.ensureInitialized();
    if (!firebaseAdminApp) {
      logger.warn('🔥 Firebase Admin not configured - cannot verify token');
      return { success: false, error: 'Firebase Admin not configured' };
    }

    try {
      const decodedToken = await admin.auth(firebaseAdminApp).verifyIdToken(idToken);

      return {
        success: true,
        uid: decodedToken.uid,
        supabase_uid: decodedToken.supabase_uid,
        claims: decodedToken,
        auth_time: decodedToken.auth_time,
        provider: decodedToken.provider
      };

    } catch (error) {
      logger.error('🔥 Error verifying token:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Create Firebase user record for Supabase user (if needed for advanced features)
  async createFirebaseUser(supabaseUserId, userProfile = {}) {
    await this.ensureInitialized();
    if (!firebaseAdminApp) {
      logger.warn('🔥 Firebase Admin not configured - cannot create user');
      return { success: false, error: 'Firebase Admin not configured' };
    }

    try {
      // Check if Firebase user already exists
      try {
        const existingUser = await admin.auth(firebaseAdminApp).getUser(supabaseUserId);
        if (process.env.NODE_ENV === 'development') logger.info(`🔥 Firebase user already exists: ${supabaseUserId}`);
        return {
          success: true,
          user: existingUser,
          created: false
        };
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
        // User doesn't exist, create it
      }

      // Create new Firebase user with Supabase ID as Firebase UID
      const userRecord = await admin.auth(firebaseAdminApp).createUser({
        uid: supabaseUserId,
        email: userProfile.email || null,
        displayName: userProfile.displayName || userProfile.email?.split('@')[0] || null,
        disabled: false,
        emailVerified: true // Trust Supabase email verification
      });

      if (process.env.NODE_ENV === 'development') logger.info(`🔥 Created Firebase user record: ${supabaseUserId}`);

      return {
        success: true,
        user: userRecord,
        created: true
      };

    } catch (error) {
      logger.error('🔥 Error creating Firebase user:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Set custom claims for a Firebase user (useful for role-based access)
  async setUserClaims(supabaseUserId, claims) {
    await this.ensureInitialized();
    if (!firebaseAdminApp) {
      logger.warn('🔥 Firebase Admin not configured - cannot set claims');
      return { success: false, error: 'Firebase Admin not configured' };
    }

    try {
      await admin.auth(firebaseAdminApp).setCustomUserClaims(supabaseUserId, {
        supabase_uid: supabaseUserId,
        ...claims
      });

      if (process.env.NODE_ENV === 'development') logger.info(`🔥 Set custom claims for user ${supabaseUserId}:`, claims);

      return { success: true, claims };

    } catch (error) {
      logger.error('🔥 Error setting user claims:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Determine configuration method
  getConfigurationMethod() {
    const fs = require('fs');
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                              path.join(__dirname, '../config/firebase-service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      return 'service_account_file';
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      return 'environment_variables';
    }
    return 'not_configured';
  }
}

// Create singleton instance
const firebaseNotificationService = new FirebaseNotificationService();

// ✅ OBSERVABILITY: Import environment-aware message utility
const { getUserErrorMessage, getTaskStatusMessage, getSystemAlertMessage, IS_DEVELOPMENT } = require('./environmentAwareMessages');

// Helper functions for common notification types
// ✅ ENVIRONMENT-AWARE: All messages adapt based on environment (dev shows more detail, prod shows user-friendly)
const NotificationTemplates = {
  taskCompleted: (taskName) => {
    const body = IS_DEVELOPMENT 
      ? `Your task "${taskName}" has completed successfully`
      : 'Task completed successfully';
    
    return {
      title: 'Task Completed ✅',
      body,
      type: 'task_completed',
      priority: 'normal',
      icon: '/icons/task-completed.png'
    };
  },

  taskFailed: (taskName, error) => {
    const errorMessage = getUserErrorMessage(error, { 
      context: 'notification.taskFailed',
      logError: true 
    });
    
    const body = IS_DEVELOPMENT
      ? `Your task "${taskName}" failed: ${errorMessage}`
      : `Task failed. ${errorMessage}`;
    
    return {
      title: 'Task Failed ❌',
      body,
      type: 'task_failed',
      priority: 'high',
      icon: '/icons/task-failed.png'
    };
  },

  taskStarted: (taskName) => {
    const body = IS_DEVELOPMENT
      ? `Your task "${taskName}" has started`
      : 'Task has started';
    
    return {
      title: 'Task Started 🚀',
      body,
      type: 'task_started',
      priority: 'low',
      icon: '/icons/task-started.png'
    };
  },

  emailSent: (emailType, recipient) => {
    const body = IS_DEVELOPMENT
      ? `${emailType} email sent to ${recipient}`
      : 'Email sent successfully';
    
    return {
      title: 'Email Sent 📧',
      body,
      type: 'email_sent',
      priority: 'low',
      icon: '/icons/email-sent.png'
    };
  },

  emailFailed: (emailType, recipient, error) => {
    const errorMessage = getUserErrorMessage(error, {
      context: 'notification.emailFailed',
      logError: true
    });
    
    const body = IS_DEVELOPMENT
      ? `Failed to send ${emailType} email to ${recipient}: ${errorMessage}`
      : `Failed to send email. ${errorMessage}`;
    
    return {
      title: 'Email Failed 📧❌',
      body,
      type: 'email_failed',
      priority: 'high',
      icon: '/icons/email-failed.png'
    };
  },

  welcome: (userName) => ({
    title: 'Welcome to EasyFlow! 🎉',
    body: `Hi ${userName}! Your account is ready. Start automating today.`,
    type: 'welcome',
    priority: 'normal',
    icon: '/icons/welcome.png'
  }),

  systemAlert: (message, severity = 'medium') => {
    const alert = getSystemAlertMessage(message, severity);
    return {
      title: 'System Alert ⚠️',
      body: alert.message,
      type: 'system_alert',
      priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'normal',
      icon: '/icons/system-alert.png'
    };
  }
};

module.exports = {
  firebaseNotificationService,
  NotificationTemplates,
  firebaseAdminApp,
  firebaseMessaging,
  firebaseDatabase
};