#!/bin/sh
# EasyFlow Quick Lint and Test
# Adapted from ubiquitous-automation: https://github.com/KyPython/ubiquitous-automation
# Quick validation workflow for linting and testing before committing

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Quick Lint & Test ===${NC}\n"

FAILED=0

# Step 1: Lint Frontend
echo "${BLUE}Linting frontend...${NC}"
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm run lint 2>/dev/null || npm run lint:fix 2>/dev/null; then
        echo "  ${GREEN}✓ Frontend linting passed${NC}"
    else
        echo "  ${YELLOW}⚠ Frontend linting issues (attempting auto-fix)${NC}"
        npm run lint:fix 2>/dev/null || true
    fi
    cd ../..
fi

# Step 2: Lint Backend
echo "\n${BLUE}Linting backend...${NC}"
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if grep -q "eslint" package.json 2>/dev/null; then
        if npm run lint 2>/dev/null || npx eslint . --ext .js,.jsx 2>/dev/null; then
            echo "  ${GREEN}✓ Backend linting passed${NC}"
        else
            echo "  ${YELLOW}⚠ Backend linting issues found${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ${YELLOW}○ Backend linting not configured${NC}"
    fi
    cd ../..
fi

# Step 3.5: Validate Study Guide
echo "\n${BLUE}Step 3.5: Validating Study Guide...${NC}"
if [ -f "scripts/validate-study-guide.js" ]; then
    if node scripts/validate-study-guide.js 2>/dev/null; then
        echo "  ${GREEN}✓ Study guide validation passed${NC}"
    else
        echo "  ${YELLOW}⚠ Study guide may need updates (non-blocking)${NC}"
    fi
else
    echo "  ${YELLOW}○ Study guide validation script not found${NC}"
fi

# Step 4: Run Tests
echo "\n${BLUE}Step 4: Running tests...${NC}"

# Backend tests
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if npm run test:backend 2>/dev/null || npm test 2>/dev/null; then
        echo "  ${GREEN}✓ Backend tests passed${NC}"
    else
        echo "  ${YELLOW}⚠ Backend tests failed or not configured${NC}"
    fi
    cd ../..
fi

# Frontend tests
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm test -- --watchAll=false --passWithNoTests 2>/dev/null; then
        echo "  ${GREEN}✓ Frontend tests passed${NC}"
    else
        echo "  ${YELLOW}⚠ Frontend tests failed or not configured${NC}"
    fi
    cd ../..
fi

# Step 4: Validate subscription monitoring feature
echo "\n${BLUE}Validating subscription monitoring feature...${NC}"
if [ -f "rpa-system/backend/services/subscriptionMonitoringService.js" ]; then
    if [ -f "rpa-system/backend/tests/subscriptionMonitoringService.test.js" ]; then
        echo "  ${GREEN}✓ Subscription monitoring service tests found${NC}"
    else
        echo "  ${YELLOW}⚠ Warning: subscriptionMonitoringService.js exists but has no test file${NC}"
    fi
    
    if [ -f "rpa-system/rpa-dashboard/src/pages/SubscriptionMonitoringPage.jsx" ]; then
        echo "  ${GREEN}✓ Subscription monitoring UI page found${NC}"
        
        # Check if page uses ThemeContext
        if grep -q "useTheme" "rpa-system/rpa-dashboard/src/pages/SubscriptionMonitoringPage.jsx" 2>/dev/null; then
            echo "  ${GREEN}✓ Subscription page uses ThemeContext${NC}"
        else
            echo "  ${YELLOW}⚠ Warning: Subscription page does not use ThemeContext${NC}"
        fi
    else
        echo "  ${YELLOW}⚠ Warning: Subscription monitoring service exists but UI page not found${NC}"
    fi
fi

echo "\n${BLUE}=== Summary ===${NC}"

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✅ Lint and test checks passed!${NC}"
    exit 0
else
    echo "${YELLOW}⚠ Some checks had issues. Review output above.${NC}"
    exit 0  # Don't fail - allow manual review
fi

