#!/bin/bash
# Validate that documentation is up to date with the codebase
# Fails if docs/ or README.md are not updated when code, APIs, or scripts change

set -e

CHANGED_FILES=$(git diff --name-only origin/main...HEAD)

DOC_FILES_CHANGED=$(echo "$CHANGED_FILES" | grep -E '^(README.md|docs/|.*\.md$)' || true)
CODE_FILES_CHANGED=$(echo "$CHANGED_FILES" | grep -E '\.(js|ts|jsx|tsx|py|sh)$' | grep -vE 'test|spec' || true)

if [ -n "$CODE_FILES_CHANGED" ] && [ -z "$DOC_FILES_CHANGED" ]; then
  echo "❌ Code or scripts changed, but no documentation was updated."
  echo "   Please update README.md or docs/ to reflect your changes."
  echo "   Changed code files:"
  echo "$CODE_FILES_CHANGED"
  exit 1
fi

# Check for TODOs or outdated references in docs
OUTDATED=$(grep -rniE 'TODO|FIXME|outdated|update' docs/ README.md || true)
if [ -n "$OUTDATED" ]; then
  echo "❌ Found TODOs or outdated references in documentation:"
  echo "$OUTDATED"
  exit 1
fi

echo "✅ Documentation is in sync with the codebase."
exit 0
