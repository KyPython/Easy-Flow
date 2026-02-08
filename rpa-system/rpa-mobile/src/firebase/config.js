/**
 * Firebase Configuration for EasyFlow Mobile
 * 
 * This file provides Firebase initialization for push notifications
 * and other Firebase services.
 * 
 * Setup Instructions:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Add iOS app with bundle ID: com.tryeasyflow.app
 * 3. Add Android app with package name: com.tryeasyflow.app
 * 4. Download GoogleService-Info.plist (iOS) and google-services.json (Android)
 * 5. Place them in the rpa-system/rpa-mobile directory
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase configuration - these values come from:
// - GoogleService-Info.plist (iOS)
// - google-services.json (Android)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only if config is present)
let firebaseApp = null;
let messaging = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    firebaseApp = initializeApp(firebaseConfig);
    
    // Check if messaging is supported
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(firebaseApp);
    }
  }
} catch (error) {
  console.warn('[Firebase] Initialization failed:', error.message);
}

export { firebaseApp, messaging };

/**
 * Get FCM Token for push notifications
 * This is used by the backend to send push notifications
 */
export async function getFCMToken() {
  if (!messaging) {
    console.warn('[Firebase] Messaging not available');
    return null;
  }
  
  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch (error) {
    console.error('[Firebase] Error getting FCM token:', error);
    return null;
  }
}

import { getToken } from 'firebase/messaging';
