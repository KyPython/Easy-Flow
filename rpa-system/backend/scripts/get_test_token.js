
const { logger } = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL) {
 logger.error('SUPABASE_URL is empty. Check backend/.env');
 process.exit(1);
}

async function run() {
 // create user (ignore errors if already exists)
 try {
 await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ email: 'test-api@local.dev', password: 'TestPass123!' })
 });
 } catch (e) {
 // ignore network/errors for create step
 }

 // sign in to get token
 const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
 method: 'POST',
 headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
 body: JSON.stringify({ email: 'test-api@local.dev', password: 'TestPass123!' })
 });

 const body = await resp.text();
 let json;
 try { json = JSON.parse(body); } catch (e) { logger.error('Non-JSON response:', body); process.exit(1); }

 logger.info('status', resp.status);
 logger.info(json);
 if (json.access_token) {
 logger.info('\nRun this to set TOKEN in your shell:');
 logger.info('export TOKEN="' + json.access_token + '"');
 } else {
 logger.error('No access_token returned; inspect the status/body above.');
 process.exit(1);
 }
}

run().catch(e => { logger.error(e); process.exit(1); });
