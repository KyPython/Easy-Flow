#!/bin/bash
# CI/CD Workflow Validation Script
# Checks for duplicate job/step names, SRP violations, and unused workflows in .github/workflows

set -e

WORKFLOWS_DIR=".github/workflows"
FAILED=0

# 1. Check for duplicate workflow file names
WORKFLOW_FILES=$(find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" 2>/dev/null | sort)
DUPLICATE_NAMES=$(echo "$WORKFLOW_FILES" | xargs -n1 basename | sort | uniq -d)
if [ -n "$DUPLICATE_NAMES" ]; then
  echo "❌ Duplicate workflow file names found:"
  echo "$DUPLICATE_NAMES"
  FAILED=1
fi

# 2. Check for duplicate job names within and across workflows
ALL_JOBS=$(grep -h '^  [a-zA-Z0-9_-]*:' $WORKFLOWS_DIR/*.yml | sed 's/^  //;s/:$//' | sort)
DUPLICATE_JOBS=$(echo "$ALL_JOBS" | uniq -d)
if [ -n "$DUPLICATE_JOBS" ]; then
  echo "❌ Duplicate job names found:"
  echo "$DUPLICATE_JOBS"
  FAILED=1
fi

# 3. Check for workflows with too many unrelated jobs (SRP violation: >3 jobs)
for wf in $WORKFLOW_FILES; do
  JOB_COUNT=$(grep -c '^  [a-zA-Z0-9_-]*:' "$wf")
  if [ "$JOB_COUNT" -gt 3 ]; then
    echo "⚠️  $wf may violate SRP (has $JOB_COUNT jobs)"
    FAILED=1
  fi
  # Check for duplicate step names within each job
  STEP_NAMES=$(grep -h 'name:' "$wf" | sed 's/.*name: //')
  DUP_STEP=$(echo "$STEP_NAMES" | sort | uniq -d)
  if [ -n "$DUP_STEP" ]; then
    echo "❌ Duplicate step names in $wf:"
    echo "$DUP_STEP"
    FAILED=1
  fi
  # Check for jobs with >10 steps (SRP violation)
  JOBS=$(grep -n '^  [a-zA-Z0-9_-]*:' "$wf" | cut -d: -f1)
  for line in $JOBS; do
    STEPS=$(tail -n +$line "$wf" | grep -m 1 -B 1 'steps:' | grep -v 'steps:' | wc -l)
    if [ "$STEPS" -gt 10 ]; then
      echo "⚠️  Job at line $line in $wf has >10 steps (SRP?)"
      FAILED=1
    fi
  done
  # Check for unused workflows (no jobs)
  if ! grep -q '^jobs:' "$wf"; then
    echo "⚠️  $wf has no jobs defined (unused?)"
    FAILED=1
  fi
  # Check for redundant triggers (multiple on: for same event)
  TRIGGERS=$(grep '^on:' "$wf" | wc -l)
  if [ "$TRIGGERS" -gt 1 ]; then
    echo "⚠️  $wf has multiple 'on:' triggers (redundant?)"
    FAILED=1
  fi
  # Check for jobs with unrelated names (naive: if job names are very different)
  JOB_NAMES=$(grep '^  [a-zA-Z0-9_-]*:' "$wf" | sed 's/^  //;s/:$//')
  if [ $(echo "$JOB_NAMES" | wc -l) -gt 1 ]; then
    FIRST=$(echo "$JOB_NAMES" | head -1)
    for j in $JOB_NAMES; do
      if [[ "$j" != *"$FIRST"* ]]; then
        echo "⚠️  $wf may have unrelated jobs: $FIRST vs $j"
        FAILED=1
      fi
    done
  fi
fi

done

if [ $FAILED -ne 0 ]; then
  echo "❌ CI/CD workflow validation failed."
  exit 1
else
  echo "✅ All CI/CD workflows validated."
  exit 0
fi
