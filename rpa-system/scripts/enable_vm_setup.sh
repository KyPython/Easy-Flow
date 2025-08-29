#!/bin/bash
# Run this on the VM as the deploy user (e.g., 'ubuntu' or 'ky').
set -euo pipefail
echo "Running EasyFlow VM enable script"

if [ "$EUID" -eq 0 ]; then
  echo "This script should be run as the deploy user (not root). Use sudo for commands that require elevation when prompted."
fi

SRC_DIR="$HOME/rpa-system"
if [ ! -d "$SRC_DIR" ]; then
  echo "Expected $SRC_DIR to exist. Please clone or copy the repo to $SRC_DIR and rerun."
  exit 2
fi

echo "Installing systemd unit..."
sudo cp "$SRC_DIR/systemd/rpa-system.service" /etc/systemd/system/rpa-system.service
sudo systemctl daemon-reload
sudo systemctl enable --now rpa-system.service
echo "systemd unit installed and started"

echo "Installing cert renewal hook..."
sudo cp "$SRC_DIR/scripts/cert_renew_hook.sh" /usr/local/bin/easyflow-cert-hook.sh
sudo chmod +x /usr/local/bin/easyflow-cert-hook.sh

echo "Adding certbot renew cron (if certbot exists)..."
if command -v certbot >/dev/null 2>&1; then
  sudo crontab -l 2>/dev/null | { cat; echo "0 */12 * * * /usr/bin/certbot renew --quiet --deploy-hook '/usr/local/bin/easyflow-cert-hook.sh'"; } | sudo crontab -
  echo "certbot cron added"
else
  echo "certbot not found; skipping certbot cron. Install certbot or configure cert renewal elsewhere."
fi

echo "Installing daily backup script (won't run unless DB_BACKUP_BUCKET set in .env)..."
sudo cp "$SRC_DIR/scripts/daily_db_backup.sh" /usr/local/bin/easyflow-daily-backup.sh
sudo chmod +x /usr/local/bin/easyflow-daily-backup.sh
crontab -l 2>/dev/null | { cat; echo "5 2 * * * /usr/local/bin/easyflow-daily-backup.sh >/dev/null 2>&1"; } | crontab -
echo "backup cron added (will be a no-op until DB_BACKUP_BUCKET is set in $SRC_DIR/.env)"

echo "Done. Check service status with: sudo systemctl status rpa-system.service"
