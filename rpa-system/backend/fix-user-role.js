#!/usr/bin/env node
/**
 * Quick fix: Assign owner role to the current user
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUserRole() {
  try {
    console.log('🔧 Looking for user kyjahntsmith@gmail.com...');

    // Find the user
    const { data: profiles, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', 'kyjahntsmith@gmail.com')
      .limit(1);

    if (searchError) {
      console.error('❌ Error searching for user:', searchError.message);
      process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
      console.log('ℹ️  User not found. Trying to find all users...');

      const { data: allProfiles, error: allError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .limit(5);

      if (allError) {
        console.error('❌ Error listing users:', allError.message);
      } else {
        console.log('📋 Found users:', allProfiles);
      }
      process.exit(1);
    }

    const user = profiles[0];
    console.log('✅ Found user:', {
      id: user.id,
      email: user.email,
      current_role: user.role || '(none)',
      organization_id: user.organization_id || '(none)'
    });

    if (user.role === 'owner') {
      console.log('✅ User already has owner role!');
      process.exit(0);
    }

    // Update to owner role
    console.log('🔧 Setting user role to "owner"...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating user role:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Successfully set user role to owner!');
    console.log('ℹ️  You can now invite team members.');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

fixUserRole();
