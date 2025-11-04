// Runtime environment configuration
// WARNING: Do not hardcode secrets in this file. Values should be provided at deploy time.
// This file enables runtime configuration via window._env without rebuilding the app.

window._env = {
  // Backend API base URL (example placeholders)
  REACT_APP_API_BASE: window._env?.REACT_APP_API_BASE || '',
  REACT_APP_PUBLIC_URL: window._env?.REACT_APP_PUBLIC_URL || '',

  // Supabase configuration
  REACT_APP_SUPABASE_URL: window._env?.REACT_APP_SUPABASE_URL || '',
  REACT_APP_SUPABASE_ANON_KEY: window._env?.REACT_APP_SUPABASE_ANON_KEY || '',

  // Firebase configuration
  REACT_APP_FIREBASE_API_KEY: window._env?.REACT_APP_FIREBASE_API_KEY || '',
  REACT_APP_FIREBASE_AUTH_DOMAIN: window._env?.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  REACT_APP_FIREBASE_DATABASE_URL: window._env?.REACT_APP_FIREBASE_DATABASE_URL || '',
  REACT_APP_FIREBASE_PROJECT_ID: window._env?.REACT_APP_FIREBASE_PROJECT_ID || '',
  REACT_APP_FIREBASE_STORAGE_BUCKET: window._env?.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: window._env?.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  REACT_APP_FIREBASE_APP_ID: window._env?.REACT_APP_FIREBASE_APP_ID || '',
  REACT_APP_FIREBASE_MEASUREMENT_ID: window._env?.REACT_APP_FIREBASE_MEASUREMENT_ID || '',
  REACT_APP_FIREBASE_VAPID_KEY: window._env?.REACT_APP_FIREBASE_VAPID_KEY || '',
  REACT_APP_FIREBASE_FUNCTIONS_URL: window._env?.REACT_APP_FIREBASE_FUNCTIONS_URL || '',

  // Analytics and widgets
  REACT_APP_GA_MEASUREMENT_ID: window._env?.REACT_APP_GA_MEASUREMENT_ID || '',
  REACT_APP_UCHAT_WIDGET_ID: window._env?.REACT_APP_UCHAT_WIDGET_ID || '',
  ENABLE_ANALYTICS: window._env?.ENABLE_ANALYTICS || 'false'
};
