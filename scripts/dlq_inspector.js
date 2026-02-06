#!/usr/bin/env node
/**
 * Simple DLQ inspector and replay tool.
 * Usage:
 *  - List failed jobs: `node scripts/dlq_inspector.js list`
 *  - Show job: `node scripts/dlq_inspector.js show <id>`
 *  - Replay job: `node scripts/dlq_inspector.js replay <id>` (resets state to PENDING)
 */

const { getSupabase } = require('../rpa-system/backend/utils/supabaseClient');

function getClientOrExit() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or SUPABASE_KEY) in your environment.');
    console.error('Example: export SUPABASE_URL="https://xyz.supabase.co"');
    console.error('         export SUPABASE_SERVICE_ROLE="<service-role-key>"');
    process.exit(2);
  }
  return supabase;
}

async function listFailed() {
  const supabase = getClientOrExit();
  const { data, error } = await supabase.from('dlq_inspector').select('*').limit(50);
  if (error) {
    console.error('Error listing DLQ:', error.message || error);
    process.exit(1);
  }
  console.table(data.map(d => ({ id: d.id, updated_at: d.updated_at, retry_count: d.retry_count, last_error: d.last_error })));
}

async function show(id) {
  const supabase = getClientOrExit();
  const { data, error } = await supabase.from('workflow_executions').select('*').eq('id', id).single();
  if (error) {
    console.error('Error fetching job:', error.message || error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

async function replay(id) {
  const supabase = getClientOrExit();
  // Basic safety: confirm
  console.log(`Replay requested for ${id}. This will reset state to PENDING.`);
  const confirm = await promptConfirm('Proceed? (y/N): ');
  if (!confirm) {
    console.log('Aborted');
    process.exit(0);
  }

  const { data, error } = await supabase
    .from('workflow_executions')
    .update({ state: 'PENDING', status: 'pending', last_error: null, error_message: null, retry_count: 0, started_at: null, completed_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error resetting job:', error.message || error);
    process.exit(1);
  }
  console.log('Job reset to PENDING');
}

function promptConfirm(question) {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdout.write(question);
    process.stdin.once('data', function (data) {
      const s = data.toString().trim().toLowerCase();
      resolve(s === 'y' || s === 'yes');
    });
  });
}

async function main() {
  const [,, cmd, id] = process.argv;
  if (cmd === 'list') return await listFailed();
  if (cmd === 'show' && id) return await show(id);
  if (cmd === 'replay' && id) return await replay(id);
  console.log('Usage: node scripts/dlq_inspector.js <list|show|replay> [id]');
}

module.exports = {
  getClientOrExit,
  listFailed,
  show,
  replay,
  promptConfirm,
  main
};

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
