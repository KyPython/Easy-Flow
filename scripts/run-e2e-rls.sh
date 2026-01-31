#!/usr/bin/env bash
set -euo pipefail

export PGHOST=${PGHOST:-localhost}
export PGPORT=${PGPORT:-5432}
export PGUSER=${PGUSER:-postgres}
export PGPASSWORD=${PGPASSWORD:-postgres}
export PGDATABASE=${PGDATABASE:-postgres}

echo "Starting RLS e2e script against ${PGHOST}:${PGPORT}/${PGDATABASE} as ${PGUSER}"

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY,
  name text,
  tenant_id uuid
);
TRUNCATE workflows;
INSERT INTO workflows (id,name,tenant_id) VALUES
  ('00000000-0000-0000-0000-000000000001','a','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002','b','00000000-0000-0000-0000-000000000002');
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON workflows;
CREATE POLICY tenant_isolation ON workflows
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
SQL

echo "Inserted rows and enabled tenant_isolation policy"

# Test as tenant 1
psql -t -A -v ON_ERROR_STOP=1 -c "SELECT set_config('app.current_tenant','00000000-0000-0000-0000-000000000001', true);"
OUT1=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM workflows;")
if [ "$OUT1" != "1" ]; then echo "RLS test failed for tenant 1, got: $OUT1"; exit 2; fi

# Test as tenant 2
psql -t -A -v ON_ERROR_STOP=1 -c "SELECT set_config('app.current_tenant','00000000-0000-0000-0000-000000000002', true);"
OUT2=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM workflows;")
if [ "$OUT2" != "1" ]; then echo "RLS test failed for tenant 2, got: $OUT2"; exit 2; fi

# Cross-tenant visibility check
psql -t -A -v ON_ERROR_STOP=1 -c "SELECT set_config('app.current_tenant','00000000-0000-0000-0000-000000000002', true);"
OUTC=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM workflows WHERE tenant_id='00000000-0000-0000-0000-000000000001';")
if [ "$OUTC" != "0" ]; then echo "Cross-tenant visibility failed, got: $OUTC"; exit 2; fi

echo "RLS e2e tests passed"
