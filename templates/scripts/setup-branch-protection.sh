#!/usr/bin/env bash
# Minimal automated branch protection setup script (GitHub API)
# Usage: set GITHUB_REPO and GITHUB_TOKEN and run this script

set -euo pipefail

if [ -z "${GITHUB_REPO:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Please set GITHUB_REPO (owner/repo) and GITHUB_TOKEN"
  exit 1
fi

echo "Configuring branch protection for 'main' on ${GITHUB_REPO}..."

API="https://api.github.com/repos/${GITHUB_REPO}/branches/main/protection"

payload=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
JSON
)

curl -sS -X PUT -H "Authorization: token ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  -d "${payload}" "${API}" || {
    echo "Failed to configure branch protection"
    exit 1
  }

echo "✓ Branch protection configured (verify in GitHub settings)"
