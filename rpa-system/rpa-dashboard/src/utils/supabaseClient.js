import { createClient } from '@supabase/supabase-js';

// Prefer runtime-provided values (window._env) when available.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
const supabaseUrl = runtimeEnv.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

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
if (supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('...')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
} else {
  // Do not throw during development; allow runtime env to load
  console.warn('[Supabase] Missing REACT_APP_SUPABASE_URL/ANON_KEY. Using stub until runtime env is provided.');
  supabase = createStubSupabase();
}

export { supabase };

// Expose globally for diagnostics (read-only)
if (typeof window !== 'undefined' && !window._supabase) {
  Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false });
  // eslint-disable-next-line no-console
  console.info('[supabase] client exposed globally as window._supabase');
}
