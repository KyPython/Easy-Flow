const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  // Silent exit if no credentials (dev mode without db)
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fixSchema() {
  try {
    // Check if 'steps' column exists in workflows table
    const { error } = await supabase
      .from('workflows')
      .select('steps')
      .limit(1);

    // If column missing (error 42703 or similar), try to add it
    if (error && (error.code === '42703' || error.message.includes('does not exist'))) {
      console.log('🔧 Auto-fixing schema: Adding missing "steps" column to workflows table...');

      const { error: rpcError } = await supabase.rpc('exec_sql', {
        query: 'ALTER TABLE workflows ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT \'[]\'::jsonb;'
      });

      if (!rpcError) {
        console.log('✅ Schema fixed: "steps" column added.');
      }
    }
  } catch (e) {
    // Ignore errors, this is a best-effort auto-fix
  }
}

fixSchema();
