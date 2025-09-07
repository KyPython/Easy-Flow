// Simple email worker: polls email_queue and sends emails via configured webhook or logs (for dev)
// Can run standalone (node workers/email_worker.js) or be embedded inside the main backend
// when required via startEmailWorker().

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const dotenv = require('dotenv');
const sleep = ms => new Promise(r => setTimeout(r, ms));

dotenv.config({ path: process.env.DOTENV_PATH || undefined });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in env.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// quick presence log (don't print the full service role)
console.log('[email_worker] SUPABASE configured:', !!SUPABASE_URL, 'SERVICE_ROLE present:', !!SUPABASE_SERVICE_ROLE);

const SEND_EMAIL_WEBHOOK = process.env.SEND_EMAIL_WEBHOOK || ''; // optional: a webhook that accepts {to_email, template, data}
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_WORKER_POLL_MS || '5000', 10);
const MAX_ATTEMPTS = 5;

async function processOne() {
  try {
    // pick one pending item scheduled in the past and mark as sending (simple race-safe attempt via UPDATE ... RETURNING)
    const now = new Date().toISOString();
    const { data: items, error: fetchErr } = await supabase.rpc('claim_email_queue_item', { now_ts: now }).limit(1);

    if (fetchErr) {
      // Fallback: select then update (less safe)
      console.warn('[email_worker] rpc claim failed, falling back to simple select', fetchErr && (fetchErr.message || JSON.stringify(fetchErr)));
      const { data: selectData, error: selectError } = await supabase.from('email_queue').select('*').eq('status', 'pending').lte('scheduled_at', now).order('created_at', { ascending: true }).limit(1);
      if (selectError) {
        console.error('[email_worker] fallback select error', selectError.message);
        return false;
      }
      if (!selectData || selectData.length === 0) return false;
      const itemToClaim = selectData[0];

      // Try to claim the item by updating its status.
      const { data: updatedData, error: updateError } = await supabase.from('email_queue').update({ status: 'sending', attempts: (itemToClaim.attempts || 0) + 1 }).eq('id', itemToClaim.id).eq('status', 'pending').select('*').single();
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
      const { data: sentData, error: sentErr } = await supabase.from('email_queue').update({ status: 'sent', attempts: item.attempts || 0, last_error: null }).eq('id', item.id).select('*');
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
      const { data: failData, error: failErr } = await supabase.from('email_queue').update({ attempts, last_error, status }).eq('id', item.id).select('*');
      if (failErr) console.warn('[email_worker] failed to persist failure state', failErr.message || failErr);
      return false;
    }
  } catch (e) {
    console.error('[email_worker] handleItem error', e?.message || e);
    return false;
  }
}

async function startEmailWorker() {
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
