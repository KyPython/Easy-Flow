-- EasyFlow User Plans and Subscriptions Schema
-- Run this in your Supabase SQL editor

-- Create user_plans table
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on user_id (one plan per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- Create index on plan_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_plans_plan_id ON user_plans(plan_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON user_plans(status);

-- Create index on trial_end for trial management
CREATE INDEX IF NOT EXISTS idx_user_plans_trial_end ON user_plans(trial_end);

-- Enable Row Level Security (RLS)
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own plan
CREATE POLICY "Users can view own plan" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own plan
CREATE POLICY "Users can insert own plan" ON user_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own plan
CREATE POLICY "Users can update own plan" ON user_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON user_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check if user has active plan
CREATE OR REPLACE FUNCTION has_active_plan(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_plans 
    WHERE user_id = user_uuid 
    AND status IN ('active', 'trial')
    AND (trial_end IS NULL OR trial_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's current plan
CREATE OR REPLACE FUNCTION get_user_plan(user_uuid UUID)
RETURNS TABLE (
  plan_id TEXT,
  status TEXT,
  trial_end TIMESTAMP WITH TIME ZONE,
  days_left INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.plan_id,
    up.status,
    up.trial_end,
    CASE 
      WHEN up.status = 'trial' AND up.trial_end IS NOT NULL 
      THEN GREATEST(0, EXTRACT(DAY FROM (up.trial_end - NOW())))
      ELSE NULL
    END as days_left
  FROM user_plans up
  WHERE up.user_id = user_uuid
  AND up.status IN ('active', 'trial');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default free plan for existing users (optional)
-- This will give all existing users access to the free tier
INSERT INTO user_plans (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_plans);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_plans TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_plan(UUID) TO authenticated;

-- =============================================
-- Workflow Templates Marketplace Schema (Templates, Versions, Installs)
-- =============================================

-- Templates table
create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text default 'general',
  tags text[] default '{}',
  is_public boolean default false,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','rejected','archived')),
  usage_count integer not null default 0,
  rating numeric(3,2) default 0.00,
  preview_images text[] default '{}',
  latest_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Versions table
create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  version text not null, -- semver string
  changelog text,
  config jsonb not null, -- nodes/edges/canvas_config
  dependencies jsonb default '[]'::jsonb, -- [{name, version}]
  screenshots text[] default '{}',
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Installs/telemetry table
create table if not exists public.template_installs (
  id bigserial primary key,
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text default 'gallery',
  created_at timestamptz not null default now()
);

-- Indices
create index if not exists idx_workflow_templates_public on public.workflow_templates(is_public, status);
create index if not exists idx_workflow_templates_category on public.workflow_templates(category);
create index if not exists idx_workflow_templates_updated_at on public.workflow_templates(updated_at desc);
create index if not exists idx_template_versions_template on public.template_versions(template_id);
create index if not exists idx_template_installs_template on public.template_installs(template_id);
create index if not exists idx_template_installs_user on public.template_installs(user_id);

-- RLS
alter table public.workflow_templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.template_installs enable row level security;

-- Policies: templates
-- Public can read approved public templates
create policy if not exists "templates_select_public_approved"
  on public.workflow_templates for select to authenticated
  using (is_public = true and status = 'approved');

-- Owners can read their own templates regardless of status
create policy if not exists "templates_select_owner"
  on public.workflow_templates for select to authenticated
  using (owner_id = auth.uid());

-- Owners can insert new templates (draft)
create policy if not exists "templates_insert_owner"
  on public.workflow_templates for insert to authenticated
  with check (owner_id = auth.uid());

-- Owners can update their templates when not approved (draft/pending/rejected)
create policy if not exists "templates_update_owner_nonapproved"
  on public.workflow_templates for update to authenticated
  using (owner_id = auth.uid() and status in ('draft','pending_review','rejected'))
  with check (owner_id = auth.uid() and status in ('draft','pending_review','rejected'));

-- Service role can update for moderation (approve/reject)
create policy if not exists "templates_update_moderation_service"
  on public.workflow_templates for update to service_role
  using (true) with check (true);

-- Policies: template versions
-- Public can read versions of approved public templates
create policy if not exists "versions_select_public"
  on public.template_versions for select to authenticated
  using (exists (
    select 1 from public.workflow_templates t
    where t.id = template_id and t.is_public = true and t.status = 'approved'
  ) or submitted_by = auth.uid());

-- Owners can insert new versions for their templates
create policy if not exists "versions_insert_owner"
  on public.template_versions for insert to authenticated
  with check (exists (
    select 1 from public.workflow_templates t where t.id = template_id and t.owner_id = auth.uid()
  ));

-- Service role can update versions to mark reviewed/approved
create policy if not exists "versions_update_service"
  on public.template_versions for update to service_role
  using (true) with check (true);

-- Installs: only via RPC (no direct insert)
create policy if not exists "installs_select_owner"
  on public.template_installs for select to authenticated
  using (user_id = auth.uid());

-- Popularity score view: combines usage_count and recent installs
create or replace view public.workflow_templates_ranked as
  select
    t.*,
    coalesce(t.usage_count,0)
      + coalesce((select count(*) from public.template_installs i where i.template_id = t.id and i.created_at > now() - interval '30 days'),0) * 2
      + coalesce((t.rating * 20)::int, 0) as popularity_score
  from public.workflow_templates t
  where (t.is_public = true and t.status = 'approved')
     or (t.owner_id = auth.uid());

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_workflow_templates_updated_at on public.workflow_templates;
create trigger trg_workflow_templates_updated_at
before update on public.workflow_templates
for each row execute function public.set_updated_at();

-- Telemetry RPC: record install and increment usage_count
create or replace function public.record_template_install(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  insert into public.template_installs (template_id, user_id)
  values (p_template_id, v_user)
  on conflict do nothing;

  update public.workflow_templates
    set usage_count = coalesce(usage_count,0) + 1,
        updated_at = now()
  where id = p_template_id;
end;
$$;

grant execute on function public.record_template_install(uuid) to authenticated;
