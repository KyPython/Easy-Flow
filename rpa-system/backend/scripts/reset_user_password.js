
const { logger, getLogger } = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

// ...existing code...
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EMAIL = 'test-api@local.dev';
const NEW_PW = 'TestPass123!';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !SUPABASE_ANON_KEY) {
 logger.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE or SUPABASE_ANON_KEY missing in backend/.env');
 process.exit(1);
}

(async () => {
 const listUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`;
 const listResp = await fetch(listUrl, {
 method: 'GET',
 headers: {
 Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
 apikey: SUPABASE_ANON_KEY,
 'Content-Type': 'application/json'
 }
 });
 const listBody = await listResp.json();
 if (!Array.isArray(listBody) || listBody.length === 0) {
 logger.error('User not found for email:', EMAIL, 'response:', listBody);
 process.exit(1);
 }
 const userId = listBody[0].id;
 logger.info('found user id:', userId);

 const updateUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`;
 const updateResp = await fetch(updateUrl, {
 method: 'PUT',
 headers: {
 Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
 apikey: SUPABASE_ANON_KEY,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ password: NEW_PW })
 });
 const updateText = await updateResp.text();
 logger.info('update status', updateResp.status);
 try { logger.info(JSON.parse(updateText)); } catch (e) { logger.info(updateText); }
})();
