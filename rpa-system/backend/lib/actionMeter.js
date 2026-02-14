const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const logger = { info: (...args) => console.log(...args), warn: (...args) => console.warn(...args) };

// Resolve an .env file similar to existing scripts
const candidates = [
  path.resolve(__dirname, '..', '.env'), // backend/.env
  path.resolve(__dirname, '..', '..', '.env'), // rpa-system/.env
  path.resolve(process.cwd(), '.env') // repo .env
];
function chooseEnv() { for (const p of candidates) if (fs.existsSync(p)) return p; return candidates[0]; }

try { require('dotenv').config({ path: chooseEnv() }); } catch (_) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
let supabase = null;

function getClient() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      logger?.warn?.('[actionMeter] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
      return null;
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  }
  return supabase;
}

// Minimal metering helper: insert into `actions` table
async function meterAction({ userId = null, workflowExecutionId = null, actionType = 'unknown', payload = {} } = {}) {
  const client = getClient();
  if (!client) return { error: new Error('Supabase client not initialized') };

  const record = {
    user_id: userId,
    workflow_execution_id: workflowExecutionId,
    action_type: actionType,
    payload,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await client.from('actions').insert([record]).select('id').limit(1);
    if (error) {
      logger?.warn?.('[actionMeter] Insert error:', error);
      return { error };
    }
    logger?.info?.('[actionMeter] Inserted action id:', data?.[0]?.id);
    return { data };
  } catch (e) {
    logger?.warn?.('[actionMeter] Unexpected error:', e?.message || e);
    return { error: e };
  }
}

module.exports = { meterAction };
