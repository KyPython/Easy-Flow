-- Update claim function to set claimed_at timestamp so workers can detect stale claims
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

-- Optional: create an index on claimed_at to speed reclamation queries
CREATE INDEX IF NOT EXISTS idx_email_queue_claimed_at ON public.email_queue (claimed_at);
