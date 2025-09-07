import { createClient } from '@supabase/supabase-js';

// Prefer runtime-provided values (window._env) when available. This allows the
// deployed build to pick up keys from /env.js served by the webserver without
// rebuilding the bundle.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
const supabaseUrl = runtimeEnv.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('...')) {
	// Don't throw here to allow runtime injection via /env.js in production.
	// Log a clear warning so CI/builds still surface the missing config.
	// If you prefer strict build-time failure, revert this to an exception.
	// During development you can set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local.
	 
	console.warn('[Supabase] Missing or placeholder env vars at build time. Expecting runtime window._env to provide them.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true
	}
});

// Expose globally for diagnostics (read-only) similar to _api
if (typeof window !== 'undefined' && !window._supabase) {
	Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false });
	// eslint-disable-next-line no-console
	console.info('[supabase] client exposed globally as window._supabase');
}
