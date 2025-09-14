import { createClient } from '@supabase/supabase-js';

// Prefer runtime-provided values (window._env) when available. This allows the
// deployed build to pick up keys from /env.js served by the webserver without
// rebuilding the bundle.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
const supabaseUrl = runtimeEnv.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Provide a safe stub client when env vars are missing to avoid crashing the app in dev/CI
function createStubSupabase() {
	const stubResult = (data = null, error = null) => Promise.resolve({ data, error });
	const query = () => ({
		select: () => stubResult([]),
		insert: () => stubResult(null),
		update: () => stubResult(null),
		upsert: () => stubResult(null),
		delete: () => stubResult(null),
		eq: () => query(),
		match: () => query(),
		order: () => query(),
		limit: () => query(),
		range: () => query(),
	});
	return {
		get __disabled() { return true; },
		from: () => query(),
		auth: {
			getUser: () => stubResult({ user: null }),
			getSession: () => stubResult({ session: null }),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
			signInWithPassword: () => stubResult(null, new Error('Supabase disabled (missing env)')),
			signOut: () => stubResult(),
		},
		channel: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
	};
}

let client;
if (!supabaseUrl || !supabaseAnonKey || String(supabaseAnonKey).includes('...')) {
	console.warn('[Supabase] Missing or placeholder env vars at build/runtime. Using disabled supabase client.');
	client = createStubSupabase();
} else {
	client = createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true,
		},
	});
}

export const supabase = client;

// Expose globally for diagnostics (read-only) similar to _api
if (typeof window !== 'undefined' && !window._supabase) {
	Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false });
	// eslint-disable-next-line no-console
	console.info('[supabase] client exposed globally as window._supabase', supabase.__disabled ? '(disabled)' : '');
}
