-- Migration: add referred_user_id and helpers to match expectations used by the integration harness
-- Run this against the local Supabase/Postgres instance used by the rpa-system backend.

BEGIN;

-- Add referred_user_id column (nullable) used by server-side referral completion logic
ALTER TABLE IF EXISTS referrals
  ADD COLUMN IF NOT EXISTS referred_user_id uuid;

-- Ensure a referral_code column exists (some environments store it separately)
ALTER TABLE IF EXISTS referrals
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Helpful uniqueness constraints so upserts by email/user_id work predictably in development
ALTER TABLE IF EXISTS profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_email_unique UNIQUE (email);

ALTER TABLE IF EXISTS subscriptions
  ADD CONSTRAINT IF NOT EXISTS subscriptions_user_id_unique UNIQUE (user_id);

COMMIT;
