This file lists recommended steps to ensure the EasyFlow rpa-system runs 24/7 on a single VM and a minimal CI workflow.

1. Install the systemd unit (replace <DEPLOY_USER> with your VM username):

   sudo cp systemd/rpa-system.service /etc/systemd/system/rpa-system.service
   sudo sed -i 's|<DEPLOY_USER>|ubuntu|g' /etc/systemd/system/rpa-system.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now rpa-system.service

2. Configure certbot renew hook (runs after successful renewal):

   sudo cp scripts/cert_renew_hook.sh /usr/local/bin/easyflow-cert-hook.sh
   sudo chmod +x /usr/local/bin/easyflow-cert-hook.sh

   # Add to certbot renew command or let certbot run hooks; example:

   sudo crontab -l 2>/dev/null | { cat; echo "0 _/12 _ \* \* /usr/bin/certbot renew --quiet --deploy-hook '/usr/local/bin/easyflow-cert-hook.sh'"; } | sudo crontab -

3. Configure daily DB backups (optional):

   # Set DB_BACKUP_BUCKET in your VM environment (e.g. in /home/<user>/rpa-system/.env)

   cp scripts/daily_db_backup.sh /usr/local/bin/easyflow-daily-backup.sh
   sudo chmod +x /usr/local/bin/easyflow-daily-backup.sh

   # add a cron job (runs at 2:05am):

   crontab -l 2>/dev/null | { cat; echo "5 2 \* \* \* /usr/local/bin/easyflow-daily-backup.sh >/dev/null 2>&1"; } | crontab -

4. GitHub Actions: Add secrets to this repo: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_PORT (defaults to 22).

5. Notes:

   - Do not commit production secrets into the repo. Use environment variables or a secrets manager.
   - If you prefer to migrate to Cloud Run + CDN, follow the Cloud Run notes in this repository's README.

6. Email worker automation

- The `email_worker` service is defined in `docker-compose.yml` and reads `SEND_EMAIL_WEBHOOK` and `SUPABASE_*` from `rpa-system/.env`.
- To restart the worker after deploy or when env changes, run:

  docker compose -f rpa-system/docker-compose.yml up -d --force-recreate --no-deps email_worker

- A helper script exists at `scripts/deploy-worker.sh` which can be used on the VM or from CI to restart the worker.
- Add `APP_URL` and `ADMIN_API_SECRET` as GitHub Actions secrets to enable the scheduled `Enqueue Welcome Emails` workflow which calls `/admin/enqueue-welcome` daily.
