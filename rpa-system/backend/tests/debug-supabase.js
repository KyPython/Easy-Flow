const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the same .env file your tests use
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

async function checkSupabaseConnection() {
  console.log('--- Supabase Connection Check ---');

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

  console.log('\nAttempting a read-only operation (listUsers) to verify credentials...');

  try {
    // Using `listUsers` with a limit of 1 is a safe, read-only way to test
    // if the service_role key is valid. It requires admin privileges.
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      console.error('\n🛑 FAILED to connect and authenticate with Supabase.');
      console.error('Supabase error object:', error); // Log the full error object for more details

      console.error('\n--- Troubleshooting ---');
      console.error('1. Is your Supabase project running? Check your dashboard at https://app.supabase.com.');
      console.error(`2. Is the SUPABASE_URL in your .env file correct? It should be something like "https://<project-ref>.supabase.co".`);
      console.error('3. Is the SUPABASE_SERVICE_ROLE key correct? It must be the "service_role" key, NOT the "anon" key. You can find it in your Supabase project settings under API.');
      console.error('4. Is there a network issue (firewall, proxy) preventing connection to Supabase?');
      console.error('5. Have you run the database schema setup script to create the `profiles` table and its trigger? An incorrect schema can cause auth errors.');
      return;
    }

    console.log('\n✅ Successfully authenticated with the Supabase admin API.');
    console.log(`Found ${data.users.length} user(s) in the project (queried for 1).`);
    console.log('\n--- ✅ Supabase connection and admin rights are working correctly! ---');
  } catch (e) {
    console.error('\n🛑 An unexpected error occurred:');
    console.error(e);
  }
}

checkSupabaseConnection();