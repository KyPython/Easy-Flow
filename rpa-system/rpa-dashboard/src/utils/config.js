// Configuration for API endpoints and environment variables
// This centralizes all environment-dependent settings

// Determine the API base URL based on environment
const getApiBaseUrl = () => {
  // Priority order for API URL determination:
  // 1. Explicit REACT_APP_API_URL
  // 2. REACT_APP_API_BASE
  // 3. REACT_APP_BACKEND_URL
  // 4. Auto-detect based on environment (hostname)
  // 5. Fallback: ''

  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }

  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }

  // Auto-detection based on hostname (only if env vars are not set)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Production environments
    if (hostname === 'app.easyflow.com') {
      // Custom domain setup
      return 'https://api.easyflow.com';
    }

    // Development environments
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3030';
    }

    // Vercel frontend (fallback only)
    if (hostname === 'easy-flow-lac.vercel.app') {
      return 'https://easyflow-backend-ad8e.onrender.com';
    }
  }

  // Fallback for server-side rendering or unknown environments
  return '';
};

// Export the configuration
export const config = {
  apiBaseUrl: getApiBaseUrl(),
  
  // Firebase configuration
  firebase: {
    // These will be loaded from environment variables
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  },
  
  // Supabase configuration
  supabase: {
    url: process.env.REACT_APP_SUPABASE_URL,
    anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  },
  
  // Feature flags
  features: {
    notifications: true,
    firebase: !!process.env.REACT_APP_FIREBASE_PROJECT_ID,
    debugging: process.env.NODE_ENV === 'development',
  }
};

// Helper function to build API URLs
export const buildApiUrl = (endpoint) => {
  const baseUrl = config.apiBaseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Log configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:', {
    apiBaseUrl: config.apiBaseUrl,
    environment: process.env.NODE_ENV,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
    firebaseConfigured: config.features.firebase
  });
}

export default config;