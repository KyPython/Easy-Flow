-- Fix: use the actual email_queue.id type (id%TYPE) instead of assuming uuid
-- This avoids 'invalid input syntax for type uuid' when id is an integer serial.
CREATE OR REPLACE FUNCTION public.claim_email_queue_item(now_ts timestamptz)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
AS $$
DECLARE
  v_id public.email_queue.id%TYPE;
  v_row public.email_queue%ROWTYPE;
BEGIN
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
