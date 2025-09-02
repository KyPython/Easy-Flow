const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the same .env file your tests use
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

async function checkSupabaseConnection() {
  console.log('--- Supabase Admin Connection Check ---');

  if (!SUPABASE_URL) {
    console.error('🛑 ERROR: SUPABASE_URL is not set in your .env file.');
    return;
  }
  if (!SUPABASE_SERVICE_ROLE) {
    console.error('🛑 ERROR: SUPABASE_SERVICE_ROLE is not set in your .env file.');
    return;
  }

  console.log(`Attempting to connect to Supabase URL: ${SUPABASE_URL}`);
  // Mask the key for security
  console.log(`Using Service Role Key (masked): ...${SUPABASE_SERVICE_ROLE.slice(-6)}`);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const email = `test-debug-${Date.now()}@example.com`;
  const password = 'password123';

  let testUserId = null;

  try {
    console.log(`\nAttempting to create a test user with admin rights: ${email}`);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      console.error('\n🛑 FAILED to create user.');
      console.error('Supabase error object:', error);
      console.error('\n--- Troubleshooting ---');
      console.error('This is the generic API error. The REAL error is in your Supabase database logs.');
      console.error('The most likely cause is a problem with the `handle_new_user` trigger or the `profiles` table schema.');
      console.error('\n--- ACTION REQUIRED ---');
      console.error('1. Open your Supabase project dashboard in your browser.');
      console.error('2. In the left sidebar, click the "Logs" icon (it looks like a piece of paper).');
      console.error('3. From the dropdown menu at the top, select "Database".');
      console.error('4. Run this script again: `node backend/tests/debug-supabase.js`');
      console.error('5. Immediately after the script fails, look for a new RED error message in the Database Logs page.');
      console.error('6. Please provide that full, detailed error message. It will tell us the exact database problem.');
      return;
    }

    testUserId = data.user.id;
    console.log('\n✅ Successfully created user in `auth.users`:');
    console.log(data.user);

    console.log(`\nVerifying profile entry for user ID: ${testUserId}...`);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (profileError || !profileData) {
      console.error('\n🛑 FAILED to find a corresponding entry in the `public.profiles` table.');
      console.error('This confirms the database trigger that should copy the new user to the `profiles` table is missing or broken.');
      console.error('\n--- Recommended Action ---');
      console.error('Please go to the Supabase SQL Editor in your dashboard and run the schema setup script again.');
      return;
    }

    console.log('✅ Successfully found profile entry in `public.profiles`:');
    console.log(profileData);

    console.log('\n--- ✅ Supabase connection, user creation, and triggers are working correctly! ---');
  } catch (e) {
    if (e.cause?.code === 'ENOTFOUND') {
      console.error('\n🛑 A DNS lookup error occurred.');
      console.error(`Failed to resolve the hostname: ${e.cause.hostname}`);
      console.error('\n--- Troubleshooting ---');
      console.error('This is a network-level issue on your machine, not a Supabase API or database problem.');
      console.error('1. Check your internet connection.');
      console.error(`2. Open your terminal and try to ping the hostname: ping ${e.cause.hostname}`);
      console.error('3. Disable any VPNs or firewalls that might be blocking DNS lookups.');
      console.error('4. Try flushing your local DNS cache (see previous instructions for your OS).');
    } else {
      console.error('\n🛑 An unexpected error occurred:');
      console.error(e);
    }
  } finally {
    if (testUserId) {
      console.log(`\nCleaning up by deleting test user ID: ${testUserId}...`);
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
      console.log('✅ Successfully deleted the test user.');
    }
  }
}

checkSupabaseConnection();