-- Supabase setup: table, RLS policies, and optional storage bucket/policies
-- Run in the SQL editor in your Supabase project.

-- 1) Table for logs
create table if not exists public.automation_logs (
  id bigserial primary key,
  task text,
  url text,
  username text,
  status text check (status in ('completed','failed')),
  artifact_url text,
  result jsonb,
  created_at timestamptz default now()
);

-- Enable RLS (optional; adjust policies for your app's auth model)
alter table public.automation_logs enable row level security;

-- Allow read for all authenticated users (or anon if you prefer)
create policy if not exists "automation_logs_select_authenticated"
  on public.automation_logs for select
  to authenticated
  using (true);

-- If your backend uses the anon key, also allow anon to read logs
create policy if not exists "automation_logs_select_anon"
  on public.automation_logs for select
  to anon
  using (true);

-- Allow inserts from service role only (recommended). If you must allow anon, change to 'to anon'
create policy if not exists "automation_logs_insert_service"
  on public.automation_logs for insert
  to service_role
  with check (true);

-- Optionally allow updates/deletes (often not needed)
-- create policy if not exists "automation_logs_update_service"
--   on public.automation_logs for update to service_role using (true) with check (true);
-- create policy if not exists "automation_logs_delete_service"
--   on public.automation_logs for delete to service_role using (true);


-- 2) Storage bucket for artifacts
-- Create bucket via SQL RPC
insert into storage.buckets (id, name, public) values ('artifacts','artifacts', false)
  on conflict (id) do nothing;

-- Storage RLS policies (for private bucket with signed URL access)
-- Allow service role to read/write (backend uploads & can create signed URLs)
create policy if not exists "artifacts_service_write"
  on storage.objects for insert to service_role
  with check (bucket_id = 'artifacts');

create policy if not exists "artifacts_service_update"
  on storage.objects for update to service_role
  using (bucket_id = 'artifacts') with check (bucket_id = 'artifacts');

create policy if not exists "artifacts_service_delete"
  on storage.objects for delete to service_role
  using (bucket_id = 'artifacts');

create policy if not exists "artifacts_service_select"
  on storage.objects for select to service_role
  using (bucket_id = 'artifacts');

-- If you want the bucket to be public instead (no signed URLs needed), mark it public and allow anon select:
-- update storage.buckets set public = true where id = 'artifacts';
-- create policy if not exists "artifacts_public_select"
--   on storage.objects for select to anon using (bucket_id = 'artifacts');


-- 3) Helpful indexes
-- Speed up recent logs queries
create index if not exists idx_automation_logs_created_at
  on public.automation_logs (created_at desc);

-- Filter by status quickly
create index if not exists idx_automation_logs_status
  on public.automation_logs (status);

-- Optional: quick filtering by URL
create index if not exists idx_automation_logs_url
  on public.automation_logs (url);

-- Optional: JSONB GIN index for querying result payloads
create index if not exists idx_automation_logs_result_gin
  on public.automation_logs using gin (result);

-- 4) Realtime: add table to the default publication so changes stream
do $$
begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    execute 'alter publication supabase_realtime add table public.automation_logs';
  end if;
end $$;
