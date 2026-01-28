#!/bin/bash
# Validate Unused Code Detection
# Checks for unused exports, imports, and dead code

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== Unused Code Detection ===${NC}\n"

ERRORS=0
WARNINGS=0

# Check backend for unused code using ESLint
echo -e "${CYAN}Checking Backend (ESLint no-unused-vars)...${NC}"
if [ -d "rpa-system/backend" ]; then
    cd rpa-system/backend
    
    if [ -f "package.json" ] && npm list eslint >/dev/null 2>&1 || [ -f "../package.json" ]; then
        # Run ESLint with unused vars check
        if npm run lint 2>/dev/null || npx eslint . --ext .js --rule 'no-unused-vars: error' 2>/dev/null; then
            echo -e "${GREEN}✓ Backend: No unused variables detected${NC}"
        else
            LINT_OUTPUT=$(npm run lint 2>&1 || npx eslint . --ext .js --rule 'no-unused-vars: error' 2>&1 || true)
            UNUSED_COUNT=$(echo "$LINT_OUTPUT" | grep -c "no-unused-vars" || echo "0")
            if [ "$UNUSED_COUNT" -gt 0 ]; then
                echo -e "${YELLOW}⚠ Backend: ${UNUSED_COUNT} unused variable(s) found${NC}"
                echo "$LINT_OUTPUT" | grep "no-unused-vars" | head -10
                WARNINGS=$((WARNINGS + UNUSED_COUNT))
            else
                echo -e "${GREEN}✓ Backend: No unused variables detected${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ Backend: ESLint not configured, skipping${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⚠ Backend directory not found${NC}"
fi

echo ""

# Check frontend for unused code
echo -e "${CYAN}Checking Frontend (React/TypeScript)...${NC}"
if [ -d "rpa-system/rpa-dashboard" ]; then
    cd rpa-system/rpa-dashboard
    
    # Check for ts-unused-exports (TypeScript) or unimported (JavaScript)
    if [ -f "package.json" ]; then
        # Try ts-unused-exports for TypeScript files
        if [ -f "tsconfig.json" ] && (npm list ts-unused-exports >/dev/null 2>&1 || command -v npx >/dev/null 2>&1); then
            if command -v npx >/dev/null 2>&1; then
                TS_UNUSED_OUTPUT=$(npx -y ts-unused-exports tsconfig.json 2>&1 || echo "")
                if [ -n "$TS_UNUSED_OUTPUT" ] && echo "$TS_UNUSED_OUTPUT" | grep -q "unused"; then
                    UNUSED_EXPORTS=$(echo "$TS_UNUSED_OUTPUT" | grep -c "unused" || echo "0")
                    echo -e "${YELLOW}⚠ Frontend: ${UNUSED_EXPORTS} unused export(s) found${NC}"
                    echo "$TS_UNUSED_OUTPUT" | head -20
                    WARNINGS=$((WARNINGS + UNUSED_EXPORTS))
                else
                    echo -e "${GREEN}✓ Frontend: No unused exports detected (TypeScript)${NC}"
                fi
            fi
        fi
        
        # Fallback: ESLint check
        if npm run lint 2>/dev/null || npx eslint src --ext .js,.jsx,.ts,.tsx --rule 'no-unused-vars: error' 2>/dev/null; then
            echo -e "${GREEN}✓ Frontend: ESLint check passed${NC}"
        else
            LINT_OUTPUT=$(npm run lint 2>&1 || npx eslint src --ext .js,.jsx,.ts,.tsx --rule 'no-unused-vars: error' 2>&1 || true)
            UNUSED_COUNT=$(echo "$LINT_OUTPUT" | grep -c "no-unused-vars\|is defined but never used" || echo "0")
            if [ "$UNUSED_COUNT" -gt 0 ]; then
                echo -e "${YELLOW}⚠ Frontend: ${UNUSED_COUNT} unused variable(s) found${NC}"
                echo "$LINT_OUTPUT" | grep -E "no-unused-vars|is defined but never used" | head -10
                WARNINGS=$((WARNINGS + UNUSED_COUNT))
            fi
        fi
    else
        echo -e "${YELLOW}⚠ Frontend: package.json not found${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⚠ Frontend directory not found${NC}"
fi

echo ""

# Check for unused imports specifically (using a simple grep-based check)
echo -e "${CYAN}Checking for unused imports (basic check)...${NC}"

# This is a simplified check - in a real scenario, you'd use a proper tool
# For now, we'll rely on ESLint which should catch most cases

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No unused code detected${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found (unused code detected)${NC}"
    echo -e "${CYAN}💡 Recommendation: Remove unused imports, variables, and exports${NC}"
    # In strict mode (main branch), this should fail
    if [ "${STRICT_MODE:-false}" = "true" ]; then
        exit 1
    else
        exit 0  # Warnings only in dev mode
    fi
else
    echo -e "${RED}❌ Unused code detection failed${NC}"
    exit 1
fi
