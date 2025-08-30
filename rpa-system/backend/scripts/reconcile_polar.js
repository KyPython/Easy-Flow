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

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

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
    console.log('[reconcile] POLAR_API_KEY present. Cross-checking with Polar API...');
    try {
      const response = await axios.get('https://api.polar.sh/v1/orders', {
        headers: {
          'Authorization': `Bearer ${process.env.POLAR_API_KEY}`,
          'Accept': 'application/json',
        },
        params: {
          // Fetching recent orders to check against local records
          limit: 50,
          ordering: '-created_at'
        }
      });

      const orders = response.data.items || [];
      console.log(`[reconcile] Fetched ${orders.length} recent orders from Polar.`);

      // TODO: Implement matching logic here.
      // For each order from Polar, find the corresponding subscription in your database.
      // You might match on `customer_id`, `subscription_id`, or a `charge_id` stored as `external_payment_id`.
      orders.forEach(order => {
        console.log(`POLAR_ORDER: ID=${order.id}, Amount=${order.amount / 100} ${order.currency.toUpperCase()}, Status=${order.status}`);
      });

    } catch (error) {
      console.error('[reconcile] Error fetching data from Polar API.');
      if (error.response) {
        console.error(`Status: ${error.response.status} - ${error.response.statusText}`);
        console.error('Data:', error.response.data);
      } else {
        console.error(error.message);
      }
    }
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