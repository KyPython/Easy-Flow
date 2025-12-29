#!/bin/bash
# Comprehensive Validation Script
# Runs all validation checks: SRP, Dynamic Code, Theme Consistency, Logging Integration

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo "${BLUE}║     EasyFlow Comprehensive Code Validation Suite         ║${NC}"
echo "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

FAILED=0
TOTAL_CHECKS=6

# Track which checks passed/failed (using simple variables for compatibility)
SRP_RESULT=""
DYNAMIC_RESULT=""
THEME_RESULT=""
LOGGING_RESULT=""
ENV_MESSAGES_RESULT=""
RAG_RESULT=""

# Function to run a validation check
run_check() {
    local name="$1"
    local script="$2"
    local result_var="$3"
    
    echo "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${BLUE}Running: ${name}${NC}"
    echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    if ./scripts/"$script"; then
        eval "$result_var='PASSED'"
        echo "\n${GREEN}✅ ${name}: PASSED${NC}"
    else
        eval "$result_var='FAILED'"
        FAILED=$((FAILED + 1))
        echo "\n${RED}❌ ${name}: FAILED${NC}"
    fi
}

# Run all validation checks
run_check "Single Responsibility Principle (SRP)" "validate-srp.sh" "SRP_RESULT"
run_check "Dynamic Code Validation" "validate-dynamic-code.sh" "DYNAMIC_RESULT"
run_check "Theme Consistency Validation" "validate-theme-consistency.sh" "THEME_RESULT"
run_check "Logging Integration Validation" "validate-logging-integration.sh" "LOGGING_RESULT"
run_check "Environment-Aware Messages Validation" "validate-env-aware-messages.sh" "ENV_MESSAGES_RESULT"
run_check "RAG Knowledge Base Validation" "validate-rag-knowledge.sh" "RAG_RESULT"

# Summary
echo "\n${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo "${BLUE}║                    Validation Summary                     ║${NC}"
echo "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

if [ "$SRP_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Single Responsibility Principle (SRP): PASSED${NC}"
else
    echo "${RED}❌ Single Responsibility Principle (SRP): FAILED${NC}"
fi

if [ "$DYNAMIC_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Dynamic Code Validation: PASSED${NC}"
else
    echo "${RED}❌ Dynamic Code Validation: FAILED${NC}"
fi

if [ "$THEME_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Theme Consistency Validation: PASSED${NC}"
else
    echo "${RED}❌ Theme Consistency Validation: FAILED${NC}"
fi

if [ "$LOGGING_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Logging Integration Validation: PASSED${NC}"
else
    echo "${RED}❌ Logging Integration Validation: FAILED${NC}"
fi

if [ "$ENV_MESSAGES_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Environment-Aware Messages Validation: PASSED${NC}"
else
    echo "${RED}❌ Environment-Aware Messages Validation: FAILED${NC}"
fi

if [ "$RAG_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ RAG Knowledge Base Validation: PASSED${NC}"
else
    echo "${RED}❌ RAG Knowledge Base Validation: FAILED${NC}"
fi

echo ""
PASSED=$((TOTAL_CHECKS - FAILED))
echo "${BLUE}Results: ${GREEN}${PASSED}/${TOTAL_CHECKS} checks passed${NC}"

if [ $FAILED -eq 0 ]; then
    echo "\n${GREEN}✅ All validation checks passed! Code is ready for production.${NC}"
    exit 0
else
    echo "\n${RED}❌ ${FAILED} validation check(s) failed. Fix issues before shipping to production.${NC}"
    echo ""
    echo "${CYAN}Next Steps:${NC}"
    echo "  1. Review the failed checks above"
    echo "  2. Fix SRP violations (split large files/functions)"
    echo "  3. Make code dynamic (use env vars, config files)"
    echo "  4. Ensure theme consistency (use ThemeContext)"
    echo "  5. Integrate logging (use structured logger)"
    echo "  6. Use environment-aware messages (use getEnvMessage for user-facing messages)"
    echo "  7. Update RAG knowledge (update ragClient.js and aiWorkflowAgent.js)"
    echo ""
    exit 1
fi

