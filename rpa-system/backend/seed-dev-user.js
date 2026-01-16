const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in backend/.env');
  console.error('   Please ensure your backend/.env file is configured correctly.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001';
const DEV_EMAIL = 'developer@localhost';
const DEV_PASSWORD = 'dev-password-123'; // Default password for dev user

async function seed() {
  console.log(`🌱 Seeding dev environment...`);
  console.log(`   User ID: ${DEV_USER_ID}`);
  console.log(`   Email:   ${DEV_EMAIL}`);

  // 1. Ensure User in auth.users
  try {
    // Try to get the user first
    const { data: { user }, error: findError } = await supabase.auth.admin.getUserById(DEV_USER_ID);
    
    if (!user) {
      console.log('   Creating auth user...');
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        id: DEV_USER_ID,
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { name: 'Local Developer' }
      });
      
      if (createError) {
        // If error is "User already registered", we might have missed it in getUserById or it's a soft delete issue
        if (createError.message.includes('already registered')) {
             console.log('   ✅ Auth user already exists (caught in creation).');
        } else {
             throw new Error(`Failed to create auth user: ${createError.message}`);
        }
      } else {
        console.log('   ✅ Auth user created.');
      }
    } else {
      console.log('   ✅ Auth user already exists.');
    }
  } catch (e) {
    console.error('   ❌ Error checking/creating auth user:', e.message);
  }

  // 2. Ensure Profile in public.profiles
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', DEV_USER_ID)
      .maybeSingle();

    if (!profile) {
      console.log('   Creating public profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: DEV_USER_ID,
          email: DEV_EMAIL,
          created_at: new Date().toISOString(),
          role: 'owner' // Ensure dev user has owner role
        }]);

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
      console.log('   ✅ Public profile created.');
    } else {
      console.log('   ✅ Public profile already exists.');
      // Ensure role is owner
      await supabase.from('profiles').update({ role: 'owner' }).eq('id', DEV_USER_ID);
    }
  } catch (e) {
    console.error('   ❌ Error checking/creating profile:', e.message);
  }

  // 3. Seed Plans (if missing)
  try {
      const { count } = await supabase.from('plans').select('*', { count: 'exact', head: true });
      if (count === 0) {
          console.log('   Seeding default plans...');
          const plans = [
              { id: 'hobbyist', name: 'Hobbyist', monthly_cost: 0, features: { max_workflows: 5 } },
              { id: 'professional', name: 'Professional', monthly_cost: 29, features: { max_workflows: -1 } },
              { id: 'enterprise', name: 'Enterprise', monthly_cost: 99, features: { max_workflows: -1 } }
          ];
          const { error } = await supabase.from('plans').insert(plans);
          if (error) console.error('   ❌ Failed to seed plans:', error.message);
          else console.log('   ✅ Plans seeded.');
      } else {
          console.log('   ✅ Plans table already populated.');
      }
  } catch (e) {
      console.error('   ❌ Error checking plans:', e.message);
  }

  // 4. Ensure Subscription (if missing)
  try {
      const { data: sub } = await supabase.from('subscriptions').select('id').eq('user_id', DEV_USER_ID).maybeSingle();
      if (!sub) {
          console.log('   Creating default subscription...');
          // Get professional plan id
          const { data: plan } = await supabase.from('plans').select('id').eq('id', 'professional').maybeSingle();
          const planId = plan ? plan.id : 'professional';
          
          const { error: subError } = await supabase.from('subscriptions').insert([{
              user_id: DEV_USER_ID,
              plan_id: planId,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
          }]);
          if (subError) console.error('   ❌ Failed to create subscription:', subError.message);
          else console.log('   ✅ Default subscription created.');
      } else {
          console.log('   ✅ Subscription already exists.');
      }
  } catch (e) {
      console.error('   ❌ Error checking subscription:', e.message);
  }

  console.log('\n✨ Dev environment seeding complete!');
}

seed();