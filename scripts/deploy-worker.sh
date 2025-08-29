#!/bin/bash
# Simple deploy helper to restart the email worker container via docker compose
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
COMPOSE_FILE=rpa-system/docker-compose.yml
SERVICE=email_worker
# ensure env is loaded from rpa-system/.env
export $(grep -v '^#' rpa-system/.env | xargs)

echo "Pulling latest image not needed for local node image; recreating $SERVICE"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps "$SERVICE"

echo "Restarted $SERVICE"
