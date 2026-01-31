Multi-tenant Kafka guidance

Goals
- Ensure messages carry tenant identity and avoid creating per-tenant topics.

Producer guidance
- Use a single shared topic per domain (events, commands) and set the Kafka message key to `tenant_id` so records for a tenant are partitioned together.
- Add a `tenant-id` header on messages for consumers that prefer header-based lookup.

Consumer guidance
- Read `tenant-id` header first, fallback to message payload `tenant_id` field.
- Use the tenant value to set DB session tenant (see `rpa-system/worker/set_tenant.py`).

Migration plan away from per-tenant topics
1) Inventory: list all topics that follow tenant naming patterns.
2) Create new shared topics with an agreed naming convention (e.g., `easyflow.events`, `easyflow.commands`).
3) Provision consumers to read from both old and new topics during migration, transforming/forwarding messages to the shared topic with proper tenant key and header.
4) Update producers to publish to shared topics with key=tenant_id and header `tenant-id`.
5) After sufficient mirror/dual-run verification, decommission per-tenant topics.

Backpressure and quotas
- Ensure broker quotas/partition limits are reviewed; consolidating topics reduces total topic count and management overhead.

Deploy RLS for `workflows` table
- When Supabase/EasyFlow DB is accessible, add tenant RLS for the `workflows` table (run in staging first):

	ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
	CREATE POLICY tenant_isolation ON workflows
	USING (tenant_id = current_setting('app.current_tenant')::uuid);

	See `docs/deploy-workflows-rls.md` for details and validation steps.
