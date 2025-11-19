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

// Fail fast with a clear error in dev when configuration is missing or clearly incorrect
if (typeof window !== 'undefined' && looksLikePlaceholder(rawUrl)) {
  // eslint-disable-next-line no-console
  console.error('[Supabase] VITE_SUPABASE_URL looks invalid or is a placeholder:', rawUrl);
  throw new Error(`Supabase not configured: VITE_SUPABASE_URL looks invalid ("${rawUrl}"). Set VITE_SUPABASE_URL to your project URL (https://<project-ref>.supabase.co) and VITE_SUPABASE_ANON_KEY to the anon key in .env.local and restart the dev server.`);
}

if (!rawUrl || !rawAnon) {
  // eslint-disable-next-line no-console
  console.error('[Supabase] Missing SUPABASE URL or ANON KEY. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  throw new Error('Supabase not configured: missing URL or anon key.');
}

const supabase = createClient(rawUrl, rawAnon, {
  auth: { persistSession: true },
  fetch: (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') ? globalThis.fetch.bind(globalThis) : undefined
});

// Named helper wrappers with clearer errors for call sites
export async function signInWithPassword({ email, password }) {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp({ email, password }) {
  if (!supabase) throw new Error('Supabase not configured');
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
