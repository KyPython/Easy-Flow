#!/usr/bin/env node
/**
 * Run a SQL migration file against Supabase
 * Usage: node scripts/run-migration.js migrations/add_notion_integration.sql
 */

const fs = require('fs');
const path = require('path');
const { getSupabase } = require('../utils/supabaseClient');

async function runMigration(migrationFile) {
  const migrationPath = path.resolve(__dirname, '..', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📄 Running migration: ${migrationFile}`);
  console.log('─'.repeat(60));

  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Supabase client not configured');
    process.exit(1);
  }

  try {
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log(`\n▶ Executing: ${statement.substring(0, 60)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
          // Try direct query if RPC doesn't exist
          const { error: queryError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0);

          if (queryError && queryError.code === 'PGRST116') {
            // Table doesn't exist, try executing via raw query
            console.log('⚠️  Note: Some constraints may need to be run directly in Supabase SQL Editor');
            console.log('   Please run this migration in Supabase Dashboard → SQL Editor');
            console.log('\nSQL to run:');
            console.log('─'.repeat(60));
            console.log(sql);
            console.log('─'.repeat(60));
            process.exit(0);
          }

          // If it's a constraint error, it might already exist - that's okay
          if (error.message.includes('already exists') || error.message.includes('does not exist')) {
            console.log(`⚠️  ${error.message} (this may be expected)`);
          } else {
            throw error;
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file>');
  console.error('Example: node scripts/run-migration.js migrations/add_notion_integration.sql');
  process.exit(1);
}

runMigration(migrationFile).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

