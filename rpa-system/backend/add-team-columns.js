#!/usr/bin/env node
/**
 * Add team management columns via direct SQL execution
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' }
});

async function addColumns() {
  try {
    console.log('🔧 Adding team management columns to profiles table...\n');

    // Since we can't execute raw SQL directly, we'll check if columns exist
    // by trying to select them

    console.log('Step 1: Checking current schema...');
    const { data: checkData, error: checkError } = await supabase
      .from('profiles')
      .select('id, email, role, organization_id')
      .limit(1);

    if (checkError) {
      if (checkError.message.includes('role') || checkError.message.includes('organization_id')) {
        console.log('⚠️  Columns do not exist yet. Please run the following SQL in your Supabase SQL Editor:\n');
        console.log('----------------------------------------');
        console.log(`
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text CHECK (role IN ('owner', 'admin', 'member')),
ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id 
ON public.profiles(organization_id);

UPDATE public.profiles 
SET role = 'owner'
WHERE email = 'kyjahntsmith@gmail.com'
AND role IS NULL;
        `);
        console.log('----------------------------------------\n');
        console.log('After running the SQL, try inviting a team member again.');
        console.log('\n📍 Access Supabase SQL Editor at:');
        console.log(`   ${supabaseUrl.replace('//', '//app.')}/project/_/sql`);
        process.exit(0);
      }
      throw checkError;
    }

    console.log('✅ Columns already exist!');
    console.log('\n📋 Current user data:');

    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('email, role, organization_id')
      .eq('email', 'kyjahntsmith@gmail.com')
      .single();

    if (userError) throw userError;

    console.log(userData);

    if (!userData.role) {
      console.log('\n🔧 Setting user role to owner...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'owner' })
        .eq('email', 'kyjahntsmith@gmail.com');

      if (updateError) throw updateError;
      console.log('✅ User is now an owner!');
    } else {
      console.log(`✅ User already has role: ${userData.role}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addColumns();
