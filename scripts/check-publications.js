#!/usr/bin/env node
/*
 * Best-effort helper to inspect Postgres publications and table columns.
 * If `psql` is available and DATABASE_URL is set (or in docker-compose.yml),
 * this will run queries and print results. Otherwise it prints the SQL to run.
 * Usage: node scripts/check-publications.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function tryGetDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Try docker-compose.yml
  try {
    const dc = fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8');
    const m = dc.match(/DATABASE_URL:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch (e) {}
  return null;
}

function checkPsql() {
  try {
    execSync('psql --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function runQueries(databaseUrl) {
  const q1 = `\n-- List publications\nSELECT pubname, pubowner, puballtables FROM pg_publication;\n`;
  const q2 = `\n-- Publication tables (if pg_publication_tables exists)\nSELECT * FROM pg_publication_tables;\n`;
  const q3 = `\n-- Example: show columns for profiles and workflow_executions\nSELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('profiles','workflow_executions','workflow_executions_tracking','usage_tracking','workflows') ORDER BY table_name, ordinal_position;\n`;

  console.log('Running publication/column queries via psql...');
  try {
    const out1 = execSync(`psql "${databaseUrl}" -c "${q1.replace(/"/g, '\\"')}"`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(out1);
    const out2 = execSync(`psql "${databaseUrl}" -c "${q2.replace(/"/g, '\\"')}"`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(out2);
    const out3 = execSync(`psql "${databaseUrl}" -c "${q3.replace(/"/g, '\\"')}"`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(out3);
  } catch (e) {
    console.error('Error running psql commands:', e.message || String(e));
  }
}

function main() {
  const databaseUrl = tryGetDatabaseUrl();
  if (!databaseUrl) {
    console.error('Database URL not found in env or docker-compose.yml. Please set DATABASE_URL.');
    console.log('\nSQL to run once connected:');
    console.log('\n-- List publications\nSELECT pubname, pubowner, puballtables FROM pg_publication;');
    console.log('\n-- Publication tables\nSELECT * FROM pg_publication_tables;');
    console.log('\n-- Compare columns for affected tables\nSELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name IN (\'profiles\',\'workflow_executions\',\'usage_tracking\',\'workflows\') ORDER BY table_name, ordinal_position;');
    process.exit(2);
  }

  if (!checkPsql()) {
    console.error('psql not found on PATH. Install psql or run the following SQL against your DB:');
    console.log('\n-- List publications\nSELECT pubname, pubowner, puballtables FROM pg_publication;');
    console.log('\n-- Publication tables\nSELECT * FROM pg_publication_tables;');
    console.log('\n-- Compare columns for affected tables\nSELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name IN (\'profiles\',\'workflow_executions\',\'usage_tracking\',\'workflows\') ORDER BY table_name, ordinal_position;');
    process.exit(3);
  }

  runQueries(databaseUrl);
}

main();
