// Firebase Configuration for EasyFlow
// This file contains Firebase setup for real-time notifications and database

// NOTE: we deliberately avoid static firebase/* imports to prevent
// bundling and heavy parse/eval at app startup. Use `initFirebase()` to
// initialize Firebase lazily after first render or on-demand.

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

// ✅ CRITICAL: Validate projectId - this is required for ALL Firebase features
const hasProjectId = !!(firebaseConfig.projectId && firebaseConfig.projectId.trim());

// ✅ IMPROVED: Log clear errors in production when critical config is missing
if (!hasProjectId) {
  const errorMsg = '🔥 CRITICAL: Firebase projectId is missing! Set REACT_APP_FIREBASE_PROJECT_ID in Vercel environment variables.';
  if (process.env.NODE_ENV === 'production') {
    console.error(errorMsg);
    console.error('Missing environment variable: REACT_APP_FIREBASE_PROJECT_ID');
    console.error('This will cause Firebase authentication to fail with 401 errors.');
  } else {
    console.warn(errorMsg);
  }
}

if (!isAnyConfigured) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Firebase configuration incomplete. Missing (messaging):', missingMessaging);
    console.warn('Firebase configuration incomplete. Missing (database):', missingDatabase);
    console.warn('Real-time features will be disabled.');
  } else {
    // ✅ PRODUCTION: Log clear error messages for missing config
    console.error('🔥 Firebase configuration incomplete in production!');
    if (missingMessaging.length > 0) {
      console.error('Missing messaging config:', missingMessaging);
      console.error('Set these Vercel environment variables:', missingMessaging.map(f => f.replace('REACT_APP_', '')).join(', '));
    }
    if (missingDatabase.length > 0) {
      console.error('Missing database config:', missingDatabase);
      console.error('Set these Vercel environment variables:', missingDatabase.map(f => f.replace('REACT_APP_', '')).join(', '));
    }
    console.error('Real-time features will be disabled until configuration is complete.');
  }
}

// Initialize Firebase
let app = null;
let messaging = null;
let database = null;
let auth = null;

let isFirebaseConfigured = isAnyConfigured;

// No-op stubs to keep callers safe before init
const noop = () => {};

export async function initFirebase() {
  // ✅ CRITICAL: Check projectId before attempting initialization
  if (!hasProjectId) {
    const errorMsg = '🔥 Cannot initialize Firebase: projectId is missing. Set REACT_APP_FIREBASE_PROJECT_ID in Vercel environment variables.';
    if (process.env.NODE_ENV === 'production') {
      console.error(errorMsg);
      console.error('Current firebaseConfig.projectId:', firebaseConfig.projectId || '(undefined)');
    } else {
      console.warn(errorMsg);
    }
    isFirebaseConfigured = false;
    return { app: null, messaging: null, database: null, auth: null };
  }

  if (!isAnyConfigured) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Firebase not configured - skipping init. Missing keys:', {
        missingMessaging: missingMessaging,
        missingDatabase: missingDatabase
      });
    } else {
      console.error('🔥 Firebase not configured - missing required environment variables');
      console.error('Missing messaging:', missingMessaging);
      console.error('Missing database:', missingDatabase);
    }
    isFirebaseConfigured = false;
    return { app: null, messaging: null, database: null, auth: null };
  }

  if (app) return { app, messaging, database, auth };

  try {
    const firebaseApp = await import('firebase/app');
    const firebaseAuth = await import('firebase/auth');
    const firebaseDatabase = await import('firebase/database');
    const firebaseMessaging = await import('firebase/messaging');

    // ✅ VALIDATE: Ensure projectId is present before initialization
    if (!firebaseConfig.projectId || !firebaseConfig.projectId.trim()) {
      throw new Error('Firebase projectId is required but was not provided. Set REACT_APP_FIREBASE_PROJECT_ID in Vercel environment variables.');
    }

    // Initialize app
    app = firebaseApp.initializeApp(firebaseConfig);

    if (typeof window !== 'undefined' && isMessagingConfigured) {
      try { messaging = firebaseMessaging.getMessaging(app); } catch (e) { messaging = null; }
    }

    if (isDatabaseConfigured) {
      try { database = firebaseDatabase.getDatabase(app); } catch (e) { database = null; }
    }

    try { auth = firebaseAuth.getAuth(app); } catch (e) { auth = null; }

    isFirebaseConfigured = true;
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.info('Firebase initialized (lazy) projectId=', firebaseConfig.projectId);
    }

    return { app, messaging, database, auth };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Firebase lazy initialization failed:', error);
    isFirebaseConfigured = false;
    return { app: null, messaging: null, database: null, auth: null };
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