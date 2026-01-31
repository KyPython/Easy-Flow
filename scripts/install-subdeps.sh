#!/usr/bin/env bash
# Install dependencies for nested subprojects used in CI
set -euo pipefail
ROOT=$(pwd)

SUBDIRS=(
  "rpa-system/rpa-dashboard"
  "rpa-system/backend"
  "services/rag"
)

for d in "${SUBDIRS[@]}"; do
  if [ -d "$d" ] && [ -f "$d/package.json" ]; then
    echo "Installing deps in $d"
    cd "$d"
    # Use --prefer-offline in CI? keep default to ensure fresh installs
    npm ci
    cd "$ROOT"
  else
    echo "Skipping $d (not present)"
  fi
done

echo "Subproject dependency install complete"
