const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// Prefer service role for server, else allow SUPABASE_KEY fallback, else anon
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_JWT = process.env.SUPABASE_JWT;

let supabase = null;

const key = SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY;
if (SUPABASE_URL && key) {
  supabase = createClient(SUPABASE_URL, key);
} else {
  console.warn('[backend/supabase] Client not initialized; missing SUPABASE_URL or key.');
}

module.exports = { supabase };
