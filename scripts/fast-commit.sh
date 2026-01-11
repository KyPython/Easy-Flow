#!/bin/bash
# Fast Commit Script for Dev Branch
# Bypasses all validations for rapid iteration on dev branch
# Usage: ./scripts/fast-commit.sh "commit message"

set -e

COMMIT_MSG="${1:-$(date +'WIP: %Y-%m-%d %H:%M:%S')}"

echo "🚀 Fast commit to dev branch..."
echo "📝 Message: $COMMIT_MSG"

# Skip all hooks and validations
git add -A
git commit --no-verify -m "$COMMIT_MSG"

echo "✅ Committed successfully!"
echo "💡 To push: git push --no-verify origin dev"
