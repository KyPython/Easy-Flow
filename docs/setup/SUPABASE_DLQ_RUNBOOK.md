**Supabase DLQ & Retry Runbook**

Purpose: quick checklist and exact commands to apply the DLQ + retry migrations, verify them in Supabase, and run maintenance (resubmit) after the database is back online.

Files in this repo you will use:
- `migrations/upgrade_tasks_dlq.sql`
- `migrations/create_task_views_and_resubmit.sql`

Before you start
- Take a backup of the `tasks` table (or full DB) via Supabase Backups or `pg_dump`:

```bash
# Example (locally, requires a DATABASE_URL env var):
pg_dump --table=public.tasks "$DATABASE_URL" > backups/tasks-$(date +%F).sql
```

Applying the migrations (two options)

1) Supabase SQL Editor (recommended for one-off runs)
- Open your Supabase project → SQL Editor.
- Paste the contents of `migrations/upgrade_tasks_dlq.sql` and run.
- Paste the contents of `migrations/create_task_views_and_resubmit.sql` and run.

2) psql / CI (automated)
- If you have a `DATABASE_URL` for the target DB, run:

```bash
psql "$DATABASE_URL" -f migrations/upgrade_tasks_dlq.sql
psql "$DATABASE_URL" -f migrations/create_task_views_and_resubmit.sql
```

What the scripts do (high level)
- Add `retry_count`, `max_retries`, `last_error`, `retry_after` to `public.tasks`.
- Add/replace a `tasks_status_check` constraint to include `DEAD_LETTER`.
- Add an index `idx_tasks_fetch_queue` to speed up worker fetches.
- Create two views: `public.task_system_health` and `public.dlq_inspector`.
- Create the `public.resubmit_dead_letters()` function to move `DEAD_LETTER` tasks back to `pending`.

Important: enum vs check-constraint
- If your `status` column uses a Postgres ENUM type (e.g. `task_status`) instead
  of a CHECK constraint, the migration may not add `DEAD_LETTER`. Detect with:

```sql
SELECT pg_type.typname
FROM pg_attribute
JOIN pg_type ON pg_attribute.atttypid = pg_type.oid
WHERE attrelid = 'public.tasks'::regclass AND attname = 'status';
```
- If an ENUM is used, add the value manually before running the CHECK-change script:

```sql
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'DEAD_LETTER';
```

Verify after running
- Confirm columns exist:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='tasks';
```
- Check the index:

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'tasks';
```
- Check views:

```sql
SELECT * FROM public.task_system_health;
SELECT * FROM public.dlq_inspector LIMIT 10;
```

Calling the resubmit function (when ready)
- After you patch the bug and want to re-run all dead tasks:

```sql
SELECT public.resubmit_dead_letters();
```

Worker behaviour: fetch + failure handling (copy into your worker code)
- Atomic fetch (use SKIP LOCKED):

```sql
UPDATE public.tasks
SET status = 'processing', updated_at = NOW()
WHERE id = (
  SELECT id FROM public.tasks
  WHERE status = 'pending' AND (retry_after IS NULL OR retry_after <= NOW())
  ORDER BY priority DESC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```
- On failure: increment retry_count, set next retry_after, or mark DEAD_LETTER when exhausted.

```sql
UPDATE public.tasks
SET
  retry_count = retry_count + 1,
  last_error = $1,
  status = CASE WHEN retry_count + 1 >= COALESCE(max_retries, 3) THEN 'DEAD_LETTER' ELSE 'pending' END,
  retry_after = NOW() + (POWER(2, retry_count + 1) * INTERVAL '1 minute'),
  updated_at = NOW()
WHERE id = $2;
```

Quick dashboard checks in Supabase Studio
- Use `public.task_system_health` for top-line counts.
- Use `public.dlq_inspector` to inspect recent dead tasks and last_error messages.

Rollback & safety notes
- Adding an enum value is effectively irreversible; be careful when altering enum types.
- If you need to roll back the column additions, restore from the backup taken earlier.
- Test the full flow in a staging Supabase instance before applying to production.

If you want, I can:
- Add a tiny `examples/worker_demo.py` showing the fetch + failure handling (SKIP LOCKED) and how to call the resubmit function programmatically.
- Add a one-click Supabase SQL script (single combined file) that teams can paste into the SQL editor.
