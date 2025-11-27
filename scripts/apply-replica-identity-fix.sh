#!/usr/bin/env bash
set -euo pipefail

# Usage: export DATABASE_URL="postgresql://user:pass@host:port/db" && ./scripts/apply-replica-identity-fix.sh
# This script finds tables that are part of logical replication publications
# but do not have REPLICA IDENTITY FULL and applies the idempotent ALTER.

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Please set DATABASE_URL environment variable (psql connection string)."
  echo "Example: export DATABASE_URL=\"postgresql://user:pass@host:5432/dbname\""
  exit 1
fi

echo "Detecting publication tables with relreplident != 'f'..."
SQL="SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS full_table\nFROM pg_class c\nJOIN pg_namespace n ON c.relnamespace = n.oid\nJOIN pg_publication_rel r ON r.prrelid = c.oid\nWHERE c.relreplident <> 'f'\n  AND n.nspname NOT IN ('pg_catalog','information_schema')\nORDER BY n.nspname, c.relname;"

tables=$(psql "$DATABASE_URL" -t -c "$SQL" | sed '/^\s*$/d' || true)

if [ -z "$tables" ]; then
  echo "No publication tables require REPLICA IDENTITY FULL. Nothing to do."
  exit 0
fi

echo "Tables to alter (will apply REPLICA IDENTITY FULL):"
echo "$tables"

while IFS= read -r table; do
  # guard against empty lines
  if [ -z "${table// /}" ]; then
    continue
  fi
  echo "Applying: ALTER TABLE $table REPLICA IDENTITY FULL;"
  psql "$DATABASE_URL" -c "ALTER TABLE $table REPLICA IDENTITY FULL;"
done <<EOF
$tables
EOF

echo "All done. Re-run the publication-check query to verify changes."
