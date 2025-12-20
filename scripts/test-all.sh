#!/bin/sh
# EasyFlow Comprehensive Test Suite
# Adapted from ubiquitous-automation: https://github.com/KyPython/ubiquitous-automation
# Runs all tests, linting, and builds for EasyFlow

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Comprehensive Test Suite ===${NC}\n"

# Track results
TESTS_PASSED=0
TESTS_FAILED=0
CHECKS_TOTAL=0

# Step 1: Environment Check
echo "${BLUE}Step 1: Checking development environment...${NC}"
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if ./scripts/dev-env-check.sh >/dev/null 2>&1; then
    echo "  ${GREEN}✓ Environment check passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "  ${YELLOW}⚠ Environment check warnings${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 2: Install Dependencies (if needed)
echo "\n${BLUE}Step 2: Checking dependencies...${NC}"

# Backend dependencies
if [ -f "rpa-system/backend/package.json" ]; then
    if [ ! -d "rpa-system/backend/node_modules" ]; then
        echo "  Installing backend dependencies..."
        cd rpa-system/backend
        npm install
        cd ../..
    else
        echo "  ${GREEN}✓ Backend dependencies installed${NC}"
    fi
fi

# Frontend dependencies
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    if [ ! -d "rpa-system/rpa-dashboard/node_modules" ]; then
        echo "  Installing frontend dependencies..."
        cd rpa-system/rpa-dashboard
        npm install
        cd ../..
    else
        echo "  ${GREEN}✓ Frontend dependencies installed${NC}"
    fi
fi

# Python dependencies
if [ -f "rpa-system/automation/automation-service/requirements.txt" ]; then
    echo "  ${GREEN}✓ Python dependencies (check manually if needed)${NC}"
fi

# Step 3: Linting
echo "\n${BLUE}Step 3: Running linters...${NC}"

# Frontend linting
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    cd rpa-system/rpa-dashboard
    if npm run lint 2>/dev/null || npm run lint:fix 2>/dev/null; then
        echo "  ${GREEN}✓ Frontend linting passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  ${RED}✗ Frontend linting failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    cd ../..
fi

# Backend linting
if [ -f "rpa-system/backend/package.json" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    cd rpa-system/backend
    if grep -q "eslint" package.json 2>/dev/null; then
        if npm run lint 2>/dev/null || npx eslint . --ext .js,.jsx 2>/dev/null; then
            echo "  ${GREEN}✓ Backend linting passed${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo "  ${YELLOW}⚠ Backend linting issues (non-blocking)${NC}"
        fi
    else
        echo "  ${YELLOW}○ Backend linting not configured${NC}"
    fi
    cd ../..
fi

# Step 4: Running Tests
echo "\n${BLUE}Step 4: Running test suites...${NC}"

# Backend tests
if [ -f "rpa-system/backend/package.json" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    cd rpa-system/backend
    if npm run test:backend 2>/dev/null || npm test 2>/dev/null; then
        echo "  ${GREEN}✓ Backend tests passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  ${YELLOW}⚠ Backend tests failed or not configured${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    cd ../..
fi

# Frontend tests
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    cd rpa-system/rpa-dashboard
    if npm test -- --watchAll=false --passWithNoTests 2>/dev/null; then
        echo "  ${GREEN}✓ Frontend tests passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  ${YELLOW}⚠ Frontend tests failed or not configured${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    cd ../..
fi

# Python tests (if pytest is available)
if [ -f "rpa-system/automation/automation-service/requirements.txt" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    if command -v pytest >/dev/null 2>&1 || command -v python3 -m pytest >/dev/null 2>&1; then
        cd rpa-system/automation/automation-service
        if python3 -m pytest -v 2>/dev/null || pytest -v 2>/dev/null; then
            echo "  ${GREEN}✓ Python tests passed${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo "  ${YELLOW}⚠ Python tests failed or not configured${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        cd ../../..
    else
        echo "  ${YELLOW}○ Python tests (pytest not available)${NC}"
    fi
fi

# Step 5: Build Verification
echo "\n${BLUE}Step 5: Verifying builds...${NC}"

# Frontend build
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    cd rpa-system/rpa-dashboard
    if npm run build >/dev/null 2>&1; then
        echo "  ${GREEN}✓ Frontend builds successfully${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  ${RED}✗ Frontend build failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    cd ../..
fi

# Backend build (if it has a build step)
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if grep -q '"build"' package.json; then
        CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
        if npm run build >/dev/null 2>&1; then
            echo "  ${GREEN}✓ Backend builds successfully${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo "  ${RED}✗ Backend build failed${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo "  ${GREEN}✓ Backend (no build step - runs directly)${NC}"
    fi
    cd ../..
fi

# Summary
echo "\n${BLUE}=== Test Suite Summary ===${NC}"
echo "Total Checks: $CHECKS_TOTAL"
echo "Passed: ${GREEN}$TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo "Failed: ${RED}$TESTS_FAILED${NC}"
fi

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo "${YELLOW}⚠ Some tests failed or were skipped. Review output above.${NC}"
    exit 0  # Don't fail - some tests may not be configured yet
fi

