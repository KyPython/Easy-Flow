#!/usr/bin/env bash
set -euo pipefail

# Robust runner to verify and apply the replica identity fix using psql.
# Usage (recommended): DATABASE_URL="postgres://user:pass@host:5432/dbname" ./sql/run-replica-fix.sh
# If you don't have a DATABASE_URL but run the local compose stack, pass --docker <container_name>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function usage() {
  cat <<EOF
Usage: $0 [--docker CONTAINER_NAME]

Options:
  --docker CONTAINER_NAME   Run the verification and migration inside a running Docker container
                            that has psql available (useful for local compose environments).
  (default)                 Use DATABASE_URL environment variable and run psql locally.
EOF
  exit 2
}

DOCKER_CONTAINER=""
while [[ ${#@} -gt 0 ]]; do
  case "$1" in
    --docker) DOCKER_CONTAINER="$2"; shift 2;;
    -h|--help) usage;;
    *) usage;;
  esac
done

PSQL_CMD=( )
if [ -n "${DATABASE_URL:-}" ] && [ -z "$DOCKER_CONTAINER" ]; then
  PSQL_CMD=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)
elif [ -n "$DOCKER_CONTAINER" ]; then
  PSQL_CMD=(docker exec -i "$DOCKER_CONTAINER" psql -U easyflow -d easyflow -v ON_ERROR_STOP=1)
else
  echo "Error: either set DATABASE_URL or pass --docker CONTAINER_NAME with a running DB container."
  usage
fi


echo "Running verification before changes..."
if [ -n "$DOCKER_CONTAINER" ]; then
  sed '/^```/d' "$SCRIPT_DIR/verify_replica_identity.sql" | docker exec -i "$DOCKER_CONTAINER" psql -U easyflow -d easyflow -v ON_ERROR_STOP=1
else
  "${PSQL_CMD[@]}" -f "$SCRIPT_DIR/verify_replica_identity.sql"
fi

read -p "Proceed to ALTER TABLE REPLICA IDENTITY FULL for listed tables? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborting. No changes made."
  exit 0
fi

echo "Applying replica identity changes..."
# Strip any markdown fences from the SQL file before feeding to psql
if [ -n "$DOCKER_CONTAINER" ]; then
  sed '/^```/d' "$SCRIPT_DIR/replica_identity_fix.sql" | docker exec -i "$DOCKER_CONTAINER" psql -U easyflow -d easyflow -v ON_ERROR_STOP=1
else
  sed '/^```/d' "$SCRIPT_DIR/replica_identity_fix.sql" | "${PSQL_CMD[@]}"
fi

echo "Verification after changes..."
if [ -n "$DOCKER_CONTAINER" ]; then
  sed '/^```/d' "$SCRIPT_DIR/verify_replica_identity.sql" | docker exec -i "$DOCKER_CONTAINER" psql -U easyflow -d easyflow -v ON_ERROR_STOP=1
else
  "${PSQL_CMD[@]}" -f "$SCRIPT_DIR/verify_replica_identity.sql"
fi

echo "Done. If you’re using Supabase Realtime, monitor logs and client subscriptions for errors."
#!/usr/bin/env bash
set -euo pipefail

# Simple runner to verify and apply the replica identity fix using psql.
# Usage: DATABASE_URL="postgres://user:pass@host:5432/dbname" ./sql/run-replica-fix.sh

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Please set DATABASE_URL environment variable. Example:"
  echo "  DATABASE_URL=\"postgres://user:pass@host:5432/dbname\" ./sql/run-replica-fix.sh"
  exit 2
fi

PSQL_CMD="psql $DATABASE_URL -v ON_ERROR_STOP=1 -q -t -A -F $'\t'"

echo "Verifying current replica identity for target tables..."
echo "---"
echo
cat <<'SQL' | psql "$DATABASE_URL"
-- verify
SELECT
  c.relname AS table_name,
  c.relreplident AS repl_ident,
  CASE c.relreplident WHEN 'd' THEN 'DEFAULT' WHEN 'n' THEN 'NOTHING' WHEN 'f' THEN 'FULL' WHEN 'i' THEN 'INDEX' ELSE c.relreplident END AS repl_identity_text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'profiles','usage_tracking','workflow_executions','workflows','subscriptions'
)
ORDER BY c.relname;

-- publications
SELECT
  p.pubname,
  t.schemaname,
  t.tablename
FROM pg_publication p
JOIN pg_publication_tables t ON p.pubname = t.pubname
WHERE t.schemaname = 'public' AND t.tablename IN ('profiles','usage_tracking','workflow_executions','workflows','subscriptions');
SQL

echo
read -r -p "Apply REPLICA IDENTITY FULL to the listed tables? [y/N] " yn
case "$yn" in
  [Yy]* ) ;;
  * ) echo "Aborted by user."; exit 0;;
esac

echo "Applying replica identity changes..."
cat sql/replica_identity_fix.sql | psql "$DATABASE_URL"

echo "Re-verifying..."
cat sql/verify_replica_identity.sql | psql "$DATABASE_URL"

echo "Done. Please monitor your application and Supabase logs for binding mismatch errors." 
#!/usr/bin/env bash
set -euo pipefail

# Helper to run the verify query and migration using psql
# Usage: DATABASE_URL=postgres://user:pass@host:5432/db ./sql/run-replica-fix.sh

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: set DATABASE_URL environment variable to run this script (psql required)"
  echo "Alternatively, copy the SQL from sql/replica_identity_fix.sql into Supabase SQL editor."
  exit 2
fi

echo "Running verification before changes..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/verify_replica_identity.sql"

read -p "Proceed to ALTER TABLE REPLICA IDENTITY FULL for listed tables? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborting. No changes made."
  exit 0
fi

echo "Applying replica identity changes..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/replica_identity_fix.sql"

echo "Verification after changes..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/verify_replica_identity.sql"

echo "Done. If you’re using Supabase Realtime, monitor logs and client subscriptions for errors."
