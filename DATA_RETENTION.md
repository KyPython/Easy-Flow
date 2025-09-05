# DATA_RETENTION.md

Purpose: describe what data EasyFlow persists and how to manage retention (development / early-stage).

## What we store (typical)

- User records and authentication (managed by Supabase / Auth provider).
- Task metadata (task id, title, status, timestamps, type) required to run and display automations.
- Automation artifacts (temporary downloads) stored under the automation service `/downloads/` directory by default.
- Integration metadata (connected service IDs, non-sensitive connection metadata).

## Sensitive data and credentials

- Credentials submitted to automations SHOULD be encrypted before transit. The automation worker supports decrypting AES-GCM encrypted credentials via CREDENTIAL_ENCRYPTION_KEY.
- Secrets and raw credentials must not be logged. Ensure logs are redacted in production.

## Retention guidance

- Temporary downloads (automation service `/downloads/`) should be removed after processing. Default recommendation: purge files older than 7 days.
- Task metadata: retain as needed for user experience (e.g., 90 days), configurable via environment or admin UI.
- Authentication logs and audit trails: retain per regulatory requirements.

## How to purge / configure

- Automation downloads: add a cron job or CI job to remove files older than N days in `/downloads/`.
- Database retention: use SQL to delete old rows or add a TTL job depending on DB provider.

Example purge (Postgres):

```
-- delete task artifacts older than 90 days
DELETE FROM tasks WHERE created_at < NOW() - INTERVAL '90 days';
```

## Developer notes

- Treat DATA_RETENTION.md as the minimal policy. For production/legal requirements, formalize into a privacy policy and implement automated retention jobs.
