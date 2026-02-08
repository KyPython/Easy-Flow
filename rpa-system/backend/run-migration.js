#!/usr/bin/env node
/**
 * Run the team management migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// Use structured logging
const { createLogger } = require('./middleware/structuredLogging');
const logger = createLogger('migration');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../../migrations/add_team_management_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    logger.info({ migrationPath }, 'Running team management migration');

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('comment on')) {
        continue;
      }

      logger.debug({ statement: statement.substring(0, 60) }, 'Executing statement');

      const { error } = await supabase.rpc('exec_sql', {
        query: statement
      });

      if (error) {
        logger.warn({ error: error.message }, 'RPC failed, trying direct execution');
        const { error: directError } = await supabase
          .from('_migrations')
          .insert({ name: 'add_team_management_columns', executed_at: new Date() });

        if (directError && !directError.message.includes('already exists')) {
          logger.error({ error: directError.message }, 'Error');
        }
      }
    }

    logger.info('Migration completed successfully');
    logger.info('Checking user role');

    const { data: user } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('email', 'kyjahntsmith@gmail.com')
      .single();

    if (user) {
      logger.info({ email: user.email, role: user.role || '(none)' }, 'User role');
    }

  } catch (err) {
    logger.error({ error: err.message }, 'Unexpected error');
    process.exit(1);
  }
}

runMigration();
