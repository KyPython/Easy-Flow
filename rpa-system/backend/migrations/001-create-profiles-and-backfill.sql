-- Idempotent migration: create public.profiles and backfill from active subscriptions
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  plan_id uuid REFERENCES public.plans(id),
  created_at timestamptz DEFAULT now()
);

-- Backfill profiles for active subscriptions that don't have a profile yet
INSERT INTO public.profiles (id, plan_id, created_at)
SELECT s.user_id, s.plan_id, now()
FROM public.subscriptions s
LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'active' AND p.id IS NULL
ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id;

-- Ensure an index on subscriptions.external_payment_id exists (migration may already have it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_external_payment_id ON public.subscriptions (external_payment_id);
