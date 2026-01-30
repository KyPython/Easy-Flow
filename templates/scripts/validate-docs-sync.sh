#!/usr/bin/env bash
# Validate that docs/ or README.md are updated when relevant files change

set -euo pipefail

CHANGED_FILES=$(git diff --cached --name-only || true)

DOC_FILES_CHANGED=$(echo "$CHANGED_FILES" | grep -E '^(README.md|docs/|.*\.md$)' || true)

if [ -z "${DOC_FILES_CHANGED}" ]; then
  # If code changes include API or docs-touching files, fail
  if echo "$CHANGED_FILES" | grep -E 'src/|api/|routes/|openapi.yaml' >/dev/null 2>&1; then
    echo "❌ Code changes detected without docs/ or README.md updates. Please update documentation."
    exit 1
  fi
fi

echo "✅ Docs sync validation passed"
