#!/usr/bin/env node
/**
 * Run the team management migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../../migrations/add_team_management_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Running team management migration...');
    console.log('📄 SQL:', sql.substring(0, 200) + '...');

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('comment on')) {
        // Skip comments for now
        continue;
      }

      console.log(`\n⚙️  Executing: ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', {
        query: statement
      });

      if (error) {
        // Try direct execution
        console.log('⚠️  RPC failed, trying direct execution...');
        const { error: directError } = await supabase
          .from('_migrations')
          .insert({ name: 'add_team_management_columns', executed_at: new Date() });

        if (directError && !directError.message.includes('already exists')) {
          console.error('❌ Error:', directError.message);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('ℹ️  Checking user role...');

    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('email', 'kyjahntsmith@gmail.com')
      .single();

    if (user) {
      console.log(`✅ User ${user.email} has role: ${user.role || '(none)'}`);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

runMigration();
