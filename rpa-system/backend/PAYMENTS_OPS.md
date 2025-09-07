# Payments ops — deploy checklist

This file collects the small operations needed to run Polar payments + Supabase integration reliably.

1. Environment

- Set these env vars in production (never commit to repo):
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE
  - POLAR_API_KEY
  - POLAR_WEBHOOK_SECRET
  - APP_PUBLIC_URL
  - ADMIN_API_SECRET (strong secret for admin endpoints)

2. Run DB migrations

- Apply `migrations/supabase-subscriptions.sql` (creates plans/subscriptions) if not already.
- Apply `migrations/001-create-profiles-and-backfill.sql` to create `profiles` and backfill.

3. Restart backend with a process manager

- Use PM2/systemd/docker-compose to run `index.js` with the env vars above.
- Example quick start (not for production):
  ```bash
  cd /path/to/rpa-system/backend
  POLAR_WEBHOOK_SECRET='...' POLAR_API_KEY='...' SUPABASE_URL='...' SUPABASE_SERVICE_ROLE='...' ADMIN_API_SECRET='...' PORT=4001 node index.js
  ```

4. Verify webhooks

- Confirm Polar webhook target is set to `https://<your-host>/polar-webhook` and the webhook secret matches `POLAR_WEBHOOK_SECRET`.
- Test with the signed webhook payload approach in this README and confirm `public.subscriptions` row is created.

5. Admin approval

- Approve pending subscriptions using the admin endpoint: `POST /admin/approve-subscription` with header `x-admin-secret: <ADMIN_API_SECRET>` and JSON `{ external_payment_id }`.

6. Reconciliation

- Run `node scripts/reconcile_polar.js` daily (cron) to surface pending issues.
- Optionally extend the script to call Polar APIs and auto-fix mismatches.

7. Monitoring

- Add alerting for repeated webhook errors; log to a central place (Sentry/CloudWatch).

8. Security

- Move service keys to a secrets manager and rotate regularly.

9. Next improvements

- Customer portal to manage subscriptions
- Refunds, failed payments handling and grace periods
- Metering for usage-based billing
