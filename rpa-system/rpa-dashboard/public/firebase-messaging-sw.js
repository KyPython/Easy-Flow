// Firebase Cloud Messaging Service Worker for EasyFlow
// This service worker handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// ✅ SECURITY: Firebase config is loaded from firebase-config.js (generated at build time from environment variables)
// Note: Firebase API keys are PUBLIC keys (not secrets) but should still be managed via environment variables
// The firebase-config.js file is generated during the build process using firebase-config.js.template
let firebaseConfig;
try {
  // Try to load config from generated file (created at build time)
  importScripts('firebase-config.js');
  firebaseConfig = typeof FIREBASE_CONFIG !== 'undefined' ? FIREBASE_CONFIG : null;
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Could not load firebase-config.js, using fallback');
  // Fallback: Use environment variables if available (for development)
  // In production, firebase-config.js should always be generated at build time
  firebaseConfig = {
    apiKey: self.FIREBASE_API_KEY || "AIzaSyB9J-5pMepaV9_pmNn7EFIEF6kjI0KHIus",
    authDomain: self.FIREBASE_AUTH_DOMAIN || "easyflow-77db9.firebaseapp.com",
    databaseURL: self.FIREBASE_DATABASE_URL || "https://easyflow-77db9-default-rtdb.firebaseio.com",
    projectId: self.FIREBASE_PROJECT_ID || "easyflow-77db9",
    storageBucket: self.FIREBASE_STORAGE_BUCKET || "easyflow-77db9.firebasestorage.app",
    messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || "499973200328",
    appId: self.FIREBASE_APP_ID || "1:499973200328:web:c4126fca5106e6b2e808fd"
  };
}

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
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
  console.error('[firebase-messaging-sw.js] Unhandled promise rejection:', event.reason);
});

console.log('[firebase-messaging-sw.js] Firebase messaging service worker loaded');