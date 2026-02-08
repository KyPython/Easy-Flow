const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Use structured logging
const { createLogger } = require('./middleware/structuredLogging');
const logger = createLogger('seed-dev-user');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in backend/.env');
  logger.error('Please ensure your backend/.env file is configured correctly.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001';
const DEV_EMAIL = 'developer@localhost';
const DEV_PASSWORD = 'dev-password-123'; // Default password for dev user

async function seed() {
  logger.info({ userId: DEV_USER_ID, email: DEV_EMAIL }, 'Seeding dev environment');

  // 1. Ensure User in auth.users
  try {
    // Try to get the user first
    const { data: { user }, error: findError } = await supabase.auth.admin.getUserById(DEV_USER_ID);

    if (!user) {
      logger.info('Creating auth user');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        id: DEV_USER_ID,
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { name: 'Local Developer' }
      });

      if (createError) {
        if (createError.message.includes('already registered')) {
             logger.info('Auth user already exists (caught in creation).');
        } else {
             throw new Error(`Failed to create auth user: ${createError.message}`);
        }
      } else {
        logger.info('Auth user created.');
      }
    } else {
      logger.info('Auth user already exists.');
    }
  } catch (e) {
    logger.error({ error: e.message }, 'Error checking/creating auth user');
  }

  // 2. Ensure Profile in public.profiles
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', DEV_USER_ID)
      .maybeSingle();

    if (!profile) {
      logger.info('Creating public profile');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: DEV_USER_ID,
          email: DEV_EMAIL,
          created_at: new Date().toISOString(),
          role: 'owner'
        }]);

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
      logger.info('Public profile created.');
    } else {
      logger.info('Public profile already exists.');
      await supabase.from('profiles').update({ role: 'owner' }).eq('id', DEV_USER_ID);
    }
  } catch (e) {
    logger.error({ error: e.message }, 'Error checking/creating profile');
  }

  // 3. Seed Plans (if missing)
  try {
      const { count } = await supabase.from('plans').select('*', { count: 'exact', head: true });
      if (count === 0) {
          logger.info('Seeding default plans');
          const plans = [
              { id: 'hobbyist', name: 'Hobbyist', monthly_cost: 0, features: { max_workflows: 5 } },
              { id: 'professional', name: 'Professional', monthly_cost: 29, features: { max_workflows: -1 } },
              { id: 'enterprise', name: 'Enterprise', monthly_cost: 99, features: { max_workflows: -1 } }
          ];
          const { error } = await supabase.from('plans').insert(plans);
          if (error) logger.error({ error: error.message }, 'Failed to seed plans');
          else logger.info('Plans seeded.');
      } else {
          logger.info('Plans table already populated.');
      }
  } catch (e) {
      logger.error({ error: e.message }, 'Error checking plans');
  }

  // 4. Ensure Subscription (if missing)
  try {
      const { data: sub } = await supabase.from('subscriptions').select('id').eq('user_id', DEV_USER_ID).maybeSingle();
      if (!sub) {
          logger.info('Creating default subscription');
          const { data: plan } = await supabase.from('plans').select('id').eq('id', 'professional').maybeSingle();
          const planId = plan ? plan.id : 'professional';

          const { error: subError } = await supabase.from('subscriptions').insert([{
              user_id: DEV_USER_ID,
              plan_id: planId,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
          }]);
          if (subError) logger.error({ error: subError.message }, 'Failed to create subscription');
          else logger.info('Default subscription created.');
      } else {
          logger.info('Subscription already exists.');
      }
  } catch (e) {
      logger.error({ error: e.message }, 'Error checking subscription');
  }

  logger.info('Dev environment seeding complete!');
}

seed();
