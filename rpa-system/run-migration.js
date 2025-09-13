#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function runMigration() {
  try {
    console.log('🚀 Running database migration...');
    
    const migrationPath = path.join(__dirname, 'database/migrations/007-missing-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    
    // Split the SQL by statements to handle them individually
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => stmt + ';');
    
    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`📝 Statement ${i + 1}/${statements.length}`);
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: statement 
      });
      
      if (error) {
        // If the RPC doesn't exist, try direct execution
        if (error.code === '42883') {
          console.log('⚠️  exec_sql RPC not available, trying alternative method...');
          // For now, we'll output the SQL for manual execution
          console.log('Please execute this SQL manually in the Supabase SQL editor:');
          console.log('----------------------------------------');
          console.log(migrationSQL);
          console.log('----------------------------------------');
          return;
        }
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        console.error('Statement:', statement.substring(0, 100) + '...');
        throw error;
      }
      
      if (data) {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Please run this SQL manually in the Supabase SQL editor:');
    console.log('----------------------------------------');
    const migrationPath = path.join(__dirname, 'database/migrations/007-missing-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('----------------------------------------');
    process.exit(1);
  }
}

runMigration();