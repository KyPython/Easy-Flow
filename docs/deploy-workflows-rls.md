Deploy RLS for `workflows` table (EasyFlow DB)

When Supabase (or your Postgres instance) is back online, apply the tenant isolation policy for the `workflows` table.

Run this in your EasyFlow DB (staging first):

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workflows
USING (tenant_id = current_setting('app.current_tenant')::uuid);

Notes:
- Ensure the `tenant_id` column exists and uses `uuid` (or adjust cast accordingly).
- Verify that application servers and workers set the session tenant via:
  SELECT set_config('app.current_tenant', $1, true);
- Test with the queries in `easyflow-metrics/tests/test_tenant_rls.sql` before enabling in production.
