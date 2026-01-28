#!/bin/bash
# CI/CD Workflow Validation Script
# Lightweight sanity checks for `.github/workflows`.
#
# Goals:
# - Catch merge/conflict artifacts and obvious duplicates that break CI
# - Avoid false positives (e.g., treating `on:` triggers as jobs)

set -e

WORKFLOWS_DIR=".github/workflows"
FAILED=0

# 1. Enumerate workflow files
WORKFLOW_FILES=$(find "$WORKFLOWS_DIR" \( -name "*.yml" -o -name "*.yaml" \) 2>/dev/null | sort)
if [ -z "$WORKFLOW_FILES" ]; then
  echo "⚠️  No workflow files found under $WORKFLOWS_DIR"
  exit 0
fi

# 2. Check for duplicate workflow file basenames (basename must be unique)
DUPLICATE_NAMES=$(echo "$WORKFLOW_FILES" | awk -F/ '{print $NF}' | sort | uniq -d)
if [ -n "$DUPLICATE_NAMES" ]; then
  echo "❌ Duplicate workflow file names found:"
  echo "$DUPLICATE_NAMES"
  FAILED=1
fi

# 3. File-level sanity checks
for wf in $WORKFLOW_FILES; do
  # Merge conflict markers should never land in workflow files.
  # Avoid false positives on comment separators like "======".
  if grep -qE '^(<<<<<<<|>>>>>>>|=======$)' "$wf"; then
    echo "❌ Merge conflict markers found in $wf"
    FAILED=1
  fi

  # Validate that the workflow defines jobs
  if ! grep -q '^jobs:' "$wf"; then
    echo "⚠️  $wf has no jobs defined"
    continue
  fi

  # Extract job ids *only* from the `jobs:` section (avoid `on:` trigger keys, etc.)
  JOB_IDS=$(
    awk '
      /^jobs:/ { in_jobs=1; next }
      in_jobs && /^[^ ]/ { in_jobs=0 }
      in_jobs && /^  [A-Za-z0-9_-]+:/ {
        line=$0
        sub(/^  /,"",line)
        sub(/:.*/,"",line)
        print line
      }
    ' "$wf"
  )

  # Duplicate job ids within a single workflow is a hard error
  DUP_JOB_IDS=$(echo "$JOB_IDS" | sort | uniq -d || true)
  if [ -n "$DUP_JOB_IDS" ]; then
    echo "❌ Duplicate job ids found in $wf:"
    echo "$DUP_JOB_IDS"
    FAILED=1
  fi
done

if [ $FAILED -ne 0 ]; then
  echo "❌ CI/CD workflow validation failed."
  exit 1
else
  echo "✅ All CI/CD workflows validated."
  exit 0
fi
