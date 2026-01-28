// Firebase Configuration for EasyFlow
// This file contains Firebase setup for real-time notifications and database

// NOTE: we deliberately avoid static firebase/* imports to prevent
// bundling and heavy parse/eval at app startup. Use `initFirebase()` to
// initialize Firebase lazily after first render or on-demand.

// Allow runtime-injected env (window._env) to provide Firebase keys so we don't need a rebuild
// This mirrors the pattern used in supabaseClient.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};

// Helper to get env var with VITE_ or REACT_APP_ prefix
const getEnv = (key) => {
  const viteKey = `VITE_${key}`;
  const viteKeyPlain = key; // Sometimes VITE_ is not used in window._env
  const reactKey = `REACT_APP_${key}`;
  return runtimeEnv[viteKey] || process.env[viteKey] || 
         runtimeEnv[viteKeyPlain] || process.env[viteKeyPlain] ||
         runtimeEnv[reactKey] || process.env[reactKey];
};

// Firebase configuration - values may come from build-time process.env or runtime window._env
const firebaseConfig = {
 apiKey: getEnv('FIREBASE_API_KEY'),
 authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
 databaseURL: getEnv('FIREBASE_DATABASE_URL'),
 projectId: getEnv('FIREBASE_PROJECT_ID'),
 storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
 messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
 appId: getEnv('FIREBASE_APP_ID'),
 measurementId: getEnv('FIREBASE_MEASUREMENT_ID') // Optional
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

// ✅ FATAL ERROR: Throw immediately if critical config is missing in development
// This prevents silent fallback to polling that floods the backend
if (!hasProjectId) {
 const errorDetails = {
 message: '🔥 FATAL: Firebase projectId is missing!',
 missing: 'REACT_APP_FIREBASE_PROJECT_ID',
 impact: 'Firebase cannot initialize, causing frontend to fall back to aggressive polling that floods the backend API.',
 fix: 'Set REACT_APP_FIREBASE_PROJECT_ID in your .env.local file (local) or Vercel environment variables (production).',
 currentValue: firebaseConfig.projectId || '(undefined)',
 envSources: {
 runtime: runtimeEnv.REACT_APP_FIREBASE_PROJECT_ID || '(not set)',
 buildTime: process.env.REACT_APP_FIREBASE_PROJECT_ID || '(not set)'
 }
 };

 if (process.env.NODE_ENV === 'development') {
 // ✅ DEVELOPMENT: Throw fatal error to prevent silent failure
 const fatalError = new Error(
 `\n\n🔥 FATAL FIREBASE CONFIGURATION ERROR 🔥\n\n` +
 `${errorDetails.message}\n` +
 `Missing: ${errorDetails.missing}\n\n` +
 `Impact: ${errorDetails.impact}\n\n` +
 `Fix: ${errorDetails.fix}\n\n` +
 `Current projectId: ${errorDetails.currentValue}\n` +
 `Runtime env: ${errorDetails.envSources.runtime}\n` +
 `Build-time env: ${errorDetails.envSources.buildTime}\n\n` +
 `This error prevents the app from silently falling back to polling.\n` +
 `Please create/update rpa-system/rpa-dashboard/.env.local with:\n` +
 ` REACT_APP_FIREBASE_PROJECT_ID=your-project-id\n\n`
 );
 fatalError.name = 'FirebaseConfigurationError';
 fatalError.details = errorDetails;
 throw fatalError;
 } else {
 // ✅ PRODUCTION: Log critical error (don't throw to avoid breaking production)
 console.error('🔥 CRITICAL: Firebase projectId is missing in production!');
 console.error('Missing environment variable: REACT_APP_FIREBASE_PROJECT_ID');
 console.error('Impact: Firebase cannot initialize, causing frontend to fall back to aggressive polling');
 console.error('Fix: Set REACT_APP_FIREBASE_PROJECT_ID in Vercel environment variables');
 console.error('Current value:', firebaseConfig.projectId || '(undefined)');
 }
}

if (!isAnyConfigured) {
 const errorDetails = {
 missingMessaging,
 missingDatabase,
 impact: 'Real-time features disabled, causing frontend to fall back to aggressive polling that floods the backend API.',
 fix: 'Set all required Firebase environment variables in .env.local (local) or Vercel (production).'
 };

 if (process.env.NODE_ENV === 'development') {
 // ✅ DEVELOPMENT: Throw fatal error to prevent silent failure
 const fatalError = new Error(
 `\n\n🔥 FATAL FIREBASE CONFIGURATION ERROR 🔥\n\n` +
 `Firebase configuration is incomplete!\n\n` +
 `Missing messaging config: ${missingMessaging.join(', ')}\n` +
 `Missing database config: ${missingDatabase.join(', ')}\n\n` +
 `Impact: ${errorDetails.impact}\n\n` +
 `Fix: ${errorDetails.fix}\n\n` +
 `Please create/update rpa-system/rpa-dashboard/.env.local with all required Firebase variables.\n` +
 `See rpa-system/rpa-dashboard/.env.example for the complete list.\n\n`
 );
 fatalError.name = 'FirebaseConfigurationError';
 fatalError.details = errorDetails;
 throw fatalError;
 } else {
 // ✅ PRODUCTION: Log critical error messages
 console.error('🔥 CRITICAL: Firebase configuration incomplete in production!');
 if (missingMessaging.length > 0) {
 console.error('Missing messaging config:', missingMessaging.join(', '));
 console.error('Set these Vercel environment variables:', missingMessaging.map(f => f.replace('REACT_APP_', '')).join(', '));
 }
 if (missingDatabase.length > 0) {
 console.error('Missing database config:', missingDatabase.join(', '));
 console.error('Set these Vercel environment variables:', missingDatabase.map(f => f.replace('REACT_APP_', '')).join(', '));
 }
 console.error('Impact: Real-time features disabled, causing frontend to fall back to aggressive polling');
 console.error('Fix: Set all required Firebase environment variables in Vercel project settings');
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
 // Note: In development, this should have already thrown during module evaluation
 // This is a safety check for production or if module evaluation didn't catch it
 if (!hasProjectId) {
 const errorMsg = '🔥 Cannot initialize Firebase: projectId is missing. Set REACT_APP_FIREBASE_PROJECT_ID in Vercel environment variables.';
 if (process.env.NODE_ENV === 'production') {
 console.error(errorMsg);
 console.error('Current firebaseConfig.projectId:', firebaseConfig.projectId || '(undefined)');
 console.error('This will cause Firebase authentication to fail and trigger polling fallback.');
 } else {
 // In development, this should have been caught at module load time
 // But if we get here, throw to prevent silent failure
 throw new Error(
 `🔥 FATAL: Firebase projectId is missing!\n` +
 `Set REACT_APP_FIREBASE_PROJECT_ID in rpa-system/rpa-dashboard/.env.local\n` +
 `Current value: ${firebaseConfig.projectId || '(undefined)'}`
 );
 }
 isFirebaseConfigured = false;
 return { app: null, messaging: null, database: null, auth: null };
 }

 if (!isAnyConfigured) {
 if (process.env.NODE_ENV === 'development') {
 // In development, this should have been caught at module load time
 // But if we get here, throw to prevent silent failure
 throw new Error(
 `🔥 FATAL: Firebase configuration incomplete!\n` +
 `Missing messaging: ${missingMessaging.join(', ')}\n` +
 `Missing database: ${missingDatabase.join(', ')}\n` +
 `Set all required variables in rpa-system/rpa-dashboard/.env.local`
 );
 } else {
 console.error('🔥 Firebase not configured - missing required environment variables');
 console.error('Missing messaging:', missingMessaging.join(', '));
 console.error('Missing database:', missingDatabase.join(', '));
 console.error('This will cause real-time features to fail and trigger polling fallback.');
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
 console.info('🔥 Firebase initialized (lazy)', { projectId: firebaseConfig.projectId, authDomain: firebaseConfig.authDomain });
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