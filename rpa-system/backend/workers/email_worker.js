// Simple email worker: polls email_queue and sends emails via configured webhook or logs (for dev)
// Can run standalone (node workers/email_worker.js) or be embedded inside the main backend
// when required via startEmailWorker().

// Handle ESM/CJS interop that can occur in test runners
const supabaseLib = require('@supabase/supabase-js');
const createClient = supabaseLib.createClient || supabaseLib.default?.createClient;
const axios = require('axios');
const dotenv = require('dotenv');
const sleep = ms => new Promise(r => setTimeout(r, ms));

dotenv.config({ path: process.env.DOTENV_PATH || undefined });

let supa; // lazy client
function getSupabase() {
  if (supa) return supa;
  const { SUPABASE_URL } = process.env;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !key) {
    console.warn('[email_worker] Supabase not configured; worker will be idle.');
    return null;
  }
  supa = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  // quick presence log (don't print the full service role)
  console.log('[email_worker] SUPABASE configured:', true, 'SERVICE_KEY present:', true);
  return supa;
}

// RPC helper: use supabase.rpc when present; fall back to REST call (useful in tests/mocks)
async function callRpc(fnName, args) {
  const client = getSupabase();
  if (!client) return { data: null, error: { message: 'supabase unavailable' } };
  if (typeof client.rpc === 'function') {
    return client.rpc(fnName, args);
  }
  const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  try {
    const resp = await axios.post(url, args || {}, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 15000
    });
    return { data: resp.data, error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message || 'rpc rest call failed' } };
  }
}

const SEND_EMAIL_WEBHOOK = process.env.SEND_EMAIL_WEBHOOK || ''; // optional: a webhook that accepts {to_email, template, data}
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_WORKER_POLL_MS || '5000', 10);
const MAX_ATTEMPTS = 5;

async function processOne() {
  try {
    // pick one pending item scheduled in the past and mark as sending (simple race-safe attempt via UPDATE ... RETURNING)
    const now = new Date().toISOString();
    const { data: rpcData, error: fetchErr } = await callRpc('claim_email_queue_item', { now_ts: now });

    if (fetchErr) {
      // Fallback: select then update (less safe)
      console.warn('[email_worker] rpc claim failed, falling back to simple select', fetchErr && (fetchErr.message || JSON.stringify(fetchErr)));
      const client = getSupabase();
      const { data: selectData, error: selectError } = await client
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .order('created_at', { ascending: true })
        .limit(1);
      if (selectError) {
        console.error('[email_worker] fallback select error', selectError.message);
        return false;
      }
      if (!selectData || selectData.length === 0) return false;
      const itemToClaim = selectData[0];

      // Try to claim the item by updating its status.
      const { data: updatedData, error: updateError } = await client
        .from('email_queue')
        .update({ status: 'sending', attempts: (itemToClaim.attempts || 0) + 1 })
        .eq('id', itemToClaim.id)
        .eq('status', 'pending')
        .select('*')
        .single();
      if (updateError) {
        console.warn('[email_worker] fallback update error', updateError.message || updateError);
        return false;
      }
      if (!updatedData) {
        // somebody else claimed it or the update didn't apply
        console.warn('[email_worker] fallback update affected no rows (claimed by another worker?) for item:', itemToClaim.id);
        return false;
      }
      return await handleItem(updatedData);
    }

    const items = Array.isArray(rpcData) ? rpcData : (rpcData ? [rpcData] : []);
    if (!items || items.length === 0) return false;
    const item = items[0];
    return await handleItem(item);
  } catch (e) {
    console.error('[email_worker] processOne error', e?.message || e);
    return false;
  }
}

async function handleItem(item) {
  try {
    console.log('[email_worker] processing', item.id, item.to_email, item.template);
    let sent = false;
    if (SEND_EMAIL_WEBHOOK) {
      try {
        const secret = process.env.SEND_EMAIL_WEBHOOK_SECRET;
        const headers = { 'Content-Type': 'application/json' };
        if (secret) {
          headers['Authorization'] = `Bearer ${secret}`;
        }

        await axios.post(
          SEND_EMAIL_WEBHOOK,
          { to_email: item.to_email, template: item.template, data: item.data },
          { timeout: 15000, headers }
        );
        sent = true;
      } catch (e) {
        console.warn('[email_worker] webhook send failed', e?.message || e);
        sent = false;
      }
    } else {
      // Development fallback: write to logs (or integrate with nodemailer)
      console.log('[email_worker] simulate send to', item.to_email, 'template', item.template, 'data', JSON.stringify(item.data || {}));
      sent = true;
    }

    if (sent) {
      const client = getSupabase();
      const { data: sentData, error: sentErr } = await client
        .from('email_queue')
        .update({ status: 'sent', attempts: item.attempts || 0, last_error: null })
        .eq('id', item.id)
        .select('*');
      if (sentErr) {
        console.error('[email_worker] failed to mark sent', sentErr.message || sentErr);
        return false;
      }
      if (!sentData || sentData.length === 0) {
        console.error('[email_worker] mark-sent affected no rows for', item.id);
        return false;
      }
      return true;
    } else {
      const attempts = (item.attempts || 0) + 1;
      const last_error = 'send failed';
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      const client = getSupabase();
      const { data: failData, error: failErr } = await client
        .from('email_queue')
        .update({ attempts, last_error, status })
        .eq('id', item.id)
        .select('*');
      if (failErr) console.warn('[email_worker] failed to persist failure state', failErr.message || failErr);
      return false;
    }
  } catch (e) {
    console.error('[email_worker] handleItem error', e?.message || e);
    return false;
  }
}

async function startEmailWorker() {
  // Validate config and client init up front
  try {
    getSupabase();
  } catch (e) {
    console.error('[email_worker] startup error:', e.message || e);
    if (require.main === module) {
      process.exit(1);
    }
    throw e;
  }
  console.log('[email_worker] starting (embedded=', !(require.main === module), ') poll interval', POLL_INTERVAL_MS, 'ms');
  let lastHeartbeat = Date.now();
  while (true) {
    try {
      const ok = await processOne();
      if (!ok) await sleep(POLL_INTERVAL_MS);
      if (Date.now() - lastHeartbeat > 60000) { // Log a heartbeat every 60 seconds
        console.log(`[email_worker] heartbeat: still running at ${new Date().toISOString()}`);
        lastHeartbeat = Date.now();
      }
    } catch (e) {
      console.error('[email_worker] main loop error', e?.message || e);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

if (require.main === module) {
  startEmailWorker();
}

module.exports = { startEmailWorker };
