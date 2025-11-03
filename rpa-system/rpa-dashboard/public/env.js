<<<<<<< HEAD
// Runtime environment configuration
// This file provides environment variables at runtime without requiring a rebuild
// The variables here will be available as window._env in your React app

window._env = {
  // Backend API base URL
  REACT_APP_API_BASE: 'http://localhost:3030',
  REACT_APP_PUBLIC_URL: 'http://localhost:3000',

  // Supabase configuration  
  REACT_APP_SUPABASE_URL: 'https://syxzilyuysdoirnezgii.supabase.co',
  REACT_APP_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0',

  // Firebase configuration
  REACT_APP_FIREBASE_API_KEY: 'AIzaSyB9J-5pMepaV9_pmNn7EFIEF6kjI0KHIus',
  REACT_APP_FIREBASE_AUTH_DOMAIN: 'easyflow-77db9.firebaseapp.com',
  REACT_APP_FIREBASE_DATABASE_URL: 'https://easyflow-77db9-default-rtdb.firebaseio.com',
  REACT_APP_FIREBASE_PROJECT_ID: 'easyflow-77db9',
  REACT_APP_FIREBASE_STORAGE_BUCKET: 'easyflow-77db9.firebasestorage.app',
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '499973200328',
  REACT_APP_FIREBASE_APP_ID: '1:499973200328:web:c4126fca5106e6b2e808fd',
  REACT_APP_FIREBASE_MEASUREMENT_ID: 'G-EK8NQ5JCGC',
  REACT_APP_FIREBASE_VAPID_KEY: 'BEDBgXkAROjyXjB5J7N8RVc2u-SHiH6_L4PbQyKHnOWfbZl5E8j6qNm5EDITv0l1GN3-6nniXto0sowsR8S2gZc',
  REACT_APP_FIREBASE_FUNCTIONS_URL: 'https://us-central1-easyflow-77db9.cloudfunctions.net',

  // Analytics
  REACT_APP_GA_MEASUREMENT_ID: 'G-QGYCGQFC6D',
  REACT_APP_UCHAT_WIDGET_ID: '3cpyqxve97diqnsu'
};
=======
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
  // Analytics toggle: set to 'true' in production to enable GA
  ENABLE_ANALYTICS: window._env?.ENABLE_ANALYTICS || 'false',
};
>>>>>>> restored-37cdb23
