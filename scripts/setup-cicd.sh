#!/bin/bash
# EasyFlow Complete CI/CD Setup
# Automatically configures all CI/CD protections to prevent non-production code from reaching production

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== 🚀 EasyFlow CI/CD Setup ===${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".github/workflows" ]; then
    echo "${RED}✗ Must be run from project root${NC}"
    exit 1
fi

echo "${BLUE}This script will:${NC}"
echo "  1. ✅ Set up branch protection (blocks direct pushes to main)"
echo "  2. ✅ Configure pre-push hooks (enforces ship-to-production workflow)"
echo "  3. ✅ Verify all workflows are properly configured"
echo ""

# Step 1: Setup branch protection
if [ -f "scripts/setup-branch-protection.sh" ]; then
    echo "${BLUE}Step 1: Setting up branch protection...${NC}"
    chmod +x scripts/setup-branch-protection.sh
    if ./scripts/setup-branch-protection.sh; then
        echo "${GREEN}✓ Branch protection configured${NC}\n"
    else
        echo "${YELLOW}⚠️  Branch protection setup failed (may need manual setup)${NC}\n"
    fi
else
    echo "${YELLOW}⚠️  setup-branch-protection.sh not found, skipping...${NC}\n"
fi

# Step 2: Verify pre-push hook
echo "${BLUE}Step 2: Verifying pre-push hook...${NC}"
if [ -f ".husky/pre-push" ]; then
    if grep -q "Direct pushes to 'main' branch are BLOCKED" .husky/pre-push; then
        echo "${GREEN}✓ Pre-push hook properly configured${NC}\n"
    else
        echo "${YELLOW}⚠️  Pre-push hook needs update${NC}\n"
    fi
else
    echo "${RED}✗ Pre-push hook not found${NC}\n"
fi

# Step 3: Verify ship-to-production script
echo "${BLUE}Step 3: Verifying ship-to-production script...${NC}"
if [ -f "scripts/ship-to-production.sh" ]; then
    chmod +x scripts/ship-to-production.sh
    echo "${GREEN}✓ ship-to-production.sh is ready${NC}\n"
else
    echo "${RED}✗ ship-to-production.sh not found${NC}\n"
fi

# Step 4: Verify workflows fail properly
echo "${BLUE}Step 4: Verifying workflows are blocking...${NC}"
WORKFLOWS_TO_CHECK=(
    ".github/workflows/qa-core.yml"
    ".github/workflows/qa-integration.yml"
    ".github/workflows/code-validation.yml"
    ".github/workflows/terraform-validate.yml"
)

ALL_GOOD=true
for workflow in "${WORKFLOWS_TO_CHECK[@]}"; do
    if [ -f "$workflow" ]; then
        # Check if workflow has exit 1 on failures (not just warnings)
        if grep -q "exit 1" "$workflow"; then
            echo "  ${GREEN}✓${NC} $(basename "$workflow") blocks on failures"
        else
            echo "  ${YELLOW}⚠${NC} $(basename "$workflow") may not block properly"
            ALL_GOOD=false
        fi
    else
        echo "  ${RED}✗${NC} $(basename "$workflow") not found"
        ALL_GOOD=false
    fi
done

echo ""

if [ "$ALL_GOOD" = true ]; then
    echo "${GREEN}✅ All workflows properly configured${NC}\n"
else
    echo "${YELLOW}⚠️  Some workflows may need updates${NC}\n"
fi

# Summary
echo "${BLUE}=== Setup Summary ===${NC}\n"
echo "${GREEN}✅ CI/CD Protection Active:${NC}"
echo "  - Direct pushes to 'main' are BLOCKED (use 'npm run ship')"
echo "  - All workflows must pass before code reaches production"
echo "  - Branch protection enforced (if GitHub API setup succeeded)"
echo ""
echo "${CYAN}To deploy to production:${NC}"
echo "  1. Work on 'dev' branch"
echo "  2. Run: ${GREEN}npm run ship${NC}"
echo "  3. Script will validate, merge, and deploy"
echo ""
echo "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  If branch protection setup failed, configure manually:"
echo "  ${CYAN}https://github.com/YOUR_REPO/settings/branches${NC}"
echo "  Required checks: qa, integration, validate, terraform"
echo ""

