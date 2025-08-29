-- Migration: create plans and subscriptions tables + apply_subscription RPC

-- Plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_cents int NOT NULL,
  interval text NOT NULL,
  external_product_id text,
  feature_flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  status text,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  external_payment_id text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Optional RPC to apply subscription in a transaction
CREATE OR REPLACE FUNCTION public.apply_subscription_transaction(p_user_id uuid, p_plan_id uuid, p_external_payment_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE external_payment_id = p_external_payment_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_id, status, external_payment_id)
  VALUES (p_user_id, p_plan_id, 'active', p_external_payment_id);

  -- Update profiles table if present
  BEGIN
    UPDATE public.profiles SET plan_id = p_plan_id WHERE id = p_user_id;
  EXCEPTION WHEN undefined_table THEN
    -- ignore if profiles table doesn't exist
    RAISE NOTICE 'profiles table not found; skipping profile update';
  END;
END;
$$;
