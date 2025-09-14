// Runtime environment loader. Copy and customize in deployment.
// This file can be replaced at deploy time without rebuilding.
window._env = {
  // Example placeholders. Replace in production or override via server-side template.
  REACT_APP_SUPABASE_URL: window._env?.REACT_APP_SUPABASE_URL || '',
  REACT_APP_SUPABASE_ANON_KEY: window._env?.REACT_APP_SUPABASE_ANON_KEY || '',
  REACT_APP_FIREBASE_API_KEY: window._env?.REACT_APP_FIREBASE_API_KEY || '',
  REACT_APP_FIREBASE_AUTH_DOMAIN: window._env?.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  REACT_APP_FIREBASE_PROJECT_ID: window._env?.REACT_APP_FIREBASE_PROJECT_ID || '',
  REACT_APP_FIREBASE_STORAGE_BUCKET: window._env?.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: window._env?.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  REACT_APP_FIREBASE_APP_ID: window._env?.REACT_APP_FIREBASE_APP_ID || '',
  REACT_APP_FIREBASE_MEASUREMENT_ID: window._env?.REACT_APP_FIREBASE_MEASUREMENT_ID || '',
};
