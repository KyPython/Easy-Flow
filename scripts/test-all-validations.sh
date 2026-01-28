#!/bin/bash
# Test all major shell validation scripts in scripts/
# Exits nonzero if any script fails

set -e

SCRIPTS=(
  validate-srp.sh
  validate-cicd-workflows.sh
  validate-codebase-organization.sh
  validate-duplicate-code.sh
  validate-duplicate-features.sh
  validate-dynamic-code.sh
  validate-learning-system.sh
  validate-theme-consistency.sh
  validate-unused-code.sh
  validate-analytics-tracking.sh
)

FAILED=0
for script in "${SCRIPTS[@]}"; do
  if [ -x "scripts/$script" ]; then
    echo "Running $script..."
    if ! bash "scripts/$script"; then
      echo "❌ $script failed"
      FAILED=1
    else
      echo "✅ $script passed"
    fi
  else
    echo "⚠ $script not found or not executable"
  fi
done

if [ $FAILED -ne 0 ]; then
  echo "Some validation scripts failed."
  exit 1
else
  echo "All validation scripts passed."
  exit 0
fi
