
const { logger, getLogger } = require('../utils/logger');
// Simple email worker: polls email_queue and sends emails via configured webhook or logs (for dev)
// Can run standalone (node workers/email_worker.js) or be embedded inside the main backend
// when required via startEmailWorker().

const { getSupabase } = require('../utils/supabaseClient');
const axios = require('axios');
const dotenv = require('dotenv');
const sleep = ms => new Promise(r => setTimeout(r, ms));

dotenv.config({ path: process.env.DOTENV_PATH || undefined });

// use centralized getSupabase (may return null when not configured)

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
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || '';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'EasyFlow'; // Optional: Display name for sender
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_WORKER_POLL_MS || '5000', 10);
const MAX_ATTEMPTS = 5;

// Build FROM address with optional name: "Name <email@domain.com>" or just "email@domain.com"
const getFromAddress = () => {
  if (!SENDGRID_FROM_EMAIL) return '';
  if (SENDGRID_FROM_NAME && SENDGRID_FROM_NAME !== 'EasyFlow') {
    return `${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`;
  }
  return SENDGRID_FROM_EMAIL;
};

// Initialize SendGrid if configured
let sgMail = null;
if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
    logger.info('[email_worker] ✅ SendGrid configured for direct email sending');
  } catch (e) {
    logger.warn('[email_worker] ⚠️ SendGrid package not installed. Install with: npm install @sendgrid/mail');
    logger.warn('[email_worker] ⚠️ Falling back to webhook or simulation mode');
  }
}

async function processOne() {
  try {
    // pick one pending item scheduled in the past and mark as sending (simple race-safe attempt via UPDATE ... RETURNING)
    const now = new Date().toISOString();
    const { data: rpcData, error: fetchErr } = await callRpc('claim_email_queue_item', { now_ts: now });

    if (fetchErr) {
      // Fallback: select then update (less safe)
      logger.warn('[email_worker] rpc claim failed, falling back to simple select', {
        error: fetchErr?.message || 'Unknown error',
        error_details: typeof fetchErr === 'string' ? fetchErr : (fetchErr?.message || JSON.stringify(fetchErr))
      });
      const client = getSupabase();
      if (!client) return false;
      const { data: selectData, error: selectError } = await client
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .order('created_at', { ascending: true })
        .limit(1);
      if (selectError) {
        logger.error('[email_worker] fallback select error', selectError.message);
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
        logger.warn('[email_worker] fallback update error', updateError.message || updateError);
        return false;
      }
      if (!updatedData) {
        // somebody else claimed it or the update didn't apply
        logger.warn('[email_worker] fallback update affected no rows (claimed by another worker?) for item:', itemToClaim.id);
        return false;
      }
      return await handleItem(updatedData);
    }

    const items = Array.isArray(rpcData) ? rpcData : (rpcData ? [rpcData] : []);
    if (!items || items.length === 0) return false;
    const item = items[0];
    return await handleItem(item);
  } catch (e) {
    logger.error('[email_worker] processOne error', e?.message || e);
    return false;
  }
}

async function handleItem(item) {
  try {
    logger.info('[email_worker] processing', item.id, item.to_email, item.template);
    let sent = false;
    let lastError = null;
    
    // Priority 1: Use SendGrid directly if configured
    if (sgMail && SENDGRID_FROM_EMAIL) {
      try {
        // Load email template
        const { getEmailTemplate } = require('../utils/emailTemplates');
        let emailTemplate;
        try {
          emailTemplate = getEmailTemplate(item.template, item.data || {});
        } catch (templateError) {
          // Fallback template if specific template doesn't exist
          emailTemplate = {
            subject: `EasyFlow Notification - ${item.template}`,
            text: `Hello from EasyFlow!\n\nTemplate: ${item.template}\n\n${JSON.stringify(item.data || {}, null, 2)}`,
            html: `<p>Hello from EasyFlow!</p><p>Template: ${item.template}</p><pre>${JSON.stringify(item.data || {}, null, 2)}</pre>`
          };
        }

        const msg = {
          to: item.to_email,
          from: getFromAddress(), // Supports "Name <email@domain.com>" format
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html
        };

        const [result] = await sgMail.send(msg);
        logger.info(`[email_worker] ✅ Email sent via SendGrid to ${item.to_email}`, {
          message_id: result?.headers?.['x-message-id'],
          template: item.template
        });
        sent = true;
        lastError = null;
      } catch (e) {
        lastError = e;
        const errorMsg = e?.response?.body?.errors?.map(err => err.message).join('; ') || e?.message || 'SendGrid send failed';
        logger.error(`[email_worker] ❌ SendGrid send failed`, {
          error: errorMsg,
          to_email: item.to_email,
          template: item.template,
          status: e?.response?.status
        });
        sent = false;
      }
    }
    // Priority 2: Use webhook if configured
    else if (SEND_EMAIL_WEBHOOK) {
      // ✅ FIX: Add retry logic with exponential backoff
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const secret = process.env.SEND_EMAIL_WEBHOOK_SECRET;
          const headers = { 'Content-Type': 'application/json' };
          if (secret) {
            headers['Authorization'] = `Bearer ${secret}`;
          }

          await axios.post(
            SEND_EMAIL_WEBHOOK,
            { to_email: item.to_email, template: item.template, data: item.data },
            { 
              // Add retry-specific timeout - longer on later attempts
              timeout: attempt === 1 ? 15000 : 20000,
              headers
            }
          );
          sent = true;
          lastError = null;
          break; // Success - exit retry loop
        } catch (e) {
          lastError = e;
          const isRetryable = e.code === 'ECONNRESET' || 
                             e.code === 'ETIMEDOUT' || 
                             e.code === 'ENOTFOUND' ||
                             (e.response && e.response.status >= 500) ||
                             (e.response && e.response.status === 429);
          
          if (!isRetryable || attempt === maxRetries) {
            // Not retryable or max retries reached
            logger.warn(`[email_worker] webhook send failed (attempt ${attempt}/${maxRetries})`, {
              error: e?.message || e,
              code: e?.code,
              status: e?.response?.status,
              retryable: isRetryable && attempt < maxRetries
            });
            break;
          }
          
          // Calculate exponential backoff delay
          const delay = baseDelay * Math.pow(2, attempt - 1);
          logger.info(`[email_worker] Retrying email send (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`, {
            error: e?.message,
            code: e?.code
          });
          await sleep(delay);
        }
      }
    } else {
      // Development fallback: write to logs (or integrate with nodemailer)
      logger.warn('[email_worker] ⚠️ No email service configured - simulating send (emails will NOT be delivered)', {
        to_email: item.to_email,
        template: item.template,
        data: item.data,
        instruction: 'Configure SENDGRID_API_KEY + SENDGRID_FROM_EMAIL or SEND_EMAIL_WEBHOOK to send real emails'
      });
      logger.info('[email_worker] simulate send to', {
        to_email: item.to_email,
        template: item.template,
        data: item.data || {}
      });
      sent = true; // Mark as sent so queue doesn't retry
    }

    if (sent) {
      const client = getSupabase();
      if (!client) return true; // treat as sent for dev mode when DB is unavailable
      const { data: sentData, error: sentErr } = await client
        .from('email_queue')
        .update({ status: 'sent', attempts: item.attempts || 0, last_error: null })
        .eq('id', item.id)
        .select('*');
      if (sentErr) {
        logger.error('[email_worker] failed to mark sent', sentErr.message || sentErr);
        return false;
      }
      if (!sentData || sentData.length === 0) {
        logger.error('[email_worker] mark-sent affected no rows for', item.id);
        return false;
      }
      return true;
    } else {
      const attempts = (item.attempts || 0) + 1;
      // ✅ FIX: Better error message with details
      const last_error = lastError 
        ? `Send failed: ${lastError.message || lastError} (code: ${lastError.code || 'unknown'})`
        : 'Send failed: Unknown error';
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      const client = getSupabase();
      if (!client) return false;
      
      // ✅ FIX: Store error details for debugging
      const updateData = { 
        attempts, 
        last_error, 
        status,
        last_attempted_at: new Date().toISOString()
      };
      
      // Store full error details in metadata if available
      if (lastError) {
        try {
          updateData.metadata = JSON.stringify({
            error_message: lastError.message,
            error_code: lastError.code,
            error_status: lastError.response?.status,
            retry_count: attempts
          });
        } catch (metaErr) {
          // Ignore metadata serialization errors
        }
      }
      
      const { data: failData, error: failErr } = await client
        .from('email_queue')
        .update(updateData)
        .eq('id', item.id)
        .select('*');
      if (failErr) {
        logger.warn('[email_worker] failed to persist failure state', failErr.message || failErr);
      } else if (status === 'failed') {
        logger.error('[email_worker] Email permanently failed after max attempts', {
          email_id: item.id,
          to_email: item.to_email,
          attempts,
          last_error
        });
      }
      return false;
    }
  } catch (e) {
    logger.error('[email_worker] handleItem error', e?.message || e);
    return false;
  }
}

async function startEmailWorker() {
  // Validate config and client init up front
  try {
    getSupabase();
  } catch (e) {
    logger.error('[email_worker] startup error:', e.message || e);
    if (require.main === module) {
      process.exit(1);
    }
    throw e;
  }
  logger.info('[email_worker] starting (embedded=', !(require.main === module), ') poll interval', POLL_INTERVAL_MS, 'ms');
  let lastHeartbeat = Date.now();
  while (true) {
    try {
      const ok = await processOne();
      if (!ok) await sleep(POLL_INTERVAL_MS);
      if (Date.now() - lastHeartbeat > 60000) { // Log a heartbeat every 60 seconds
        logger.info(`[email_worker] heartbeat: still running at ${new Date().toISOString()}`);
        lastHeartbeat = Date.now();
      }
    } catch (e) {
      logger.error('[email_worker] main loop error', e?.message || e);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

if (require.main === module) {
  startEmailWorker();
}

module.exports = { startEmailWorker };
