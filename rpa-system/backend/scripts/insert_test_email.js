
const { logger, getLogger } = require('../utils/logger');
require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
(async () => {
  const email = { to_email: 'test@example.com', template: 'welcome', data: { foo: 'bar' }, scheduled_at: new Date().toISOString(), status: 'pending' };
  const { data, error } = await s.from('email_queue').insert([email]).select();
  logger.info({ data, error });
  process.exit(0);
})();