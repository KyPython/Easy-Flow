#!/usr/bin/env bash
# EasyFlow template script: validate docs sync
set -euo pipefail

ROOT=$(pwd)
errors=0

echo "[easyflow] validating docs sync"

# Check that adoption doc exists
if [ ! -f docs/EASYFLOW-ADOPTION.md ]; then
	echo "ERROR: docs/EASYFLOW-ADOPTION.md missing"
	errors=$((errors+1))
fi

# Check that README contains adoption section header
if ! grep -q "EASYFLOW-ADOPTION" README.md 2>/dev/null; then
	echo "WARN: README.md does not reference EASYFLOW-ADOPTION (recommended)"
fi

# Check license and contribution guidance exist
for f in CONTRIBUTING.md LICENSE; do
	if [ ! -f "$f" ]; then
		echo "WARN: $f missing — consider adding for standardization"
	fi
done

if [ $errors -gt 0 ]; then
	echo "[easyflow] docs sync validation failed" >&2
	exit 2
fi

echo "[easyflow] docs sync validation passed"
exit 0
