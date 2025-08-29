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
require('dotenv').config();

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
    console.log('[reconcile] POLAR_API_KEY present — you may extend this script to call Polar and match records.');
    // Example: call Polar API and try to match by external_payment_id or by metadata
    // This repo doesn't include a Polar SDK; add axios calls here to the Polar endpoints you need.
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
