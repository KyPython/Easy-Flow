#!/usr/bin/env node
/**
 * reconcile_polar.js
 * Lightweight reconciliation helper: lists subscriptions that may need attention
 * - subscriptions with status != 'active'
 * - subscriptions missing external_payment_id
 *
 * Optional: if POLAR_API_KEY is provided, you can extend this script to call
 * Polar's API to cross-check payments and auto-repair missing rows.
 *
 * Usage:
 *   POLAR_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node reconcile_polar.js
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();
const { getPolarSubscription } = require('../polar_utils');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  console.log('[reconcile] connecting to supabase...');

  // 1) Find subscriptions not active
  const { data: pending, error: pendErr } = await supabase
    .from('subscriptions')
    .select('id,user_id,plan_id,status,external_payment_id,created_at')
    .neq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  if (pendErr) {
    console.error('[reconcile] failed to fetch pending subscriptions', pendErr.message || pendErr);
    process.exit(2);
  }

  console.log(`[reconcile] found ${pending.length} non-active subscriptions (showing up to 200)`);
  pending.forEach(s => console.log('PENDING:', s));

  // 2) Find subscriptions missing external_payment_id
  const { data: missing, error: missErr } = await supabase
    .from('subscriptions')
    .select('id,user_id,plan_id,status,external_payment_id,created_at')
    .is('external_payment_id', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (missErr) {
    console.error('[reconcile] failed to fetch subscriptions missing external_payment_id', missErr.message || missErr);
    process.exit(3);
  }

  console.log(`[reconcile] found ${missing.length} subscriptions missing external_payment_id (showing up to 200)`);
  missing.forEach(s => console.log('MISSING_EXTERNAL_ID:', s));

  // NOTE: Optional Polar cross-check
  if (process.env.POLAR_API_KEY) {
    console.log('[reconcile] POLAR_API_KEY present. Cross-checking non-active subscriptions with Polar API...');
    let updatedCount = 0;

    for (const sub of pending) {
      if (!sub.external_payment_id) {
        continue; // Cannot check without a Polar ID
      }

      const polarSub = await getPolarSubscription(sub.external_payment_id);

      // If we found a subscription on Polar and its status is different from our DB...
      if (polarSub && polarSub.status !== sub.status) {
        console.log(`- Updating Sub ID ${sub.id}: DB status was '${sub.status}', Polar status is '${polarSub.status}'.`);

        const { error: updateErr } = await supabase
          .from('subscriptions')
          .update({ status: polarSub.status, updated_at: new Date().toISOString() })
          .eq('id', sub.id);

        if (updateErr) {
          console.error(`  - FAILED to update Sub ID ${sub.id}:`, updateErr.message);
        } else {
          updatedCount++;
          console.log(`  - SUCCESS: Updated status in DB.`);
        }
      }
    }
    console.log(`[reconcile] Finished Polar cross-check. Updated ${updatedCount} records.`);

  } else {
    console.log('[reconcile] POLAR_API_KEY not set — skipping Polar cross-check');
  }

  console.log('[reconcile] done');
  process.exit(0);
}

main().catch(e => {
  console.error('[reconcile] fatal', e?.message || e);
  process.exit(11);
});
dotenv.config({ path: new URL('../rpa-system/.env', import.meta.url).pathname });

const POLAR_API_KEY = process.env.POLAR_API_KEY;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh/v1';

if (!POLAR_API_KEY) {
  console.error('POLAR_API_KEY is not set in environment variables.');
  process.exit(1);
}

if (!POLAR_WEBHOOK_SECRET) {
  console.warn('POLAR_WEBHOOK_SECRET is not set. Webhook validation may be insecure.');
}

// Example: Fetch subscriptions from Polar API
export async function fetchSubscriptions() {
  try {
    const response = await axios.get(`${POLAR_API_URL}/subscriptions`, {
      headers: {
        Authorization: `Bearer ${POLAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('Subscriptions:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching subscriptions from Polar:', error.response?.data || error.message);
  }
}

// Example: Validate webhook payload (if used in webhook receiver)
export function validateWebhook(req) {
  const receivedSecret = req.headers['x-polar-webhook-secret'];
  if (POLAR_WEBHOOK_SECRET && receivedSecret !== POLAR_WEBHOOK_SECRET) {
    throw new Error('Invalid Polar webhook secret');
  }
}

// Main reconciliation logic (expand as needed)
export async function reconcile() {
  console.log('Starting Polar reconciliation...');
  await fetchSubscriptions();
  // Add more logic here to sync with your DB, update statuses, etc.
}

// Optionally run reconcile if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  reconcile();
}

