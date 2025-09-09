-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.automation_logs (
  id bigint NOT NULL DEFAULT nextval('automation_logs_id_seq'::regclass),
  task text,
  url text,
  username text,
  status text CHECK (status = ANY (ARRAY['completed'::text, 'failed'::text])),
  artifact_url text,
  result jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid,
  user_id uuid,
  status text NOT NULL CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  result jsonb,
  created_at timestamp with time zone DEFAULT now(),
  artifact_url text,
  file_ids ARRAY DEFAULT '{}'::uuid[],
  CONSTRAINT automation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_runs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.automation_tasks(id),
  CONSTRAINT automation_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.automation_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  description text,
  url text,
  parameters jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  task_type text,
  CONSTRAINT automation_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT automation_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.email_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  to_email text NOT NULL,
  template text NOT NULL,
  data jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  claimed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_queue_pkey PRIMARY KEY (id),
  CONSTRAINT email_queue_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.file_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL,
  shared_by uuid NOT NULL,
  shared_with uuid,
  share_token text UNIQUE,
  permissions text NOT NULL DEFAULT 'view'::text CHECK (permissions = ANY (ARRAY['view'::text, 'download'::text])),
  max_downloads integer,
  download_count integer DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT file_shares_pkey PRIMARY KEY (id),
  CONSTRAINT file_shares_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id),
  CONSTRAINT file_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id),
  CONSTRAINT file_shares_shared_with_fkey FOREIGN KEY (shared_with) REFERENCES auth.users(id)
);
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  original_name text NOT NULL,
  display_name text,
  description text,
  storage_path text NOT NULL UNIQUE,
  storage_bucket text NOT NULL DEFAULT 'artifacts'::text,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_extension text,
  checksum_md5 text,
  task_id uuid,
  run_id uuid,
  visibility text NOT NULL DEFAULT 'private'::text CHECK (visibility = ANY (ARRAY['private'::text, 'shared'::text, 'public'::text])),
  is_temporary boolean DEFAULT false,
  expires_at timestamp with time zone,
  folder_path text DEFAULT '/'::text,
  tags ARRAY DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  thumbnail_path text,
  download_count integer DEFAULT 0,
  last_accessed timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.automation_runs(id),
  CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT files_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.automation_tasks(id)
);
CREATE TABLE public.forwarded_event_ids (
  id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT forwarded_event_ids_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marketing_events (
  id bigint NOT NULL DEFAULT nextval('marketing_events_id_seq'::regclass),
  user_id text,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  utm jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT marketing_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
  id integer NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  user_id uuid NOT NULL,
  sales numeric DEFAULT 0,
  completed boolean DEFAULT false,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL CHECK (status = ANY (ARRAY['succeeded'::text, 'failed'::text, 'pending'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plan_feature_labels (
  feature_key text NOT NULL,
  feature_label text NOT NULL,
  CONSTRAINT plan_feature_labels_pkey PRIMARY KEY (feature_key)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  billing_interval USER-DEFINED NOT NULL DEFAULT 'month'::billing_interval,
  external_product_id text UNIQUE,
  feature_flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  polar_url text,
  description text,
  is_most_popular boolean DEFAULT false,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  notification_preferences jsonb DEFAULT '{"sms_alerts": false, "system_alerts": true, "task_failures": true, "weekly_reports": true, "security_alerts": true, "task_completion": true, "marketing_emails": true, "push_notifications": true, "email_notifications": true}'::jsonb,
  ui_preferences jsonb DEFAULT '{"theme": "light", "language": "en", "timezone": "UTC", "date_format": "MM/DD/YYYY", "dashboard_layout": "grid"}'::jsonb,
  fcm_token text,
  phone_number text,
  plan_id text DEFAULT 'free'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles_int (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_int_pkey PRIMARY KEY (id)
);
CREATE TABLE public.referrals (
  id bigint NOT NULL DEFAULT nextval('referrals_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  owner_user_id uuid,
  redeemed_by_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  redeemed_at timestamp with time zone,
  reward_granted boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  referred_user_id uuid,
  referral_code text,
  CONSTRAINT referrals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])),
  external_payment_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_features (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_features_pkey PRIMARY KEY (id),
  CONSTRAINT user_features_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings (
  id bigint NOT NULL DEFAULT nextval('user_settings_id_seq'::regclass),
  user_id uuid NOT NULL UNIQUE,
  email_notifications boolean DEFAULT true,
  weekly_reports boolean DEFAULT true,
  sms_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT true,
  task_completion boolean DEFAULT true,
  task_failures boolean DEFAULT true,
  system_alerts boolean DEFAULT true,
  marketing_emails boolean DEFAULT true,
  security_alerts boolean DEFAULT true,
  deal_updates boolean DEFAULT true,
  customer_alerts boolean DEFAULT true,
  theme text DEFAULT 'light'::text CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text])),
  dashboard_layout text DEFAULT 'grid'::text CHECK (dashboard_layout = ANY (ARRAY['grid'::text, 'list'::text])),
  timezone text DEFAULT 'UTC'::text,
  date_format text DEFAULT 'MM/DD/YYYY'::text,
  language text DEFAULT 'en'::text,
  fcm_token text,
  phone_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);