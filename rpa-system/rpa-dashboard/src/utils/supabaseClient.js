import { createClient } from '@supabase/supabase-js';

// Prefer runtime-provided values (window._env) when available.
const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};

// Gather env values with fallbacks for various bundlers
const rawUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  || runtimeEnv.VITE_SUPABASE_URL
  || runtimeEnv.REACT_APP_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || process.env.REACT_APP_SUPABASE_URL
  || process.env.SUPABASE_URL;

const rawAnon = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
  || runtimeEnv.VITE_SUPABASE_ANON_KEY
  || runtimeEnv.REACT_APP_SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || process.env.REACT_APP_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY;

function looksLikePlaceholder(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return lower.includes('your-project') || lower.includes('example') || !lower.includes('.supabase.co');
}

function createStubSupabase(reasonMessage) {
  const errorResult = async () => ({ error: new Error(reasonMessage) });

  const auth = {
    signInWithPassword: async () => ({ error: new Error(reasonMessage) }),
    signUp: async () => ({ error: new Error(reasonMessage) }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    resetPasswordForEmail: async () => ({ error: new Error(reasonMessage) }),
    resend: async () => ({ error: new Error(reasonMessage) }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  };

  const from = () => ({
    select: errorResult,
    insert: errorResult,
    update: errorResult,
    delete: errorResult
  });

  // Minimal stub that won't crash callers during render
  return {
    auth,
    from,
    // helper no-op for realtime/listeners
    channel: () => ({ subscribe: async () => ({ error: new Error(reasonMessage) }) })
  };
}

// If configuration looks wrong, warn but do not throw during module import — export a stub so UI can render.
let supabase;
if (typeof window !== 'undefined' && looksLikePlaceholder(rawUrl)) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] VITE_SUPABASE_URL looks invalid or is a placeholder:', rawUrl);
  supabase = createStubSupabase('Supabase not configured: invalid VITE_SUPABASE_URL. Set VITE_SUPABASE_URL to https://<project-ref>.supabase.co and VITE_SUPABASE_ANON_KEY to your anon key in .env.local and restart the dev server.');
} else if (!rawUrl || !rawAnon) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Missing SUPABASE URL or ANON KEY. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  supabase = createStubSupabase('Supabase not configured: missing URL or anon key.');
} else {
  supabase = createClient(rawUrl, rawAnon, {
    auth: { persistSession: true },
    fetch: (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') ? globalThis.fetch.bind(globalThis) : undefined
  });
}

// Development diagnostic: log which values were resolved (do not log secrets in CI)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  try {
    const safeUrl = rawUrl || process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || '<<missing>>';
    const hasAnon = !!(rawAnon || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
    // eslint-disable-next-line no-console
    console.info('[Supabase] resolved URL:', safeUrl, ' anonKeyPresent:', hasAnon);
  } catch (e) {}
}

// Named helper wrappers with clearer errors for call sites
export async function signInWithPassword({ email, password }) {
  if (!supabase) return { error: new Error('Supabase client unavailable') };
  // If stub, this will return an error-shaped result rather than throwing
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp({ email, password }) {
  if (!supabase) return { error: new Error('Supabase client unavailable') };
  return supabase.auth.signUp({ email, password });
}

export default supabase;
// Also provide a named export `supabase` for compatibility with many files
export { supabase };

// Expose globally for diagnostics (read-only) in dev
if (typeof window !== 'undefined' && !window._supabase) {
  try { Object.defineProperty(window, '_supabase', { value: supabase, writable: false, configurable: false }); } catch (_) {}
  // eslint-disable-next-line no-console
  console.info('[supabase] client exposed globally as window._supabase');
}
