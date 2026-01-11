#!/bin/bash
# Comprehensive Validation Script
# Runs all validation checks: SRP, Dynamic Code, Theme Consistency, Logging Integration,
# Duplicate Code, Unused Code, Duplicate Features

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
TOTAL_CHECKS=13

# Track which checks passed/failed (using simple variables for compatibility)
SRP_RESULT=""
DYNAMIC_RESULT=""
THEME_RESULT=""
LOGGING_RESULT=""
ENV_MESSAGES_RESULT=""
RAG_RESULT=""
LEARNING_RESULT=""
DUPLICATE_CODE_RESULT=""
UNUSED_CODE_RESULT=""
DUPLICATE_FEATURES_RESULT=""
DUPLICATE_CICD_RESULT=""
BACKUP_RESULT=""
TEST_COVERAGE_RESULT=""

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
run_check "Learning System Validation" "validate-learning-system.sh" "LEARNING_RESULT"
run_check "Duplicate Code Detection" "validate-duplicate-code.sh" "DUPLICATE_CODE_RESULT"
run_check "Unused Code Detection" "validate-unused-code.sh" "UNUSED_CODE_RESULT"
run_check "Duplicate Features Detection" "validate-duplicate-features.sh" "DUPLICATE_FEATURES_RESULT"
run_check "Duplicate CI/CD Workflows Detection" "validate-duplicate-cicd.sh" "DUPLICATE_CICD_RESULT"
run_check "Code Backup Verification" "verify-backup.sh" "BACKUP_RESULT"
run_check "Test Coverage Validation" "validate-test-coverage.sh" "TEST_COVERAGE_RESULT"

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

if [ "$LEARNING_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Learning System Validation: PASSED${NC}"
else
    echo "${RED}❌ Learning System Validation: FAILED${NC}"
fi

if [ "$DUPLICATE_CODE_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Duplicate Code Detection: PASSED${NC}"
else
    echo "${RED}❌ Duplicate Code Detection: FAILED${NC}"
fi

if [ "$UNUSED_CODE_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Unused Code Detection: PASSED${NC}"
else
    echo "${RED}❌ Unused Code Detection: FAILED${NC}"
fi

if [ "$DUPLICATE_FEATURES_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Duplicate Features Detection: PASSED${NC}"
else
    echo "${RED}❌ Duplicate Features Detection: FAILED${NC}"
fi

if [ "$DUPLICATE_CICD_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Duplicate CI/CD Workflows Detection: PASSED${NC}"
else
    echo "${RED}❌ Duplicate CI/CD Workflows Detection: FAILED${NC}"
fi

if [ "$BACKUP_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Code Backup Verification: PASSED${NC}"
else
    echo "${RED}❌ Code Backup Verification: FAILED${NC}"
fi

if [ "$TEST_COVERAGE_RESULT" = "PASSED" ]; then
    echo "${GREEN}✅ Test Coverage Validation: PASSED${NC}"
else
    echo "${RED}❌ Test Coverage Validation: FAILED${NC}"
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
    echo "  8. Ensure learning system is integrated (check UniversalLearningService integration points)"
    echo "  9. Remove duplicate code blocks (extract into reusable functions)"
    echo "  10. Remove unused code (imports, variables, exports)"
    echo "  11. Consolidate duplicate features (routes, components, utilities)"
    echo "  12. Consolidate duplicate CI/CD workflows (rename jobs or merge workflows)"
    echo "  13. Ensure code is backed up to GitHub (run 'git push')"
    echo "  14. Increase test coverage to meet thresholds (Lines 80%, Functions 70%, Branches 70%, Statements 80%)"
    echo ""
    exit 1
fi

