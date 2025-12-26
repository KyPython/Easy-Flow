#!/bin/sh
# EasyFlow Pre-Commit Validation Script
# Adapted from ubiquitous-automation: https://github.com/KyPython/ubiquitous-automation
# Runs linting, tests, and build checks before committing

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Pre-Commit Validation ===${NC}\n"

# Track if any checks fail
FAILED=0

# Step 1: Lint Frontend (React Dashboard)
echo "${BLUE}Step 1: Linting frontend...${NC}"
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm run lint 2>/dev/null || npm run lint:fix 2>/dev/null; then
        echo "  ${GREEN}✓ Frontend linting passed${NC}"
    else
        echo "  ${YELLOW}⚠ Frontend linting issues (attempting auto-fix)${NC}"
        npm run lint:fix 2>/dev/null || true
    fi
    cd ../..
else
    echo "  ${YELLOW}○ Frontend not found, skipping${NC}"
fi

# Step 2: Lint Backend (if ESLint config exists)
echo "\n${BLUE}Step 2: Linting backend...${NC}"
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    # Check if eslint is available
    if grep -q "eslint" package.json 2>/dev/null || command -v eslint >/dev/null 2>&1; then
        if npm run lint 2>/dev/null || npx eslint . --ext .js,.jsx 2>/dev/null; then
            echo "  ${GREEN}✓ Backend linting passed${NC}"
        else
            echo "  ${YELLOW}⚠ Backend linting issues found${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ${YELLOW}○ ESLint not configured for backend, skipping${NC}"
    fi
    cd ../..
else
    echo "  ${YELLOW}○ Backend not found, skipping${NC}"
fi

# Step 3: Run Tests (if available)
echo "\n${BLUE}Step 3: Running tests...${NC}"

# Backend tests
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if npm run test:backend -- --passWithNoTests || npm test -- --passWithNoTests; then
        echo "  ${GREEN}✓ Backend tests passed${NC}"
    else
        echo "  ${YELLOW}⚠ Backend tests failed (non-blocking in pre-commit)${NC}"
        echo "  ${YELLOW}  Tests will block in pre-push and CI/CD${NC}"
        # Don't fail pre-commit for test issues (they'll block in pre-push)
    fi
    cd ../..
fi

# Frontend tests
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm test -- --watchAll=false --passWithNoTests; then
        echo "  ${GREEN}✓ Frontend tests passed${NC}"
    else
        echo "  ${YELLOW}⚠ Frontend tests failed (non-blocking in pre-commit)${NC}"
        echo "  ${YELLOW}  Tests will block in pre-push and CI/CD${NC}"
        # Don't fail pre-commit for test issues (they'll block in pre-push)
    fi
    cd ../..
fi

# Step 4: Build Check (verify compilation)
echo "\n${BLUE}Step 4: Verifying builds...${NC}"

# Frontend build
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm run build >/dev/null 2>&1; then
        echo "  ${GREEN}✓ Frontend builds successfully${NC}"
    else
        echo "  ${RED}✗ Frontend build failed${NC}"
        FAILED=$((FAILED + 1))
    fi
    cd ../..
fi

# Backend build (if it has a build step)
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if grep -q '"build"' package.json; then
        if npm run build >/dev/null 2>&1; then
            echo "  ${GREEN}✓ Backend builds successfully${NC}"
        else
            echo "  ${RED}✗ Backend build failed${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ${GREEN}✓ Backend (no build step - runs directly)${NC}"
    fi
    cd ../..
fi

# Step 5: Environment Check
echo "\n${BLUE}Step 5: Checking development environment...${NC}"
if ./scripts/dev-env-check.sh >/dev/null 2>&1; then
    echo "  ${GREEN}✓ Environment check passed${NC}"
else
    echo "  ${YELLOW}⚠ Environment check warnings (non-blocking)${NC}"
fi

# Step 6: Code Quality Check (non-blocking)
echo "\n${BLUE}Step 6: Checking code quality...${NC}"
if ./scripts/code-quality-check.sh >/dev/null 2>&1; then
    echo "  ${GREEN}✓ Code quality check passed${NC}"
else
    echo "  ${YELLOW}⚠ Code quality issues found (non-blocking)${NC}"
    echo "  Run 'npm run quality:check' for details"
fi

# Step 7: Terraform Validation (if infrastructure files changed)
echo "\n${BLUE}Step 7: Checking Terraform configuration...${NC}"
if git diff --cached --name-only | grep -q "infrastructure/.*\.tf$" || git diff --cached --name-only | grep -q "\.tf$"; then
    if [ -d "infrastructure" ] && [ -f "infrastructure/main.tf" ]; then
        cd infrastructure
        if ../scripts/terraform-fmt.sh --check >/dev/null 2>&1; then
            echo "  ${GREEN}✓ Terraform formatting is correct${NC}"
        else
            echo "  ${YELLOW}⚠ Terraform files need formatting${NC}"
            echo "  Run 'npm run infra:fmt' to fix"
            FAILED=$((FAILED + 1))
        fi
        if ../scripts/terraform-validate.sh >/dev/null 2>&1; then
            echo "  ${GREEN}✓ Terraform validation passed${NC}"
        else
            echo "  ${RED}✗ Terraform validation failed${NC}"
            FAILED=$((FAILED + 1))
        fi
        cd ..
    else
        echo "  ${YELLOW}○ No infrastructure directory found, skipping${NC}"
    fi
else
    echo "  ${GREEN}○ No Terraform files changed, skipping${NC}"
fi

echo "\n${BLUE}=== Summary ===${NC}"

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✅ All pre-commit checks passed!${NC}"
    exit 0
else
    echo "${RED}❌ Some pre-commit checks failed. Please fix issues before committing.${NC}"
    exit 1
fi

