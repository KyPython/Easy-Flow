#!/usr/bin/env node
/**
 * Run the boundary enforcement migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// Use structured logging
const { createLogger } = require('./middleware/structuredLogging');
const logger = createLogger('migration');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials');
  logger.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations/add_boundary_enforcement_tables.sql');
    
    if (!fs.existsSync(migrationPath)) {
      logger.error({ migrationPath }, 'Migration file not found');
      process.exit(1);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    logger.info({ migrationPath }, 'Running boundary enforcement migration');
    
    // Check if tables already exist
    const { data: existingTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_boundary_state', 'error_resolutions', 'boundary_enforcement_log']);
    
    if (existingTables && existingTables.length > 0) {
      logger.info({ tables: existingTables.map(t => t.table_name) }, 'Tables already exist, checking if migration needed...');
    }
    
    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    let executed = 0;
    let skipped = 0;
    
    for (const statement of statements) {
      if (statement.length < 10) continue;
      
      logger.debug({ statement: statement.substring(0, 60).replace(/\s+/g, ' ') }, 'Executing');
      
      // Try to execute via exec_sql RPC if available
      try {
        const { error } = await supabase.rpc('exec_sql', {
          query: statement
        });
        
        if (error) {
          // Table might already exist
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            skipped++;
            logger.debug('Statement skipped (already exists)');
          } else {
            logger.warn({ error: error.message, statement: statement.substring(0, 50) }, 'Statement failed');
          }
        } else {
          executed++;
        }
      } catch (rpcError) {
        // RPC not available, try direct query
        logger.warn({ error: rpcError.message }, 'RPC not available, migration requires manual execution');
        logger.info('Please run the SQL migration manually via Supabase dashboard');
        return;
      }
    }
    
    logger.info({ executed, skipped }, 'Migration completed');
    
    // Verify tables were created
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_boundary_state', 'error_resolutions', 'boundary_enforcement_log']);
    
    logger.info({ tables: tables?.map(t => t.table_name) }, 'Created tables');
    
  } catch (err) {
    logger.error({ error: err.message }, 'Migration error');
    process.exit(1);
  }
}

runMigration();
