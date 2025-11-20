
const { logger, getLogger } = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const EMAIL = 'test-api@local.dev';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
  logger.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE in backend/.env');
  process.exit(1);
}

(async () => {
  try {
    const base = SUPABASE_URL.replace(/\/$/, '');
    const listUrl = `${base}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`;
    const listResp = await fetch(listUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    const listBody = await listResp.json();

    // Support both response shapes: array OR { users: [...] }
    let users = [];
    if (Array.isArray(listBody)) users = listBody;
    else if (listBody && Array.isArray(listBody.users)) users = listBody.users;

    if (!users || users.length === 0) {
      logger.error('User not found for email:', EMAIL, 'response:', listBody);
      process.exit(1);
    }

    // find exact match just in case
    const user = users.find(u => (u.email || '').toLowerCase() === EMAIL.toLowerCase()) || users[0];
    const userId = user.id;
    logger.info('found user id:', userId, 'email_confirmed_at:', user.email_confirmed_at || null);

    const updateUrl = `${base}/auth/v1/admin/users/${userId}`;
    const now = new Date().toISOString();
    const updateResp = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email_confirmed_at: now, confirmed_at: now })
    });

    const updateBodyText = await updateResp.text();
    try {
      const updateBody = JSON.parse(updateBodyText);
      logger.info('update status', updateResp.status, updateBody);
    } catch (e) {
      logger.info('update status', updateResp.status, updateBodyText);
    }
  } catch (e) {
    logger.error('error', e.message || e);
    process.exit(1);
  }
})();