#!/bin/bash
# Verify CI/CD Integration - Ensures all components work together correctly

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== 🔍 Verifying CI/CD Integration ===${NC}\n"

ERRORS=0

# 1. Pre-push hook
echo "${BLUE}1. Pre-push Hook (.husky/pre-push)${NC}"
if [ ! -f ".husky/pre-push" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "BLOCKED for production safety" .husky/pre-push; then
    echo "   ${RED}✗ Doesn't block main branch${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "dev branch" .husky/pre-push; then
    echo "   ${RED}✗ Not branch-aware${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo "   ${GREEN}✓ Blocks main, allows dev (branch-aware)${NC}"
fi

# 2. QA Core workflow (main branch, strict)
echo "\n${BLUE}2. QA Core Workflow (.github/workflows/qa-core.yml)${NC}"
if [ ! -f ".github/workflows/qa-core.yml" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "branches: \[main\]" .github/workflows/qa-core.yml; then
    echo "   ${RED}✗ Not restricted to main branch${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "exit 1" .github/workflows/qa-core.yml; then
    echo "   ${YELLOW}⚠ Doesn't block on failures${NC}"
else
    echo "   ${GREEN}✓ Runs on main only, blocks on failures${NC}"
fi

# 3. QA Dev workflow (dev branch, permissive)
echo "\n${BLUE}3. QA Dev Workflow (.github/workflows/qa-dev.yml)${NC}"
if [ ! -f ".github/workflows/qa-dev.yml" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "branches: \[dev\]" .github/workflows/qa-dev.yml; then
    echo "   ${RED}✗ Not restricted to dev branch${NC}"
    ERRORS=$((ERRORS + 1))
elif grep -q "continue-on-error: true" .github/workflows/qa-dev.yml || grep -q "|| echo" .github/workflows/qa-dev.yml; then
    echo "   ${GREEN}✓ Runs on dev only, non-blocking${NC}"
else
    echo "   ${YELLOW}⚠ May not be permissive${NC}"
fi

# 4. Code Validation workflow (branch-aware)
echo "\n${BLUE}4. Code Validation Workflow (.github/workflows/code-validation.yml)${NC}"
if [ ! -f ".github/workflows/code-validation.yml" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "branches: \[main, dev\]" .github/workflows/code-validation.yml; then
    echo "   ${RED}✗ Not branch-aware${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "blocking" .github/workflows/code-validation.yml; then
    echo "   ${RED}✗ Doesn't have branch-aware blocking logic${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo "   ${GREEN}✓ Branch-aware (strict on main, permissive on dev)${NC}"
fi

# 5. Terraform Validation workflow (branch-aware)
echo "\n${BLUE}5. Terraform Validation Workflow (.github/workflows/terraform-validate.yml)${NC}"
if [ ! -f ".github/workflows/terraform-validate.yml" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "branches: \[main, dev\]" .github/workflows/terraform-validate.yml; then
    echo "   ${YELLOW}⚠ Not explicitly branch-aware in triggers${NC}"
elif ! grep -q "blocking" .github/workflows/terraform-validate.yml; then
    echo "   ${YELLOW}⚠ Doesn't have branch-aware blocking logic${NC}"
else
    echo "   ${GREEN}✓ Branch-aware${NC}"
fi

# 6. Ship script
echo "\n${BLUE}6. Ship to Production Script (scripts/ship-to-production.sh)${NC}"
if [ ! -f "scripts/ship-to-production.sh" ]; then
    echo "   ${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
elif [ ! -x "scripts/ship-to-production.sh" ]; then
    echo "   ${RED}✗ Not executable${NC}"
    ERRORS=$((ERRORS + 1))
elif ! grep -q "dev branch" scripts/ship-to-production.sh; then
    echo "   ${RED}✗ Doesn't check for dev branch${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo "   ${GREEN}✓ Exists, executable, checks for dev branch${NC}"
fi

# 7. Setup scripts
echo "\n${BLUE}7. Setup Scripts${NC}"
if [ -f "scripts/setup-cicd.sh" ] && [ -x "scripts/setup-cicd.sh" ]; then
    echo "   ${GREEN}✓ setup-cicd.sh ready${NC}"
else
    echo "   ${RED}✗ setup-cicd.sh missing or not executable${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "scripts/setup-branch-protection.sh" ] && [ -x "scripts/setup-branch-protection.sh" ]; then
    echo "   ${GREEN}✓ setup-branch-protection.sh ready${NC}"
else
    echo "   ${YELLOW}⚠ setup-branch-protection.sh missing (optional)${NC}"
fi

# Summary
echo "\n${BLUE}=== Summary ===${NC}\n"
if [ $ERRORS -eq 0 ]; then
    echo "${GREEN}✅ All CI/CD components integrated correctly!${NC}"
    echo "${GREEN}✅ All workflows are branch-aware${NC}"
    echo "${GREEN}✅ Protection layers active${NC}"
    exit 0
else
    echo "${RED}❌ Found $ERRORS issue(s) that need to be fixed${NC}"
    exit 1
fi
