#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DB_BACKUP_BUCKET:-}" ]; then
  echo "DB_BACKUP_BUCKET not configured; skipping backup"
  exit 0
fi

TIMESTAMP=$(date +%F_%H%M%S)
DUMPFILE="/tmp/easyflow-db-${TIMESTAMP}.dump"

echo "Dumping local Postgres database to ${DUMPFILE}..."
PGHOST=${DB_HOST:-localhost}
PGPORT=${DB_PORT:-5432}
PGUSER=${DB_USER:-postgres}
PGDB=${DB_NAME:-easyflow}

export PGPASSWORD="${DB_PASSWORD:-}"
pg_dump -Fc -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" "${PGDB}" -f "${DUMPFILE}"

echo "Uploading to ${DB_BACKUP_BUCKET}..."
gsutil cp "${DUMPFILE}" "${DB_BACKUP_BUCKET}/" && rm -f "${DUMPFILE}"
echo "Backup complete"
