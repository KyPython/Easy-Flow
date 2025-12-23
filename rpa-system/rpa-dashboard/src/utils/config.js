// Configuration for API endpoints and environment variables
// This centralizes all environment-dependent settings

// Helper to read envs from Vite (`import.meta.env`), runtime injection (`window._env`),
// or process.env. For backward compatibility with older deployments that used
// `REACT_APP_*` prefixes, we try alternate prefixes when a `VITE_` key is not found.
const getEnv = (name) => {
  const lookup = (key) => {
    // Prefer runtime-injected `window._env` (set by public/env.js at deploy time).
    if (typeof window !== 'undefined' && window._env && window._env[key]) return window._env[key];

    // Fall back to Node `process.env` (useful for server-side or build-time values).
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];

    // As a last resort, if the bundler has replaced values into `process.env` during build,
    // they will already be available above. We avoid referencing `import.meta` here because
    // some build toolchains / Babel configurations do not support `typeof import` checks
    // and will fail parsing. The `public/env.js` runtime shim handles compatibility.
    return undefined;
  };

  // Direct lookup first
  const direct = lookup(name);
  if (direct !== undefined) return direct;

  // If the requested key uses the modern VITE_ prefix, try the old REACT_APP_ prefix
  if (name.startsWith('VITE_')) {
    const alt = name.replace(/^VITE_/, 'REACT_APP_');
    const altVal = lookup(alt);
    if (altVal !== undefined) return altVal;
  }

  // If the requested key uses REACT_APP_, also try VITE_ variant
  if (name.startsWith('REACT_APP_')) {
    const alt = name.replace(/^REACT_APP_/, 'VITE_');
    const altVal = lookup(alt);
    if (altVal !== undefined) return altVal;
  }

  return undefined;
};

// Determine the API base URL based on environment
const getApiBaseUrl = () => {
  // Priority order for API URL determination:
  // 1. Explicit REACT_APP_API_URL
  // 2. REACT_APP_API_BASE
  // 3. REACT_APP_BACKEND_URL
  // 4. Auto-detect based on environment (hostname)
  // 5. Fallback: ''

  if (getEnv('VITE_API_URL')) return getEnv('VITE_API_URL');
  if (getEnv('VITE_API_BASE')) return getEnv('VITE_API_BASE');
  if (getEnv('VITE_BACKEND_URL')) return getEnv('VITE_BACKEND_URL');

  // Auto-detection based on hostname (only if env vars are not set)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port || '';

    // Development environments - use configured port
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const backendPort = getEnv('VITE_BACKEND_PORT') || getEnv('REACT_APP_BACKEND_PORT') || '3030';
      return `http://${hostname}:${backendPort}`;
    }

    // Production environments - use same origin (no hardcoded domains)
    // All production URLs should be configured via VITE_API_URL env var
    // This ensures the app works on any domain without code changes
    return window.location.origin;
  }

  // Fallback for server-side rendering or unknown environments
  return '';
};

// Export the configuration
export const config = {
  apiBaseUrl: getApiBaseUrl(),
  
  // Firebase configuration (frontend Vite envs)
  firebase: {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID'),
  },
  
  // Supabase configuration
  supabase: {
    url: getEnv('VITE_SUPABASE_URL'),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
  },
  
  // Feature flags
  features: {
    notifications: true,
    firebase: !!getEnv('VITE_FIREBASE_PROJECT_ID'),
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