const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

let supabaseInstance = null;

function isSupabaseConfigured() {
 return !!(SUPABASE_URL && SUPABASE_KEY);
}

function getSupabase() {
 if (!isSupabaseConfigured()) return null;
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
 isSupabaseConfigured
};
