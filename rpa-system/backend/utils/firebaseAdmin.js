// Firebase Admin SDK for EasyFlow Backend
// Handles server-side Firebase operations for notifications

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin configuration
let firebaseApp = null;
let messaging = null;
let database = null;

const initializeFirebaseAdmin = () => {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      return { app: firebaseApp, messaging, database };
    }

    // Configuration from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const databaseURL = process.env.FIREBASE_DATABASE_URL;

    // Check if service account key file exists
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                              path.join(__dirname, '../config/firebase-service-account.json');

    let credential;

    // Try to use service account file first, then environment variables
    try {
      if (require('fs').existsSync(serviceAccountPath)) {
        credential = admin.credential.cert(serviceAccountPath);
        console.log('🔥 Using Firebase service account file');
      } else {
        throw new Error('Service account file not found');
      }
    } catch (fileError) {
      if (projectId && clientEmail && privateKey) {
        credential = admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        });
        console.log('🔥 Using Firebase environment variables');
      } else {
        console.warn('🔥 Firebase Admin not configured - notifications will be disabled');
        console.warn('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_DATABASE_URL');
        return { app: null, messaging: null, database: null };
      }
    }

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential,
      databaseURL: databaseURL || `https://${projectId}-default-rtdb.firebaseio.com/`,
      projectId
    });

    messaging = admin.messaging(firebaseApp);
    database = admin.database(firebaseApp);

    console.log('🔥 Firebase Admin initialized successfully');
    return { app: firebaseApp, messaging, database };

  } catch (error) {
    console.error('🔥 Firebase Admin initialization error:', error.message);
    return { app: null, messaging: null, database: null };
  }
};

// Initialize Firebase Admin
const { app: firebaseAdminApp, messaging: firebaseMessaging, database: firebaseDatabase } = initializeFirebaseAdmin();

// Notification service class
class FirebaseNotificationService {
  constructor() {
    this.messaging = firebaseMessaging;
    this.database = firebaseDatabase;
    this.isConfigured = !!firebaseMessaging && !!firebaseDatabase;
  }

  // Send push notification to a specific user
  async sendNotificationToUser(userId, notification) {
    if (!this.isConfigured) {
      console.warn('🔥 Firebase not configured - notification not sent');
      return { success: false, error: 'Firebase not configured' };
    }

    try {
      // Get user's FCM token from Supabase
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      );

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', userId)
        .single();

      if (error || !profile?.fcm_token) {
        console.warn(`🔥 No FCM token found for user ${userId}`);
        return { success: false, error: 'No FCM token found' };
      }

      // Send push notification
      const message = {
        token: profile.fcm_token,
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/favicon.ico'
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
      console.log(`🔥 Push notification sent to user ${userId}:`, response);

      return { success: true, messageId: response };

    } catch (error) {
      console.error('🔥 Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple users
  async sendNotificationToUsers(userIds, notification) {
    if (!this.isConfigured) {
      console.warn('🔥 Firebase not configured - notifications not sent');
      return { success: false, error: 'Firebase not configured' };
    }

    const results = await Promise.allSettled(
      userIds.map(userId => this.sendNotificationToUser(userId, notification))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`🔥 Bulk notification results: ${successful} successful, ${failed} failed`);

    return {
      success: successful > 0,
      successful,
      failed,
      results
    };
  }

  // Optimized batch notification system
  async sendBatchNotifications(notifications) {
    if (!this.isConfigured) {
      console.warn('🔥 Firebase not configured - batch notifications not sent');
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
        console.error('🔥 Batch processing error:', error);
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

    console.log(`🔥 Batch notification summary: ${totals.successful} successful, ${totals.failed} failed, ${totals.totalProcessed} total`);

    return {
      success: totals.successful > 0,
      ...totals,
      results
    };
  }

  // Store notification in real-time database
  async storeNotification(userId, notification) {
    if (!this.database) {
      console.warn('🔥 Firebase database not configured');
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

      console.log(`🔥 Notification stored for user ${userId}:`, newNotificationRef.key);

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

        console.log(`🔥 Cleaned up ${toDelete.length} old notifications for user ${userId}`);
      }

      return { success: true, notificationId: newNotificationRef.key };

    } catch (error) {
      console.error('🔥 Error storing notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send both push notification and store in database
  async sendAndStoreNotification(userId, notification) {
    const [pushResult, storeResult] = await Promise.allSettled([
      this.sendNotificationToUser(userId, notification),
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
      console.warn(`🔥 Critical notification push failed for user ${userId}, attempting email fallback`);
      
      // Get user email from Supabase
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      );

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

        console.log(`🔥 Critical notification added to email queue for user ${userId}`);
      }
    } catch (error) {
      console.error('🔥 Critical notification fallback failed:', error);
    }
  }

  // Send system-wide notification
  async sendSystemNotification(notification, userIds = null) {
    if (!userIds) {
      // If no specific users, get all users with FCM tokens
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .not('fcm_token', 'is', null);

      userIds = profiles?.map(p => p.id) || [];
    }

    if (userIds.length === 0) {
      console.warn('🔥 No users found for system notification');
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
      console.warn('🔥 Firebase database health check failed:', error.message);
    }

    try {
      if (this.messaging) {
        // Test messaging service (this doesn't actually send)
        messagingHealth = true; // Messaging doesn't have a simple health check
      }
    } catch (error) {
      console.warn('🔥 Firebase messaging health check failed:', error.message);
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

// Helper functions for common notification types
const NotificationTemplates = {
  taskCompleted: (taskName) => ({
    title: 'Task Completed ✅',
    body: `Your task "${taskName}" has completed successfully`,
    type: 'task_completed',
    priority: 'normal',
    icon: '/icons/task-completed.png'
  }),

  taskFailed: (taskName, error) => ({
    title: 'Task Failed ❌',
    body: `Your task "${taskName}" failed: ${error}`,
    type: 'task_failed',
    priority: 'high',
    icon: '/icons/task-failed.png'
  }),

  taskStarted: (taskName) => ({
    title: 'Task Started 🚀',
    body: `Your task "${taskName}" has started`,
    type: 'task_started',
    priority: 'low',
    icon: '/icons/task-started.png'
  }),

  emailSent: (emailType, recipient) => ({
    title: 'Email Sent 📧',
    body: `${emailType} email sent to ${recipient}`,
    type: 'email_sent',
    priority: 'low',
    icon: '/icons/email-sent.png'
  }),

  emailFailed: (emailType, recipient, error) => ({
    title: 'Email Failed 📧❌',
    body: `Failed to send ${emailType} email to ${recipient}: ${error}`,
    type: 'email_failed',
    priority: 'high',
    icon: '/icons/email-failed.png'
  }),

  welcome: (userName) => ({
    title: 'Welcome to EasyFlow! 🎉',
    body: `Hi ${userName}! Your account is ready. Start automating today.`,
    type: 'welcome',
    priority: 'normal',
    icon: '/icons/welcome.png'
  }),

  systemAlert: (message, severity = 'medium') => ({
    title: 'System Alert ⚠️',
    body: message,
    type: 'system_alert',
    priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'normal',
    icon: '/icons/system-alert.png'
  })
};

module.exports = {
  firebaseNotificationService,
  NotificationTemplates,
  firebaseAdminApp,
  firebaseMessaging,
  firebaseDatabase
};