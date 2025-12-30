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

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "${RED}✗ Not in a git repository${NC}"
    exit 1
fi

# Check current branch (sanitize output)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null | sed 's/[^a-zA-Z0-9._-]//g')
if [ -z "$CURRENT_BRANCH" ]; then
    echo "${RED}✗ Could not determine current branch${NC}"
    exit 1
fi

echo "${BLUE}Current branch: ${CYAN}$CURRENT_BRANCH${NC}"

# Ensure we're on dev branch
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "${YELLOW}⚠️  You're not on the dev branch. Switching to dev...${NC}"
    git checkout dev || {
        echo "${RED}✗ Failed to checkout dev branch${NC}"
        exit 1
    }
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
    echo "${YELLOW}  Run 'npm run test:all' to see detailed test results${NC}"
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

# Step 2.25: Run comprehensive code validation (SRP, Dynamic, Theme, Logging, RAG)
echo "\n${BLUE}Step 2.25: Running comprehensive code validation...${NC}"
if ./scripts/validate-all.sh; then
    echo "${GREEN}✓ All code validation checks passed${NC}"
else
    echo "${RED}✗ Code validation failed. Fix issues before shipping to production.${NC}"
    echo "${YELLOW}  Run './scripts/validate-all.sh' for details${NC}"
    exit 1
fi

# Step 2.3: Validate RAG Knowledge Base
echo "\n${BLUE}Step 2.3: Validating RAG Knowledge Base...${NC}"
if ./scripts/validate-rag-knowledge.sh; then
    echo "${GREEN}✓ RAG knowledge validation passed${NC}"
else
    echo "${RED}✗ RAG knowledge validation failed. Fix issues before shipping to production.${NC}"
    echo "${YELLOW}  Update ragClient.js seedEasyFlowKnowledge() and aiWorkflowAgent.js system prompts${NC}"
    exit 1
fi

# Step 2.5: Validate Terraform (if infrastructure exists)
echo "\n${BLUE}Step 2.5: Validating Terraform configuration...${NC}"
if [ -d "infrastructure" ] && [ -f "infrastructure/main.tf" ]; then
    cd infrastructure
    if ../scripts/terraform-validate.sh; then
        echo "${GREEN}✓ Terraform validation passed${NC}"
        
        # Run Terraform plan to show what will change
        echo "${BLUE}Running Terraform plan (preview)...${NC}"
        ../scripts/terraform-plan.sh dev || echo "${YELLOW}⚠ Terraform plan completed with changes (review above)${NC}"
    else
        echo "${RED}✗ Terraform validation failed. Fix issues before shipping to production.${NC}"
        cd ..
        exit 1
    fi
    cd ..
else
    echo "${GREEN}○ No infrastructure directory found, skipping Terraform validation${NC}"
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
    echo "\n${YELLOW}⚠️  IMPORTANT: Verify Vercel is configured correctly${NC}"
    echo "  - Production MUST deploy from ${GREEN}main${NC} branch only"
    echo "  - Run: ${CYAN}npm run vercel:check${NC} to verify settings"
    echo "  - Or check: https://vercel.com/dashboard → Settings → Git → Production Branch"
    echo "\n${BLUE}Next steps:${NC}"
    echo "  - Switch back to dev: ${GREEN}git checkout dev${NC}"
    echo "  - Continue working on dev branch"
else
    echo "${RED}✗ Failed to push to main. Please push manually when ready.${NC}"
    exit 1
fi

echo "\n${GREEN}🎉 Production deployment initiated!${NC}"

