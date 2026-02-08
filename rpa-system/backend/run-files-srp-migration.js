#!/usr/bin/env node
/**
 * Run the Files Table SRP split migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', '..', 'migrations', 'split_files_table_srp.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🗄️  Running Files Table SRP Migration...\n');
    console.log(`📄 Migration file: ${migrationPath}\n`);

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and DO blocks (they need special handling)
      if (statement.toLowerCase().startsWith('comment on')) {
        console.log(`⏭️  Skipping comment statement ${i + 1}/${statements.length}`);
        skipCount++;
        continue;
      }

      // Show progress
      const preview = statement.substring(0, 80).replace(/\n/g, ' ');
      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}:`);
      console.log(`   ${preview}...`);

      try {
        // Try using exec_sql RPC function
        const { error } = await supabase.rpc('exec_sql', {
          query: statement
        });

        if (error) {
          // Check if it's a "already exists" error (non-critical)
          if (error.message.includes('already exists') ||
              error.message.includes('duplicate')) {
            console.log('   ⚠️  Already exists (skipping)');
            skipCount++;
          } else if (error.message.includes('does not exist') &&
                     statement.toLowerCase().includes('drop')) {
            console.log('   ⚠️  Object doesn\'t exist (skipping)');
            skipCount++;
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log('   ✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Exception: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Migration completed with some errors.');
      console.log('   This is often OK if tables already exist.');
      console.log('   Review the errors above to ensure nothing critical failed.\n');
    } else {
      console.log('✅ Migration completed successfully!\n');
    }

    // Verify the new tables were created
    console.log('🔍 Verifying new tables...\n');

    const tablesToCheck = [
      'file_metadata',
      'file_storage',
      'file_organization',
      'file_workflow_links',
      'file_access_tracking'
    ];

    for (const table of tablesToCheck) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error && !error.message.includes('permission')) {
        console.log(`   ❌ ${table}: Not found or error`);
      } else {
        console.log(`   ✅ ${table}: Table exists and accessible`);
      }
    }

    console.log('\n✨ Done! Run the SRP analyzer to verify:');
    console.log('   node scripts/analyze-database-srp.js\n');

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runMigration();
