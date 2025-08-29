// Simple test script to trigger Supabase resend for signup emails
// Usage: node resend_test.js youremail@example.com

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env from rpa-dashboard if present
const envPath = path.resolve(__dirname, '..', 'rpa-dashboard', '.env');
let env = {};
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  });
}

const SUPABASE_URL = env.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase URL/ANON key in rpa-dashboard/.env or environment');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node resend_test.js email@example.com');
    process.exit(1);
  }

  try {
    const { data, error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      console.error('Error from Supabase:', error);
      process.exit(1);
    }
    console.log('Resend accepted:', data);
  } catch (err) {
    console.error('Exception:', err.message || err);
    process.exit(1);
  }
}

run();
