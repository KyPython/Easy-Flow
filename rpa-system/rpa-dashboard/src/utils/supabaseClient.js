// Lazy-initialized Supabase client with a safe proxy stub so existing imports
// can continue to call `supabase.*` synchronously without blocking module
// evaluation. Callers can also call `initSupabase()` to force initialization.

// Prefer build-time process.env values (CRA injects these) over runtime window._env
// to avoid empty strings from public/env.js interfering with local dev
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};

// Gather env values with fallbacks for various bundlers
// Priority: process.env (CRA build-time) > runtime window._env > fallbacks
const rawUrl = process.env.REACT_APP_SUPABASE_URL
 || process.env.VITE_SUPABASE_URL
 || process.env.SUPABASE_URL
 || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
 || runtimeEnv.REACT_APP_SUPABASE_URL
 || runtimeEnv.VITE_SUPABASE_URL;

const rawAnon = process.env.REACT_APP_SUPABASE_ANON_KEY
 || process.env.VITE_SUPABASE_ANON_KEY
 || process.env.SUPABASE_ANON_KEY
 || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
 || runtimeEnv.REACT_APP_SUPABASE_ANON_KEY
 || runtimeEnv.VITE_SUPABASE_ANON_KEY;

function looksLikePlaceholder(url) {
 if (!url || typeof url !== 'string') return true;
 const lower = url.toLowerCase();
 return lower.includes('your-project') || lower.includes('example') || !lower.includes('.supabase.co');
}

function createStubSupabase(reasonMessage) {
 const errorResult = async () => ({ error: new Error(reasonMessage), data: null });

 const auth = {
 signInWithPassword: async () => ({ error: new Error(reasonMessage) }),
 signUp: async () => ({ error: new Error(reasonMessage) }),
 getSession: async () => ({ data: { session: null }, error: null }),
 getUser: async () => ({ data: { user: null }, error: null }),
 resetPasswordForEmail: async () => ({ error: new Error(reasonMessage) }),
 resend: async () => ({ error: new Error(reasonMessage) }),
 onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
 };

 // Chainable query builder stub that returns itself for all methods
 const createChainableStub = () => {
 const stub = {
 select: () => stub,
 insert: () => stub,
 update: () => stub,
 delete: () => stub,
 eq: () => stub,
 neq: () => stub,
 gt: () => stub,
 gte: () => stub,
 lt: () => stub,
 lte: () => stub,
 like: () => stub,
 ilike: () => stub,
 is: () => stub,
 in: () => stub,
 contains: () => stub,
 containedBy: () => stub,
 filter: () => stub,
 match: () => stub,
 order: () => stub,
 limit: () => stub,
 range: () => stub,
 single: () => stub,
 maybeSingle: () => stub,
 // Make it thenable so it works with await
 then: (resolve, reject) => {
 const result = { error: new Error(reasonMessage), data: null };
 if (resolve) return resolve(result);
 return Promise.resolve(result);
 },
 catch: (reject) => {
 if (reject) return reject(new Error(reasonMessage));
 return Promise.reject(new Error(reasonMessage));
 }
 };
 return stub;
 };

 const from = () => createChainableStub();

 // Minimal stub that won't crash callers during render
 return {
 auth,
 from,
 // helper no-op for realtime/listeners
 channel: () => ({ subscribe: async () => ({ error: new Error(reasonMessage) }) })
 };
}

// Internal holder for the real client once initialized
let _realSupabase = null;
// Promise used to serialize initialization and avoid concurrent createClient calls
let _initPromise = null;

// Proxy object exported as `supabase` so existing imports continue to work
const supabase = createStubSupabase('Supabase not configured. Please add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your environment.');

// Helper: apply methods of real client onto the proxy object so callers get
// the real implementation after init. This mutates the exported proxy.
function adoptRealClient(realClient) {
 _realSupabase = realClient;
 try {
 // Copy enumerable properties (auth, from, channel, etc.)
		Object.keys(realClient).forEach((k) => {
			try {
				supabase[k] = realClient[k];
			} catch (e) {
				if (process.env.NODE_ENV === 'development') {
					// eslint-disable-next-line no-console
					console.debug('[supabase] copy property failed', { key: k, error: e && (e.message || e) });
				}
			}
		});
 // Also copy nested auth methods to ensure `supabase.auth.*` is the real functions
 if (realClient.auth && typeof realClient.auth === 'object') {
 supabase.auth = realClient.auth;
 }
 } catch (e) {
 if (process.env.NODE_ENV === 'development') {
 // eslint-disable-next-line no-console
 console.warn('[Supabase] adoptRealClient failed', e && e.message ? e.message : e);
 }
 }

 // Expose read-only global for diagnostics in development
		if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && !window._supabase) {
			try {
				Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false });
			} catch (err) {
				// eslint-disable-next-line no-console
				console.debug('[supabase] expose global failed', err && (err.message || err));
			}
			// eslint-disable-next-line no-console
			console.info('[supabase] client exposed globally as window._supabase');
		}
}

// Helper: propagate current session token to the global `api` axios instance
async function propagateTokenToApi(session) {
 try {
 if (typeof window === 'undefined') return;
 const api = window._api;
 if (!api) return;

 const anon = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
 || process.env.REACT_APP_SUPABASE_ANON_KEY
 || process.env.VITE_SUPABASE_ANON_KEY
 || process.env.SUPABASE_ANON_KEY;

 const token = session?.access_token || null;
 if (token) {
 api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
 } else {
 delete api.defaults.headers.common['Authorization'];
 }

 if (anon) {
 api.defaults.headers.common['apikey'] = anon;
 }
 } catch (e) {
 // non-fatal
 if (process.env.NODE_ENV === 'development') {
 // eslint-disable-next-line no-console
 console.debug('[supabase] propagateTokenToApi failed', e && e.message ? e.message : e);
 }
 }
}

// Async initializer. Call when you want to create the real Supabase client.
export async function initSupabase() {
 if (_realSupabase) return _realSupabase;

 // If an initialization is in-flight, await the same promise to avoid
 // creating multiple Supabase clients (which creates multiple GoTrue instances).
 if (_initPromise) return _initPromise;

 // Validate config early and return the stub when configuration is missing
 if (typeof window !== 'undefined' && looksLikePlaceholder(rawUrl)) {
 // eslint-disable-next-line no-console
 console.warn('[Supabase] VITE_SUPABASE_URL looks invalid or is a placeholder:', rawUrl);
 return supabase;
 }

 if (!rawUrl || !rawAnon) {
 // eslint-disable-next-line no-console
 console.warn('[Supabase] Missing SUPABASE URL or ANON KEY. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
 return supabase;
 }

 // Serialize initialization into a single promise so concurrent callers reuse it
 _initPromise = (async () => {
 try {
 // Dynamic import to avoid adding supabase to initial bundle
 const mod = await import('@supabase/supabase-js');
 const { createClient } = mod;
 const client = createClient(rawUrl, rawAnon, {
 auth: {
 persistSession: true,
 autoRefreshToken: true,
 detectSessionInUrl: true,
 storage: window.localStorage,
 storageKey: 'sb-auth-token',
 flowType: 'pkce' // Use PKCE flow (no cookies needed)
 },
 global: {
 // Override fetch to prevent credentials from being sent to Supabase
 // This avoids CORS conflicts when the backend returns Access-Control-Allow-Origin: '*'.
 // Use explicit 'omit' so cookies are not sent cross-origin (we rely on PKCE + localStorage).
 fetch: (url, options = {}) => {
 return fetch(url, {
 ...options,
 credentials: 'omit'
 });
 },
 headers: {
 'X-Client-Info': 'supabase-js-web'
 }
 },
 db: {
 schema: 'public'
 }
 });

 adoptRealClient(client);

 // Ensure realtime transport has the current token at init time.
 // Some app code may initialize the client before auth is hydrated from storage;
 // proactively read the configured storage key and set realtime auth if present.
 try {
 if (typeof window !== 'undefined' && client && client.realtime && typeof client.realtime.setAuth === 'function') {
 const raw = window.localStorage.getItem('sb-auth-token');
 if (raw) {
 try {
 const parsed = JSON.parse(raw);
 const t = parsed?.access_token || parsed?.accessToken || null;
 if (t) {
 try {
 client.realtime.setAuth(t);
 if (process.env.NODE_ENV === 'development') {
 console.info('[supabase] realtime auth seeded from storage');
 }
 } catch(e) { /* ignore */ }
 }
 } catch (e) {
 // ignore JSON parse errors
 }
 }
 }
 } catch (e) {
 // non-fatal
 }

 // Attach auth state listener to propagate tokens into axios/api wrapper
 // AND update Realtime connection auth when JWT refreshes
 try {
 if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
 client.auth.onAuthStateChange((_event, session) => {
 // session may be an object or { data: { session }} depending on SDK
 const s = session?.session || session;
 propagateTokenToApi(s);

 // Update Realtime connection auth when JWT refreshes
 try {
 const token = s?.access_token || null;
 if (client.realtime && typeof client.realtime.setAuth === 'function' && token) {
 client.realtime.setAuth(token);
 if (process.env.NODE_ENV === 'development') {
 // eslint-disable-next-line no-console
 console.info('[Supabase] Realtime auth token updated after session change');
 }
 }
 } catch (e) {
 if (process.env.NODE_ENV === 'development') {
 // eslint-disable-next-line no-console
 console.warn('[Supabase] Failed to update Realtime auth:', e && e.message ? e.message : e);
 }
 }
 });
 }
 // Also hydrate immediately
 try {
 const { data } = await client.auth.getSession();
 const s = data?.session || data;
 await propagateTokenToApi(s);
 } catch (e) {
 // ignore
 }
 } catch (e) {
 // ignore propagation failures
 }
 return _realSupabase;
 } catch (e) {
 if (process.env.NODE_ENV === 'development') {
 // eslint-disable-next-line no-console
 console.warn('[Supabase] dynamic import failed', e && e.message ? e.message : e);
 }
 // Reset init promise so future attempts can retry
 _initPromise = null;
 return supabase;
 }
 })();

 return _initPromise;
}

// Convenience wrappers using the current proxy/client
export async function signInWithPassword({ email, password }) {
 if (_realSupabase) return _realSupabase.auth.signInWithPassword({ email, password });
 try { return supabase.auth.signInWithPassword({ email, password }); } catch (e) { return { error: e }; }
}

export async function signUp({ email, password }) {
 if (_realSupabase) return _realSupabase.auth.signUp({ email, password });
 try { return supabase.auth.signUp({ email, password }); } catch (e) { return { error: e }; }
}

// Check whether a user has an active paid subscription.
// This function tries a few common patterns: a `billing_subscriptions` or `subscriptions`
// table linked by `user_id`, or a `user_metadata.subscription` property on the auth user.
// Returns boolean `true` if paid/active, otherwise `false`.
export async function isUserPaid(userId) {
 if (!userId) return false;
 try {
 // Ensure supabase initialized for querying
 await initSupabase();

 // Use the real client directly - _realSupabase is set by adoptRealClient after init
 if (!_realSupabase || !_realSupabase.from) {
 if (process.env.NODE_ENV === 'development') {
 console.warn('[isUserPaid] Supabase client not fully initialized yet');
 }
 return false;
 }

 // Verify client has the necessary configuration
 if (!_realSupabase.supabaseUrl || !_realSupabase.supabaseKey) {
 if (process.env.NODE_ENV === 'development') {
 console.warn('[isUserPaid] Supabase client missing URL or Key');
 }
 return false;
 }

 // Try common table names - stop when we find a positive match
 const tablesToTry = ['subscriptions', 'billing_subscriptions', 'stripe_subscriptions'];
 for (const table of tablesToTry) {
 try {
 // Only select status - that's all we need for paid check
 const { data, error } = await _realSupabase.from(table).select('status').eq('user_id', userId).maybeSingle();
 if (!error && data) {
 const status = (data.status || '').toLowerCase();
 if (status === 'active' || status === 'paid' || status === 'trialing') return true;
 }
		} catch (e) {
			// ignore and continue to next table, but log in development for diagnostics
			if (process.env.NODE_ENV === 'development') {
				// eslint-disable-next-line no-console
				console.debug('[supabase] table check failed', { table, error: e && (e.message || e) });
			}
		}
 }

 // Fallback: check auth user's user_metadata or app_metadata for subscription flags
 try {
 const { data: { user } } = await _realSupabase.auth.getUser();
 if (user && user.id === userId) {
 const metadata = user.user_metadata || user.app_metadata || {};
 if (metadata && (metadata.subscription === 'active' || metadata.paid === true || metadata.plan)) return true;
 }
	} catch (e) {
		if (process.env.NODE_ENV === 'development') {
			// eslint-disable-next-line no-console
			console.debug('[supabase] auth.getUser check failed', e && (e.message || e));
		}
	}

 return false;
 } catch (e) {
 return false;
 }
}

// ✅ Helper: Check if Supabase is properly configured
export function isSupabaseConfigured() {
 // Check if we have valid URL and anon key
 if (looksLikePlaceholder(rawUrl)) return false;
 if (!rawUrl || !rawAnon) return false;
 // Check if real client has been initialized (not just stub)
 return _realSupabase !== null;
}

export default supabase;
export { supabase };

// Development diagnostic: log which values were resolved (do not log secrets in CI)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
 try {
 const safeUrl = rawUrl || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || '<<missing>>';
 const hasAnon = !!(rawAnon || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
 // eslint-disable-next-line no-console
 console.info('[Supabase] resolved URL:', safeUrl, ' anonKeyPresent:', hasAnon);
	} catch (e) {
		if (process.env.NODE_ENV === 'development') {
			// eslint-disable-next-line no-console
			console.debug('[supabase] dev diagnostic failed', e && (e.message || e));
		}
	}
}
