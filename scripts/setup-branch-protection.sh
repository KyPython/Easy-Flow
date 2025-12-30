#!/bin/bash
# EasyFlow Automated Branch Protection Setup
# Configures GitHub branch protection rules via GitHub API
# This prevents non-production-ready code from reaching production

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== 🔒 Setting Up Branch Protection for Production Safety ===${NC}\n"

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo "${RED}✗ GitHub CLI (gh) is required but not installed${NC}"
    echo "${YELLOW}Install it with: brew install gh${NC}"
    echo "${YELLOW}Or visit: https://cli.github.com/${NC}"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "${YELLOW}⚠️  Not authenticated with GitHub CLI${NC}"
    echo "${CYAN}Running: gh auth login${NC}"
    gh auth login
fi

# Get repository info
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

echo "${BLUE}Repository: ${CYAN}${REPO_OWNER}/${REPO_NAME}${NC}"
echo "${BLUE}Branch: ${CYAN}main${NC}\n"

# Check if branch protection already exists
if gh api "repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection" &> /dev/null; then
    echo "${YELLOW}⚠️  Branch protection already exists for 'main'${NC}"
    echo "${CYAN}Updating existing protection rules...${NC}\n"
fi

# Required status checks (these workflows must pass)
REQUIRED_CHECKS=(
    "QA — core feature tests / qa"
    "QA — Integration Tests / integration"
    "Code Validation — SRP, Dynamic, Theme, Logging (Branch-Aware) / validate"
    "Terraform Validation / terraform"
)

echo "${BLUE}Configuring branch protection rules...${NC}"

# Build the API payload
# Note: GitHub API uses workflow file names, not display names
# We'll use the job names as contexts
CONTEXTS=("qa" "integration" "validate" "terraform")

# Create protection rule JSON
PROTECTION_JSON=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $(printf '%s\n' "${CONTEXTS[@]}" | jq -R . | jq -s .)
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_linear_history": false,
  "allow_fork_syncing": false
}
EOF
)

# Apply branch protection
if gh api \
    --method PUT \
    "repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection" \
    --input - <<< "$PROTECTION_JSON"; then
    echo "${GREEN}✓ Branch protection rules configured successfully${NC}"
else
    echo "${RED}✗ Failed to configure branch protection${NC}"
    echo "${YELLOW}This may require repository admin permissions${NC}"
    echo "${YELLOW}You can configure it manually:${NC}"
    echo "${CYAN}https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/branches${NC}"
    exit 1
fi

echo "\n${GREEN}✅ Branch Protection Setup Complete!${NC}\n"
echo "${BLUE}Protection rules:${NC}"
echo "  - ✅ Status checks required: ${CONTEXTS[*]}"
echo "  - ✅ Enforced for admins"
echo "  - ✅ Force pushes blocked"
echo "  - ✅ Deletions blocked"
echo "\n${CYAN}Code can now only reach production if all checks pass!${NC}"

