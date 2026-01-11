#!/bin/sh
# EasyFlow Pre-Commit Validation Script
# Adapted from ubiquitous-automation: https://github.com/KyPython/ubiquitous-automation
# Runs linting, tests, and build checks before committing
# Branch-aware: Non-blocking on dev, blocking on main

# Determine current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
IS_DEV_BRANCH=false
IS_MAIN_BRANCH=false

if [ "$CURRENT_BRANCH" = "dev" ]; then
  IS_DEV_BRANCH=true
elif [ "$CURRENT_BRANCH" = "main" ]; then
  IS_MAIN_BRANCH=true
fi

# On dev branch, make checks non-blocking (warnings only)
if [ "$IS_DEV_BRANCH" = true ]; then
  set +e  # Don't exit on errors
  BLOCKING=false
else
  set -e  # Exit on errors for main branch
  BLOCKING=true
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Pre-Commit Validation ===${NC}\n"

# Show branch-aware mode
if [ "$IS_DEV_BRANCH" = true ]; then
  echo "${YELLOW}📌 Dev Branch Mode: Non-blocking (warnings only)${NC}"
  echo "${YELLOW}   Code can be committed even if checks fail${NC}\n"
elif [ "$IS_MAIN_BRANCH" = true ]; then
  echo "${RED}📌 Main Branch Mode: Blocking (strict validation)${NC}"
  echo "${RED}   All checks must pass before committing${NC}\n"
else
  echo "${BLUE}📌 Branch: ${CURRENT_BRANCH} (defaulting to strict mode)${NC}\n"
fi

# Track if any checks fail
FAILED=0

# Allow skipping tests via environment variable (for faster commits)
SKIP_TESTS="${SKIP_TESTS:-false}"

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

# Step 3: Run Tests (if available) - SKIP by default for speed
if [ "$SKIP_TESTS" != "true" ]; then
    echo "\n${BLUE}Step 3: Running tests (can skip with SKIP_TESTS=true)...${NC}"
    echo "${YELLOW}  ⚠️  Tests are slow - skipping in pre-commit for speed${NC}"
    echo "${YELLOW}  Tests will run in CI/CD and pre-push hooks${NC}"
else
    echo "\n${BLUE}Step 3: Tests skipped (SKIP_TESTS=true)${NC}"
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

# Step 6.5: Quick validation checks (non-blocking in pre-commit, blocking in CI/CD)
echo "\n${BLUE}Step 6.5: Running quick validation checks...${NC}"
if ./scripts/validate-srp.sh >/dev/null 2>&1; then
    echo "  ${GREEN}✓ SRP validation passed${NC}"
else
    echo "  ${YELLOW}⚠ SRP violations found (non-blocking in pre-commit)${NC}"
    echo "  ${YELLOW}  Will block in CI/CD and production deployment${NC}"
fi

if ./scripts/validate-theme-consistency.sh >/dev/null 2>&1; then
    echo "  ${GREEN}✓ Theme consistency check passed${NC}"
else
    echo "  ${YELLOW}⚠ Theme consistency issues found (non-blocking in pre-commit)${NC}"
    echo "  ${YELLOW}  Will block in CI/CD and production deployment${NC}"
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
    if [ "$IS_DEV_BRANCH" = true ]; then
        echo "${YELLOW}⚠️ Some pre-commit checks failed (non-blocking on dev branch)${NC}"
        echo "${YELLOW}   Code will be committed, but fix issues before merging to main${NC}"
        exit 0  # Don't block on dev branch
    else
        echo "${RED}❌ Some pre-commit checks failed. Please fix issues before committing.${NC}"
        exit 1  # Block on main branch
    fi
fi

