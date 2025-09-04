-- This script provides a consolidated schema for the application.
-- Running this in your Supabase SQL Editor will set up the necessary
-- tables, policies, and functions for the backend services to operate correctly.

-- 1. Create a table for public user profiles
-- This table is required for user sign-up and associating data with users.
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  primary key (id)
);
-- Set up Row Level Security (RLS) for the profiles table
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. Create a trigger to automatically create a profile entry for new users.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists, then create the new one
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- The following DROP statements are added to ensure a clean re-application of the schema.
-- This is necessary to fix errors seen in logs, such as:
-- - "invalid input value for enum email_status" (by dropping the faulty enum)
-- - "Could not find column" (by recreating the table with the correct schema)
-- - "Could not find function public.claim_email_queue_item" (by recreating it)
DROP TYPE IF EXISTS public.email_status CASCADE;
DROP TABLE IF EXISTS public.email_queue CASCADE;

-- 3. Create the email_queue table for the email worker
-- This table stores emails to be sent for campaigns and other transactional events.
CREATE TABLE IF NOT EXISTS public.email_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    to_email text NOT NULL,
    template text NOT NULL,
    data jsonb,
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    claimed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled_at ON public.email_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_claimed_at ON public.email_queue (claimed_at);

-- 4. Create the atomic claim function for the email worker
-- This prevents multiple workers from processing the same email job.
CREATE OR REPLACE FUNCTION public.claim_email_queue_item(now_ts timestamptz)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_row public.email_queue%ROWTYPE;
BEGIN
  -- find one candidate and lock it so concurrent callers don't race
  SELECT id INTO v_id
    FROM public.email_queue
    WHERE status = 'pending' AND scheduled_at <= now_ts
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.email_queue q
  SET status = 'sending', attempts = COALESCE(q.attempts, 0) + 1, claimed_at = now()
  WHERE q.id = v_id
  RETURNING q.* INTO v_row;

  RETURN NEXT v_row;
  RETURN;
END;
$$;