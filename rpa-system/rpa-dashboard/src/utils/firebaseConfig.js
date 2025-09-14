// Firebase Configuration for EasyFlow
// This file contains Firebase setup for real-time notifications and database

import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Allow runtime-injected env (window._env) to provide Firebase keys so we don't need a rebuild
// This mirrors the pattern used in supabaseClient.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};

// Firebase configuration - values may come from build-time process.env or runtime window._env
const firebaseConfig = {
  apiKey: runtimeEnv.REACT_APP_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: runtimeEnv.REACT_APP_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: runtimeEnv.REACT_APP_FIREBASE_DATABASE_URL || process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: runtimeEnv.REACT_APP_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: runtimeEnv.REACT_APP_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeEnv.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeEnv.REACT_APP_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: runtimeEnv.REACT_APP_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Optional
};

// Determine feature-specific configuration readiness
const has = (key) => !!(runtimeEnv[key] || process.env[key]);
const messagingFields = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];
const databaseFields = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_DATABASE_URL',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const missingMessaging = messagingFields.filter((f) => !has(f));
const missingDatabase = databaseFields.filter((f) => !has(f));

const isMessagingConfigured = missingMessaging.length === 0;
const isDatabaseConfigured = missingDatabase.length === 0;
const isAnyConfigured = isMessagingConfigured || isDatabaseConfigured;

if (!isAnyConfigured && process.env.NODE_ENV === 'development') {
  console.warn('Firebase configuration incomplete. Missing (messaging):', missingMessaging);
  console.warn('Firebase configuration incomplete. Missing (database):', missingDatabase);
  console.warn('Real-time features will be disabled.');
}

// Initialize Firebase
let app = null;
let messaging = null;
let database = null;
let auth = null;

const isFirebaseConfigured = isAnyConfigured;

// In production we usually won't spam logs, but a single informative line helps debugging.
if (typeof window !== 'undefined' && isFirebaseConfigured && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.info('🔥 Firebase config detected (source:', runtimeEnv.REACT_APP_FIREBASE_PROJECT_ID ? 'runtime' : 'build', ') projectId=', firebaseConfig.projectId);
}

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Initialize services conditionally
    if (typeof window !== 'undefined' && isMessagingConfigured) {
      // Only initialize messaging in browser environment when configured
      messaging = getMessaging(app);
    }
    if (isDatabaseConfigured) {
      database = getDatabase(app);
    }
    auth = getAuth(app);
    
    console.log('🔥 Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  // Only show warnings in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('🔥 Firebase not configured - real-time features disabled');
  }
}

export { app, messaging, database, auth, isFirebaseConfigured, isMessagingConfigured, isDatabaseConfigured };

// Notification types
export const NOTIFICATION_TYPES = {
  TASK_COMPLETED: 'task_completed',
  TASK_FAILED: 'task_failed', 
  TASK_STARTED: 'task_started',
  SYSTEM_ALERT: 'system_alert',
  EMAIL_SENT: 'email_sent',
  EMAIL_FAILED: 'email_failed',
  WELCOME: 'welcome'
};

// Notification priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal', 
  HIGH: 'high',
  CRITICAL: 'critical'
};

export default {
  app,
  messaging,
  database,
  auth,
  isFirebaseConfigured,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES
};