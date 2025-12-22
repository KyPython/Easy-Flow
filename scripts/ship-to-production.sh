#!/bin/bash
# EasyFlow Ship to Production Script
# Safely merges dev branch into main and deploys to production
# Runs all strict checks before merging

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== 🚀 Shipping Dev to Production ===${NC}\n"

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "${BLUE}Current branch: ${CYAN}$CURRENT_BRANCH${NC}"

# Ensure we're on dev branch
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "${YELLOW}⚠️  You're not on the dev branch. Switching to dev...${NC}"
    git checkout dev
    CURRENT_BRANCH="dev"
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "${RED}✗ You have uncommitted changes. Please commit or stash them first.${NC}"
    git status --short
    exit 1
fi

# Step 1: Run full test suite on dev branch
echo "\n${BLUE}Step 1: Running full test suite on dev branch...${NC}"
if npm run test:all; then
    echo "${GREEN}✓ All tests passed on dev branch${NC}"
else
    echo "${RED}✗ Tests failed on dev branch. Fix issues before shipping to production.${NC}"
    exit 1
fi

# Step 2: Run security scan
echo "\n${BLUE}Step 2: Running security scan...${NC}"
if npm run security:scan; then
    echo "${GREEN}✓ Security scan passed${NC}"
else
    echo "${RED}✗ Security scan failed. Fix vulnerabilities before shipping to production.${NC}"
    exit 1
fi

# Step 3: Ensure dev is pushed to remote
echo "\n${BLUE}Step 3: Ensuring dev branch is pushed to remote...${NC}"
git push origin dev || {
    echo "${YELLOW}⚠️  Failed to push dev branch. Continuing anyway...${NC}"
}

# Step 4: Switch to main branch
echo "\n${BLUE}Step 4: Switching to main branch...${NC}"
git checkout main
git pull origin main || {
    echo "${YELLOW}⚠️  Failed to pull latest main. Continuing anyway...${NC}"
}

# Step 5: Merge dev into main
echo "\n${BLUE}Step 5: Merging dev into main...${NC}"
if git merge dev --no-ff -m "chore: merge dev into main for production deployment"; then
    echo "${GREEN}✓ Successfully merged dev into main${NC}"
else
    echo "${RED}✗ Merge failed. Please resolve conflicts manually.${NC}"
    echo "${YELLOW}  After resolving, run: git merge --continue${NC}"
    exit 1
fi

# Step 6: Final checks on main (before pushing)
echo "\n${BLUE}Step 6: Running final checks on main branch...${NC}"
if npm run test:all; then
    echo "${GREEN}✓ Final tests passed on main branch${NC}"
else
    echo "${RED}✗ Final tests failed on main branch. Aborting push.${NC}"
    echo "${YELLOW}  You can fix issues and run 'git push origin main' manually when ready.${NC}"
    exit 1
fi

# Step 7: Push to main (triggers production deployment)
echo "\n${BLUE}Step 7: Pushing to main (triggers production deployment)...${NC}"
if git push origin main; then
    echo "\n${GREEN}✅ Successfully shipped to production!${NC}"
    echo "${CYAN}Your deployment providers will automatically deploy the latest code.${NC}"
    echo "\n${BLUE}Next steps:${NC}"
    echo "  - Switch back to dev: ${GREEN}git checkout dev${NC}"
    echo "  - Continue working on dev branch"
else
    echo "${RED}✗ Failed to push to main. Please push manually when ready.${NC}"
    exit 1
fi

echo "\n${GREEN}🎉 Production deployment initiated!${NC}"

