// Firebase Cloud Messaging Service Worker for EasyFlow
// This service worker handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// ✅ SECURITY: Firebase config is loaded from firebase-config.js (generated at build time from environment variables)
// Note: Firebase API keys are PUBLIC keys (not secrets) but should still be managed via environment variables
// The firebase-config.js file is generated during the build process using firebase-config.js.template
let firebaseConfig = null;
let configError = null;

try {
  // Try to load config from generated file (created at build time)
  importScripts('firebase-config.js');
  firebaseConfig = typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null;
} catch (e) {
  configError = e;
  console.error('[firebase-messaging-sw.js] CRITICAL: Could not load firebase-config.js:', e.message);
  // ✅ FIX: Don't create empty fallback config - this hides the real problem
  // Instead, set to null so validation below will catch it and fail loudly
  firebaseConfig = null;
}

// Validate config before initializing Firebase
// This prevents "Missing App configuration value: projectId" errors
// This also prevents the authentication cascade (401 → FCM 400 → Supabase instability)
const hasProjectId = firebaseConfig && firebaseConfig.projectId && firebaseConfig.projectId.trim();
const hasApiKey = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.trim();

if (!hasProjectId || !hasApiKey) {
  const missingFields = [];
  if (!hasProjectId) missingFields.push('projectId');
  if (!hasApiKey) missingFields.push('apiKey');
  
  const errorMessage = `🔥🔥🔥 FATAL: Firebase service worker configuration is missing! 🔥🔥🔥\n\n` +
    `Missing: ${missingFields.join(' and ')}\n\n` +
    `CASCADE IMPACT:\n` +
    `  1. Firebase authentication will fail (401)\n` +
    `  2. FCM registration will fail (400 INVALID_ARGUMENT)\n` +
    `  3. Supabase real-time will become unstable (WebSocket flapping)\n` +
    `  4. App will fall back to inefficient API polling\n\n` +
    `ROOT CAUSE: firebase-config.js is missing or incomplete\n\n` +
    `FIX:\n` +
    `  - For local dev: Check rpa-system/rpa-dashboard/.env.local contains:\n` +
    `    REACT_APP_FIREBASE_PROJECT_ID=your-project-id\n` +
    `    REACT_APP_FIREBASE_API_KEY=your-api-key\n\n` +
    `  - For production: Ensure Vercel environment variables are set\n\n` +
    `Current config: ${JSON.stringify({ projectId: firebaseConfig?.projectId || '(missing)', apiKey: firebaseConfig?.apiKey ? '(present)' : '(missing)' }, null, 2)}`;
  
  console.error('\n' + '='.repeat(80));
  console.error('[firebase-messaging-sw.js]', errorMessage);
  console.error('='.repeat(80) + '\n');
  
  // Always throw in development to prevent silent failure
  // In production, we'll skip initialization but log prominently
  const isDevelopment = self.location && (
    self.location.hostname === 'localhost' || 
    self.location.hostname === '127.0.0.1' ||
    self.location.hostname.includes('localhost') ||
    self.location.hostname.includes('127.0.0.1')
  );
  
  if (isDevelopment) {
    // Create a proper error object that will be caught by unhandledrejection handler
    const fatalError = new Error(errorMessage);
    fatalError.name = 'FirebaseConfigurationError';
    fatalError.cascadeImpact = '401 auth → FCM 400 → Supabase instability → Polling fallback';
    throw fatalError; // This will be caught by the unhandledrejection handler below
  }
  
  // Production: Don't initialize, but log prominently
  console.error('[firebase-messaging-sw.js] ⚠️ SKIPPING Firebase initialization due to missing configuration');
  console.error('[firebase-messaging-sw.js] This will cause authentication failures and cascade to other systems');
} else {
  // Config is valid, initialize Firebase
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('[firebase-messaging-sw.js] Firebase initialized successfully');
  } catch (initError) {
    console.error('[firebase-messaging-sw.js] Firebase initialization failed:', initError);
    // Don't throw in production to avoid breaking the service worker
    if (self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')) {
      throw initError; // Fail loudly in development
    }
  }
}

// Retrieve an instance of Firebase Messaging so that it can handle background messages
// Only initialize if Firebase was successfully initialized
let messaging = null;
try {
  if (firebase.apps && firebase.apps.length > 0) {
    messaging = firebase.messaging();
    console.log('[firebase-messaging-sw.js] Firebase Messaging initialized');
  } else {
    console.warn('[firebase-messaging-sw.js] Firebase not initialized, messaging unavailable');
  }
} catch (e) {
  console.error('[firebase-messaging-sw.js] Failed to initialize Firebase Messaging:', e);
  messaging = null;
}

// Handle background messages (only if messaging is available)
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const { notification, data } = payload;
  
  // Customize the notification here
  const notificationTitle = notification?.title || 'EasyFlow Notification';
  const notificationOptions = {
    body: notification?.body || 'You have a new notification',
    icon: notification?.icon || '/favicon.ico',
    badge: '/badge-icon.png',
    tag: data?.type || 'general',
    data: data,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ],
    requireInteraction: data?.priority === 'critical',
    silent: data?.priority === 'low',
    timestamp: Date.now(),
    image: data?.image // Optional large image
  };

    // Show the notification
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[firebase-messaging-sw.js] Firebase Messaging not available, background message handler not registered');
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  const { action, notification } = event;
  const data = notification.data || {};

  event.notification.close();

  if (action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Default action or 'view' action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      const targetUrl = data.url || '/app';
      
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          client.focus();
          
          // Send a message to the client about the notification click
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data,
            action: action
          });
          
          return;
        }
      }

      // If no existing window/tab found, open a new one
      if (clients.openWindow) {
        const fullUrl = new URL(targetUrl, self.location.origin).href;
        clients.openWindow(fullUrl).then((client) => {
          if (client) {
            // Send a message to the new client about the notification click
            setTimeout(() => {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: data,
                action: action
              });
            }, 1000); // Wait a bit for the client to load
          }
        });
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event);
  
  // Optional: Track notification dismissals
  const data = event.notification.data || {};
  
  // You could send analytics here
  // analytics.track('notification_dismissed', { type: data.type });
});

// Handle push events (backup for onBackgroundMessage)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[firebase-messaging-sw.js] Push payload:', payload);
      
      // This is handled by onBackgroundMessage, but keeping as backup
      if (!payload.notification) {
        const notificationTitle = 'EasyFlow';
        const notificationOptions = {
          body: 'You have a new update',
          icon: '/favicon.ico',
          badge: '/badge-icon.png',
          tag: 'general'
        };
        
        event.waitUntil(
          self.registration.showNotification(notificationTitle, notificationOptions)
        );
      }
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Error parsing push payload:', error);
    }
  }
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activated');
  
  // Clean up old caches if needed
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.includes('firebase-messaging-sw-old')) {
            console.log('[firebase-messaging-sw.js] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installed');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  // ✅ SECURITY: Validate message origin and type to prevent XSS attacks
  // Only accept messages from the same origin
  if (!event || typeof event !== 'object' || !event.origin) {
    console.warn('[firebase-messaging-sw] Invalid message event - missing origin');
    return;
  }
  
  // ✅ SECURITY: Explicit type check for origin (must be string)
  if (typeof event.origin !== 'string') {
    console.warn('[firebase-messaging-sw] Invalid message origin type');
    return;
  }
  
  const allowedOrigin = self.location.origin;
  
  // ✅ SECURITY: Strict origin comparison (both must be strings)
  if (typeof allowedOrigin !== 'string' || event.origin !== allowedOrigin) {
    console.warn('[firebase-messaging-sw] Rejected message from unauthorized origin:', event.origin);
    return;
  }
  
  // ✅ SECURITY: Validate message data type
  if (event.data && typeof event.data !== 'object') {
    console.warn('[firebase-messaging-sw] Rejected message with invalid data type');
    return;
  }
  
  console.log('[firebase-messaging-sw.js] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[firebase-messaging-sw.js] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const isConfigError = error && (error.name === 'FirebaseConfigurationError' || error.message?.includes('FATAL'));
  
  if (isConfigError) {
    // Log configuration errors prominently
    console.error('\n\n🔥🔥🔥 FIREBASE SERVICE WORKER CONFIGURATION ERROR 🔥🔥🔥\n');
    console.error(error.message || error);
    console.error('\nThis error prevents the service worker from initializing Firebase.');
    console.error('Fix: Ensure firebase-config.js is generated at build time with all required Firebase values.');
    console.error('For local development, check rpa-system/rpa-dashboard/.env.local\n');
    
    // In development, we want this to be visible, so don't prevent default
    // This will show up in the browser console as an unhandled rejection
    if (self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')) {
      // Development: Let the error propagate so it's visible
      return;
    }
  } else {
    console.error('[firebase-messaging-sw.js] Unhandled promise rejection:', event.reason);
  }
  
  // Prevent the default unhandled rejection behavior for non-config errors
  // (to avoid breaking the service worker for other errors)
  if (!isConfigError) {
    event.preventDefault();
  }
});

console.log('[firebase-messaging-sw.js] Firebase messaging service worker loaded');