const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

let supabaseInstance = null;
let supabaseReconnecting = false;

function isSupabaseConfigured() {
 return !!(SUPABASE_URL && SUPABASE_KEY);
}

// Check if Supabase is accessible (for auto-fallback logic)
async function isSupabaseAccessible() {
 if (!SUPABASE_URL || !SUPABASE_KEY) return false;

 try {
  const testClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await testClient.from('plans').select('id').limit(1).maybeSingle();
  // Ignore specific errors, just check if we got a response
  return !error || error.code !== 'PGRST301';
 } catch (e) {
  return false;
 }
}

function getSupabase() {
 if (!isSupabaseConfigured()) {
  logger.warn('[supabaseClient] Supabase not configured - will use fallback mode');
  return null;
 }

 if (!supabaseInstance) {
  try {
   supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
   logger.info('[supabaseClient] Supabase client initialized');
  } catch (err) {
   logger.error('[supabaseClient] Failed to initialize Supabase client', err?.message || err);
   supabaseInstance = null;
  }
 }
 return supabaseInstance;
}

// Retry wrapper for Supabase operations with fallback
async function getSupabaseWithRetry(maxRetries = 3, delayMs = 1000) {
 if (supabaseReconnecting) {
  logger.warn('[supabaseClient] Already attempting to reconnect, skipping');
  return supabaseInstance;
 }

 supabaseReconnecting = true;
 let lastError = null;

 for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
   const client = getSupabase();
   if (!client) {
    // Not configured, return null
    break;
   }

   // Test the connection
   const { error } = await client.from('plans').select('id').limit(1).maybeSingle();

   if (!error || error.code !== 'PGRST301') {
    supabaseReconnecting = false;
    return client;
   }

   lastError = error;
  } catch (e) {
   lastError = e;
  }

  if (attempt < maxRetries - 1) {
   logger.warn(`[supabaseClient] Supabase connection attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
   await new Promise(resolve => setTimeout(resolve, delayMs));
  }
 }

 supabaseReconnecting = false;

 if (lastError) {
  logger.error('[supabaseClient] All retry attempts failed:', lastError?.message || lastError);
 }

 return supabaseInstance;
}

function getSupabaseOrThrow() {
 const client = getSupabase();
 if (!client) {
  throw new Error('Supabase client not configured. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE (or SUPABASE_KEY) are set.');
 }
 return client;
}

module.exports = {
 getSupabase,
 getSupabaseOrThrow,
 getSupabaseWithRetry,
 isSupabaseConfigured,
 isSupabaseAccessible
};
