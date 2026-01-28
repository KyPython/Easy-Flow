#!/bin/bash
# Validate Test Coverage
# Ensures all code has adequate test coverage
# Checks that coverage thresholds are met and reports untested functions/files

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== Test Coverage Validation ===${NC}\n"

ERRORS=0
WARNINGS=0

# Configuration
COVERAGE_THRESHOLD_LINES="${COVERAGE_THRESHOLD_LINES:-80}"
COVERAGE_THRESHOLD_FUNCTIONS="${COVERAGE_THRESHOLD_FUNCTIONS:-70}"
COVERAGE_THRESHOLD_BRANCHES="${COVERAGE_THRESHOLD_BRANCHES:-70}"
COVERAGE_THRESHOLD_STATEMENTS="${COVERAGE_THRESHOLD_STATEMENTS:-80}"

# Check if we're in strict mode (main branch)
STRICT_MODE="${STRICT_MODE:-false}"
if [ "$STRICT_MODE" = "true" ] || [ "$CI" = "true" ]; then
    STRICT_MODE="true"
fi

echo -e "${CYAN}Configuration:${NC}"
echo "  Lines Threshold: ${COVERAGE_THRESHOLD_LINES}%"
echo "  Functions Threshold: ${COVERAGE_THRESHOLD_FUNCTIONS}%"
echo "  Branches Threshold: ${COVERAGE_THRESHOLD_BRANCHES}%"
echo "  Statements Threshold: ${COVERAGE_THRESHOLD_STATEMENTS}%"
echo "  Strict Mode: ${STRICT_MODE}"
echo ""

# 1. Check backend test coverage
echo -e "${CYAN}1. Checking backend test coverage...${NC}"

if [ -d "rpa-system/backend" ]; then
    cd rpa-system/backend
    
    # Check if jest is available
    if ! command -v jest >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Jest not found and npx not available${NC}"
        echo "  Install: npm install -g jest or use npx"
        WARNINGS=$((WARNINGS + 1))
    else
        # Determine jest command
        JEST_CMD=""
        if command -v jest >/dev/null 2>&1; then
            JEST_CMD="jest"
        else
            JEST_CMD="npx jest"
        fi
        
        # Check if jest.config.js exists
        if [ ! -f "jest.config.js" ]; then
            echo -e "${YELLOW}⚠ jest.config.js not found${NC}"
            WARNINGS=$((WARNINGS + 1))
        else
            # Run coverage analysis
            COVERAGE_DIR="coverage"
            
            # Run jest with coverage (if package.json has test script)
            if grep -q '"test"' package.json 2>/dev/null || [ -f "../package.json" ] && grep -q '"test:backend"' ../package.json 2>/dev/null; then
                echo "  Running test coverage analysis..."
                
                # Try to run coverage (may fail if no tests exist, which is fine)
                if $JEST_CMD --coverage --coverageReporters=json-summary --coverageReporters=text --passWithNoTests 2>/dev/null; then
                    # Check if coverage directory exists
                    if [ -d "$COVERAGE_DIR" ] && [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
                        # Parse coverage summary
                        COVERAGE_DATA=$(cat "$COVERAGE_DIR/coverage-summary.json" 2>/dev/null || echo "{}")
                        
                        # Extract coverage percentages (using node or simple parsing)
                        if command -v node >/dev/null 2>&1; then
                            LINES_PCT=$(node -e "const data = require('./$COVERAGE_DIR/coverage-summary.json'); const total = data.total || {}; console.log(Math.round((total.lines?.pct || 0)))" 2>/dev/null || echo "0")
                            FUNCTIONS_PCT=$(node -e "const data = require('./$COVERAGE_DIR/coverage-summary.json'); const total = data.total || {}; console.log(Math.round((total.functions?.pct || 0)))" 2>/dev/null || echo "0")
                            BRANCHES_PCT=$(node -e "const data = require('./$COVERAGE_DIR/coverage-summary.json'); const total = data.total || {}; console.log(Math.round((total.branches?.pct || 0)))" 2>/dev/null || echo "0")
                            STATEMENTS_PCT=$(node -e "const data = require('./$COVERAGE_DIR/coverage-summary.json'); const total = data.total || {}; console.log(Math.round((total.statements?.pct || 0)))" 2>/dev/null || echo "0")
                            
                            # Check thresholds
                            FAILED_THRESHOLDS=0
                            
                            if [ "$LINES_PCT" -lt "$COVERAGE_THRESHOLD_LINES" ]; then
                                echo -e "  ${RED}✗ Lines coverage: ${LINES_PCT}% (threshold: ${COVERAGE_THRESHOLD_LINES}%)${NC}"
                                FAILED_THRESHOLDS=$((FAILED_THRESHOLDS + 1))
                            else
                                echo -e "  ${GREEN}✓ Lines coverage: ${LINES_PCT}%${NC}"
                            fi
                            
                            if [ "$FUNCTIONS_PCT" -lt "$COVERAGE_THRESHOLD_FUNCTIONS" ]; then
                                echo -e "  ${RED}✗ Functions coverage: ${FUNCTIONS_PCT}% (threshold: ${COVERAGE_THRESHOLD_FUNCTIONS}%)${NC}"
                                FAILED_THRESHOLDS=$((FAILED_THRESHOLDS + 1))
                            else
                                echo -e "  ${GREEN}✓ Functions coverage: ${FUNCTIONS_PCT}%${NC}"
                            fi
                            
                            if [ "$BRANCHES_PCT" -lt "$COVERAGE_THRESHOLD_BRANCHES" ]; then
                                echo -e "  ${RED}✗ Branches coverage: ${BRANCHES_PCT}% (threshold: ${COVERAGE_THRESHOLD_BRANCHES}%)${NC}"
                                FAILED_THRESHOLDS=$((FAILED_THRESHOLDS + 1))
                            else
                                echo -e "  ${GREEN}✓ Branches coverage: ${BRANCHES_PCT}%${NC}"
                            fi
                            
                            if [ "$STATEMENTS_PCT" -lt "$COVERAGE_THRESHOLD_STATEMENTS" ]; then
                                echo -e "  ${RED}✗ Statements coverage: ${STATEMENTS_PCT}% (threshold: ${COVERAGE_THRESHOLD_STATEMENTS}%)${NC}"
                                FAILED_THRESHOLDS=$((FAILED_THRESHOLDS + 1))
                            else
                                echo -e "  ${GREEN}✓ Statements coverage: ${STATEMENTS_PCT}%${NC}"
                            fi
                            
                            if [ "$FAILED_THRESHOLDS" -gt 0 ]; then
                                if [ "$STRICT_MODE" = "true" ]; then
                                    echo -e "\n  ${RED}❌ Coverage thresholds not met (${FAILED_THRESHOLDS} threshold(s) failed)${NC}"
                                    ERRORS=$((ERRORS + 1))
                                else
                                    echo -e "\n  ${YELLOW}⚠ Coverage thresholds not met (${FAILED_THRESHOLDS} threshold(s) failed)${NC}"
                                    WARNINGS=$((WARNINGS + 1))
                                fi
                            fi
                        else
                            echo -e "${YELLOW}⚠ Could not parse coverage data (node not available)${NC}"
                            WARNINGS=$((WARNINGS + 1))
                        fi
                    else
                        echo -e "${YELLOW}⚠ Coverage report not generated${NC}"
                        WARNINGS=$((WARNINGS + 1))
                    fi
                else
                    echo -e "${YELLOW}⚠ Test coverage analysis failed or no tests found${NC}"
                    WARNINGS=$((WARNINGS + 1))
                fi
            else
                echo -e "${YELLOW}⚠ No test script found in package.json${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
        
        cd ../..
    fi
else
    echo -e "${YELLOW}⚠ Backend directory not found${NC}"
fi

echo ""

# 2. Check for untested files (files without corresponding test files)
echo -e "${CYAN}2. Checking for untested source files...${NC}"

if [ -d "rpa-system/backend" ]; then
    UNTESTED_COUNT=0
    UNTESTED_FILES=()
    
    # Find source files (exclude test files, node_modules, etc.)
    find rpa-system/backend -name "*.js" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/tests/*" \
        ! -path "*/.git/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        ! -path "*/coverage/*" \
        ! -name "jest.config.js" \
        ! -name "server.js" | \
    while read source_file; do
        # Check if test file exists
        test_file=$(echo "$source_file" | sed 's/\.js$/.test.js/')
        test_file_alt=$(echo "$source_file" | sed 's/\.js$/.spec.js/')
        
        # Look for test file in tests directory
        relative_path=$(echo "$source_file" | sed 's|^rpa-system/backend/||')
        test_file_in_tests="rpa-system/backend/tests/${relative_path%.js}.test.js"
        
        if [ ! -f "$test_file" ] && [ ! -f "$test_file_alt" ] && [ ! -f "$test_file_in_tests" ]; then
            # Extract directory to check if there's a test file in tests/ directory structure
            dir_path=$(dirname "$relative_path")
            file_name=$(basename "$relative_path" .js)
            test_file_structured="rpa-system/backend/tests/${dir_path}/${file_name}.test.js"
            
            if [ ! -f "$test_file_structured" ]; then
                UNTESTED_FILES+=("$source_file")
                UNTESTED_COUNT=$((UNTESTED_COUNT + 1))
                echo -e "  ${YELLOW}⚠ Untested: $source_file${NC}"
            fi
        fi
    done
    
    # Count unique untested files (bash array handling)
    UNTESTED_FILES_COUNT=$(find rpa-system/backend -name "*.js" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/tests/*" \
        ! -path "*/.git/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        ! -path "*/coverage/*" \
        ! -name "jest.config.js" \
        ! -name "server.js" | \
    while read source_file; do
        relative_path=$(echo "$source_file" | sed 's|^rpa-system/backend/||')
        test_file_in_tests="rpa-system/backend/tests/${relative_path%.js}.test.js"
        dir_path=$(dirname "$relative_path")
        file_name=$(basename "$relative_path" .js)
        test_file_structured="rpa-system/backend/tests/${dir_path}/${file_name}.test.js"
        if [ ! -f "$test_file_in_tests" ] && [ ! -f "$test_file_structured" ]; then
            echo "$source_file"
        fi
    done | wc -l | tr -d ' ')
    
    if [ "$UNTESTED_FILES_COUNT" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ Found ${UNTESTED_FILES_COUNT} files without corresponding test files${NC}"
        if [ "$STRICT_MODE" = "true" ]; then
            echo -e "  ${RED}❌ All source files should have tests (strict mode)${NC}"
            ERRORS=$((ERRORS + 1))
        else
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "  ${GREEN}✓ All source files have corresponding test files${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Backend directory not found${NC}"
fi

echo ""

# 3. Check frontend test coverage (if applicable)
echo -e "${CYAN}3. Checking frontend test coverage...${NC}"

if [ -d "rpa-system/rpa-dashboard" ]; then
    cd rpa-system/rpa-dashboard
    
    if grep -q '"test"' package.json 2>/dev/null; then
        echo "  Frontend test coverage check (skipped - focus on backend for now)"
        # Future: Add React component test coverage checks
    else
        echo -e "  ${YELLOW}⚠ No test script found in frontend package.json${NC}"
    fi
    
    cd ../..
else
    echo -e "${YELLOW}⚠ Frontend directory not found${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Test coverage validation passed${NC}"
    echo -e "${GREEN}✅ All coverage thresholds met${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Warnings found but no critical issues${NC}"
    if [ "$STRICT_MODE" = "true" ]; then
        echo -e "${RED}❌ Strict mode: Warnings are not allowed${NC}"
        exit 1
    else
        exit 0
    fi
else
    echo -e "${RED}❌ Test coverage validation failed (${ERRORS} error(s), ${WARNINGS} warning(s))${NC}"
    echo -e "${CYAN}💡 Recommendation: Increase test coverage to meet thresholds${NC}"
    echo -e "${CYAN}   Thresholds: Lines ${COVERAGE_THRESHOLD_LINES}%, Functions ${COVERAGE_THRESHOLD_FUNCTIONS}%, Branches ${COVERAGE_THRESHOLD_BRANCHES}%, Statements ${COVERAGE_THRESHOLD_STATEMENTS}%${NC}"
    exit 1
fi
