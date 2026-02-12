#!/usr/bin/env bash
# Setup GitHub branch protection for a repo (non-destructive template)
# Usage: GITHUB_TOKEN=*** GITHUB_REPO=owner/repo ./setup-branch-protection.sh
set -euo pipefail

if [ -z "${GITHUB_REPO:-}" ]; then
  echo "GITHUB_REPO not set. Example: GITHUB_REPO=owner/repo" >&2
  exit 2
fi
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN not set. Provide a token with repo:admin" >&2
  exit 2
fi

BRANCH=${BRANCH:-main}

echo "Setting branch protection for $GITHUB_REPO branch $BRANCH"

curl -sS -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$GITHUB_REPO/branches/$BRANCH/protection \
  -d '{
    "required_status_checks": {"strict": true, "contexts": []},
    "enforce_admins": true,
    "required_pull_request_reviews": {"dismiss_stale_reviews": true, "required_approving_review_count": 1},
    "restrictions": null
  }'

echo "Branch protection request sent. Check GitHub for status or errors."
