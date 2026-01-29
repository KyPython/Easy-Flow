#!/bin/bash
# Test all major shell validation scripts in scripts/
# In PR context: non-blocking scripts warn but don't fail
# On main branch: all checks are enforced

set -e

echo "ℹ️  Running all validation scripts..."

# Detect PR context
IS_PR=false
if [ -n "$GITHUB_EVENT_NAME" ] && [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
  IS_PR=true
  echo "ℹ️  PR context detected - structural checks will warn but not fail"
fi

# BLOCKING: These must pass in all contexts (critical for functionality)
BLOCKING_SCRIPTS=(
  validate-cicd-workflows.sh
  validate-analytics-tracking.sh
)

# NON-BLOCKING on PRs: These check structural/organizational issues
# They warn on PRs but only fail on main branch pushes
NON_BLOCKING_SCRIPTS=(
  validate-srp.sh
  validate-codebase-organization.sh
  validate-duplicate-code.sh
  validate-duplicate-features.sh
  validate-dynamic-code.sh
  validate-learning-system.sh
  validate-theme-consistency.sh
  validate-unused-code.sh
)

FAILED=0
WARNINGS=0

# Run blocking scripts - must pass
echo ""
echo "━━━ Running blocking validations ━━━"
for script in "${BLOCKING_SCRIPTS[@]}"; do
  if [ -x "scripts/$script" ]; then
    echo "Running $script..."
    if ! bash "scripts/$script"; then
      echo "❌ $script failed (blocking)"
      FAILED=1
    else
      echo "✅ $script passed"
    fi
  else
    echo "⚠ $script not found or not executable"
  fi
done

# Run non-blocking scripts - warn on PRs, fail on main
echo ""
echo "━━━ Running non-blocking validations ━━━"
for script in "${NON_BLOCKING_SCRIPTS[@]}"; do
  if [ -x "scripts/$script" ]; then
    echo "Running $script..."
    if ! bash "scripts/$script"; then
      if [ "$IS_PR" = true ]; then
        echo "⚠️  $script failed (non-blocking on PR - warning only)"
        WARNINGS=$((WARNINGS + 1))
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

# Summary
echo ""
echo "━━━ Validation Summary ━━━"
if [ $FAILED -ne 0 ]; then
  echo "❌ Some blocking validation scripts failed."
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  $WARNINGS non-blocking validation(s) had warnings (acceptable on PRs)"
  echo "✅ All blocking validations passed."
  exit 0
else
  echo "✅ All validation scripts passed."
  exit 0
fi
