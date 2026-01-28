#!/bin/bash
# Test all major shell validation scripts in scripts/
# Exits nonzero if any script fails (strict mode on main branch)
# Permissive mode on feature branches (failures become warnings)

set -e

# Check for permissive mode (non-main branches in CI)
# Strict mode only on direct push to main (GITHUB_REF=refs/heads/main)
# PRs targeting main are permissive since they're not yet merged
PERMISSIVE_MODE=false
if [ -n "$GITHUB_REF" ]; then
  if [ "$GITHUB_REF" != "refs/heads/main" ]; then
    PERMISSIVE_MODE=true
    echo "ℹ️  Running in permissive mode (not direct push to main) - failures are warnings"
  fi
fi

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
      if [ "$PERMISSIVE_MODE" = true ]; then
        echo "⚠️  $script has issues (non-blocking on feature branch)"
      else
        echo "❌ $script failed"
        FAILED=1
      fi
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
  if [ "$PERMISSIVE_MODE" = true ]; then
    echo "⚠️  Validation complete with warnings (permissive mode)"
  else
    echo "All validation scripts passed."
  fi
  exit 0
fi
