
const { logger } = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
 logger.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE in backend/.env');
 process.exit(1);
}

const EMAIL = 'test-api@local.dev';
const PASSWORD = 'TestPass123!';

async function run() {
 const base = SUPABASE_URL.replace(/\/$/, '');

 // Create user (admin) - ignore 409 if already exists
 try {
 const resp = await fetch(`${base}/auth/v1/admin/users`, {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
 apikey: SUPABASE_ANON_KEY,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ email: EMAIL, password: PASSWORD })
 });
 const txt = await resp.text();
 let j;
 try { j = JSON.parse(txt); } catch(e){ j = txt; }
 logger.info('create user status', resp.status, j);
 } catch (e) {
 logger.error('create user request failed', e.message || e);
 }

 // Request token (password grant)
 try {
 const tokenResp = await fetch(`${base}/auth/v1/token?grant_type=password`, {
 method: 'POST',
 headers: {
 apikey: SUPABASE_ANON_KEY,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ email: EMAIL, password: PASSWORD })
 });
 const tokenJson = await tokenResp.json();
 logger.info('token status', tokenResp.status, tokenJson);
 if (tokenJson.access_token) {
 logger.info('\nEXPORT THIS TOKEN for API calls:');
 logger.info('export TOKEN="' + tokenJson.access_token + '"');
 } else {
 logger.error('No access_token returned. Inspect the response above.');
 process.exit(1);
 }
 } catch (e) {
 logger.error('token request failed', e.message || e);
 process.exit(1);
 }
}

run();
