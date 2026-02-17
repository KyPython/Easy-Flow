
const { logger } = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

// ...existing code...
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EMAIL = 'test-api@local.dev';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !SUPABASE_ANON_KEY) {
 logger.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE or SUPABASE_ANON_KEY missing in backend/.env');
 process.exit(1);
}

(async () => {
 const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`;
 const resp = await fetch(url, {
 method: 'GET',
 headers: {
 Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
 apikey: SUPABASE_ANON_KEY,
 'Content-Type': 'application/json'
 }
 });
 const text = await resp.text();
 logger.info('status', resp.status);
 try { logger.info(JSON.parse(text)); } catch (e) { logger.info(text); }
})();
