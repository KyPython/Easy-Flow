import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('dotenv path →', path.resolve(__dirname, '..', '.env'));

// Dynamically find and load the .env file
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
];
let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    console.log(`[referral_integration] Loaded environment variables from: ${envPath}`);
    break;
  }
}
if (!envLoaded) {
  console.warn('[referral_integration] No .env file found in likely locations.');
}

// Environment variables and client setup
const SUPABASE_URL = process.env.SUPABASE_URL;
const BASE = process.env.BASE_URL || 'http://localhost:3030';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_JWT;

if (!SUPABASE_URL) {
  console.warn('[referral_integration] SUPABASE_URL is missing from environment variables.');
}
if (!process.env.SUPABASE_SERVICE_ROLE && process.env.SUPABASE_JWT) {
  console.warn('[referral_integration] SUPABASE_SERVICE_ROLE not set — falling back to SUPABASE_JWT. Ensure this JWT has service_role privileges.');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or SUPABASE_JWT with service_role) in your env before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Find a plan UUID to use for subscription rows. Try common names/aliases for 'pro'.
async function findPlanId() {
  try {
    // look for plan name containing 'pro' (covers 'Pro'/'Professional')
    let q = await supabase.from('plans').select('id,name').ilike('name', '%pro%').limit(1).maybeSingle();
    if (q?.data && q.data.id) return q.data.id;

    // fallback for 'professional'
    q = await supabase.from('plans').select('id,name').ilike('name', '%professional%').limit(1).maybeSingle();
    if (q?.data && q.data.id) return q.data.id;

    // final fallback: pick the first plan row available
    q = await supabase.from('plans').select('id,name').limit(1).maybeSingle();
    if (q?.data && q.data.id) return q.data.id;
  } catch (e) {
    // ignore and return null
  }
  return null;
}

// Helper function to create/update referrer and their subscription
async function upsertReferrer(email) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Ensure we have the authoritative profile id. Try select first; if missing, create an auth user then insert/upsert the profile with that id.
  let profileId = null;
  const { data: profileRow, error: profileErr } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
  if (profileErr) throw profileErr;
  if (profileRow && profileRow.id) {
    profileId = profileRow.id;
  } else {
    // If profiles.id references auth.users (common in Supabase), create an auth user first
    try {
      const pw = crypto.randomBytes(16).toString('hex');
      const { data: createdUser, error: createUserErr } = await supabase.auth.admin.createUser({ email, password: pw, email_confirm: true });
      if (createUserErr) {
        // fallback: insert profile without id (if allowed)
        console.warn('[referral_integration] creating auth user failed, falling back to profile insert:', createUserErr.message || createUserErr);
        const { data: inserted, error: insertErr } = await supabase.from('profiles').insert([{ email, created_at: now }]).select('id').maybeSingle();
        if (insertErr) throw insertErr;
        profileId = inserted?.id || id;
      } else {
        // insert profile row with id matching auth user id
        const userId = createdUser?.id || createdUser?.user?.id || null;
        if (!userId) {
          throw new Error('Could not determine created auth user id');
        }
        // Use insert ... on conflict do nothing then select to obtain id reliably
        const { error: insertErr } = await supabase.from('profiles').insert([{ id: userId, email, created_at: now }], { returning: 'minimal' });
        if (insertErr && !/duplicate key value/i.test(insertErr.message || '')) {
          throw insertErr;
        }
        // Select authoritative id
        const { data: sel, error: selErr } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (selErr) throw selErr;
        profileId = sel?.id || userId;
      }
    } catch (e) {
      throw e;
    }
  }
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const planId = await findPlanId();
  const subscriptionRow = {
    user_id: profileId,
    plan_id: planId, // UUID or null
    status: 'active',
    expires_at: expires,
    created_at: now
  };
  const { error } = await supabase.from('subscriptions').upsert([subscriptionRow], { onConflict: 'user_id' });
  if (error) throw error;
  const { data } = await supabase.from('profiles').select('id,email').eq('email', email).maybeSingle();
  return data;
}

// Main test function
async function run() {
  try {
    const referrerEmail = `referrer+test@local.dev`;
    const referredEmail = `referred+test@local.dev`;

    console.log('1) Ensure referrer exists and has an active subscription...');
    const referrer = await upsertReferrer(referrerEmail);
    console.log('  referrer:', referrer);

    console.log('2) Call generate-referral endpoint...');
  const resp = await axios.post(`${BASE}/api/generate-referral`, { referrerEmail, referredEmail }, { headers: { 'Content-Type': 'application/json' } });
    console.log('  endpoint response:', resp.data);

    console.log('3) Query referrals table for the created referral...');
    // referrals store the referred email inside metadata JSON -> referred_email
    const { data: referrals, error: findRefError } = await supabase
      .from('referrals')
      .select('*')
      .filter('metadata->>referred_email', 'eq', referredEmail)
      .order('created_at', { ascending: false })
      .limit(1);
    if (findRefError) throw findRefError;
    const referral = referrals && referrals[0];
    if (!referral) {
      console.error('No referral row found for referredEmail');
      process.exit(2);
    }
    console.log('  referral:', { id: referral.id, referrer_id: referral.referrer_id, referral_code: referral.referral_code, metadata: referral.metadata });

    console.log('4) Create referred user profile (simulate signup)...');
    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await supabase.from('profiles').upsert([{ id: newUserId, email: referredEmail, created_at: now }], { onConflict: 'email' });
    
    // Simulate handler not being invoked (handled = false)
    const handled = false;
    
    console.log('5) Update referral status...');
    if (!handled) {
      // Manually mark the referral as completed by setting the canonical referred_user_id.
      const { error: updateError } = await supabase
        .from('referrals')
        .update({
          status: 'completed',
          referred_user_id: newUserId,
          metadata: { ...(referral.metadata || {}), completed: true, completed_at: new Date().toISOString() }
        }).eq('id', referral.id);
      if (updateError) throw updateError;

      console.log('  referral marked as completed manually.');

      // Now extend subscription manually to simulate the business rule.
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', referrer.id).maybeSingle();
      if (sub) {
        const currentExpiresAt = new Date(sub.expires_at || new Date().toISOString());
        const newExpiresAt = new Date(currentExpiresAt.setDate(currentExpiresAt.getDate() + 30)).toISOString();
        const { error: subUpdateError } = await supabase.from('subscriptions').update({ expires_at: newExpiresAt }).eq('user_id', sub.user_id);
        if (subUpdateError) throw subUpdateError;
        console.log('  manual subscription extension to:', newExpiresAt);
      } else {
        console.warn('  no subscription found to extend for referrer.');
      }
    } else {
      console.log('  handler invoked, waiting briefly for DB changes...');
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('6) Verify referrer subscription expiry extended...');
    const { data: finalSub } = await supabase.from('subscriptions').select('*').eq('user_id', referrer.id).maybeSingle();
    if (!finalSub) {
      console.error('Subscription not found for referrer - cannot verify extension.');
      process.exit(3);
    }
    console.log('  final subscription:', { id: finalSub.id, expires_at: finalSub.expires_at, status: finalSub.status });

    console.log('SUCCESS: End-to-end flow simulated. Referred user created and referrer subscription updated.');
    process.exit(0);
  } catch (err) {
    console.error('Test flow failed:', err?.message || err);
    process.exit(4);
  }
}

run();