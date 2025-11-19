import { createClient } from '@supabase/supabase-js';

// Prefer runtime-provided values (window._env) when available.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};

// Support multiple env var naming conventions (Vite uses VITE_, CRA uses REACT_APP_)
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL || runtimeEnv.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY || runtimeEnv.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function createStubSupabase() {
  const noop = async () => ({ data: null, error: new Error('Supabase not configured') });
  const from = () => ({
    select: noop,
    insert: noop,
    update: noop,
    upsert: noop,
    delete: noop,
    eq: () => ({ select: noop, update: noop, delete: noop })
  });
  return {
    from,
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
  getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
  signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Supabase not configured') }),
  signUp: async () => ({ data: { user: null, session: null }, error: new Error('Supabase not configured') }),
  resetPasswordForEmail: async () => ({ data: null, error: new Error('Supabase not configured') }),
  updateUser: async () => ({ data: null, error: new Error('Supabase not configured') }),
  resend: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signInWithOtp: noop,
      signOut: noop,
      onAuthStateChange: (cb) => {
        // Immediately invoke with a null session to keep app flows happy
        try { cb && cb('SIGNED_OUT', null); } catch (_) {}
        return { data: { subscription: { unsubscribe() {} } } };
      }
    }
  };
}

let supabase;

function looksLikePlaceholder(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return lower.includes('your-project') || lower.includes('example') || !lower.includes('.supabase.co');
}

function tryCreateClient() {
  try {
    const fetchImpl = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') ? globalThis.fetch.bind(globalThis) : undefined;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      // Provide platform fetch if available so client-side DNS/network errors are consistent
      fetch: fetchImpl
    });
  } catch (err) {
    console.warn('[Supabase] createClient failed:', err?.message || err);
    return null;
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing SUPABASE URL or ANON KEY. Using stub until runtime env is provided.');
  supabase = createStubSupabase();
} else if (looksLikePlaceholder(supabaseUrl)) {
  console.warn(`[Supabase] SUPABASE_URL looks like a placeholder: ${supabaseUrl}. Replace with your project ref (https://<project-ref>.supabase.co). Using stub.`);
  supabase = createStubSupabase();
} else {
  const client = tryCreateClient();
  if (client) {
    supabase = client;
  } else {
    supabase = createStubSupabase();
  }
}

// Allow runtime re-init if `window._env` is set after page load (e.g., server-side injection)
if (typeof window !== 'undefined') {
  window.__supabase_try_init = () => {
    try {
      const runtimeUrl = (window._env && (window._env.VITE_SUPABASE_URL || window._env.REACT_APP_SUPABASE_URL)) || window._env?.SUPABASE_URL;
      const runtimeKey = (window._env && (window._env.VITE_SUPABASE_ANON_KEY || window._env.REACT_APP_SUPABASE_ANON_KEY)) || window._env?.SUPABASE_ANON_KEY;
      if (runtimeUrl && runtimeKey && !looksLikePlaceholder(runtimeUrl)) {
        const client = createClient(runtimeUrl, runtimeKey, { fetch: (globalThis.fetch || undefined) });
        if (client) {
          // Replace exported supabase reference by mutating the object (not ideal, but simple)
          supabase = client;
          // Also expose to window for diagnostics
          try { Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false }); } catch (_) {}
          console.info('[Supabase] Runtime client initialized from window._env');
          return true;
        }
      }
    } catch (e) { console.debug('Runtime supabase init failed', e); }
    return false;
  };
}

export { supabase };

// Expose globally for diagnostics (read-only)
if (typeof window !== 'undefined' && !window._supabase) {
  Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false });
  // eslint-disable-next-line no-console
  console.info('[supabase] client exposed globally as window._supabase');
}
