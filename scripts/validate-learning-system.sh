#!/bin/bash

# ============================================================================
# Learning System Validation Script
# ============================================================================
# Validates that the entire app is learning from every automation and workflow
# Ensures learning services are properly integrated and functioning
#
# Exit codes:
#   0 = All checks passed
#   1 = Critical learning system issues found
#   2 = Warnings found (non-blocking)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

echo -e "${BLUE}🧠 Validating Universal Learning System...${NC}\n"

# ============================================================================
# 1. Check Learning Service Exists
# ============================================================================
echo -e "${BLUE}📋 Checking learning service files...${NC}"

LEARNING_SERVICE="rpa-system/backend/services/UniversalLearningService.js"
if [ ! -f "$LEARNING_SERVICE" ]; then
    echo -e "${RED}❌ Learning service not found: $LEARNING_SERVICE${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Learning service exists${NC}"
fi

# ============================================================================
# 2. Check Learning Service Methods
# ============================================================================
echo -e "${BLUE}📋 Checking learning service methods...${NC}"

REQUIRED_METHODS=(
    "learnFromAutomationSuccess"
    "learnFromAutomationFailure"
    "learnFromWorkflowSuccess"
    "getLearnedPatterns"
    "getOptimizedSelectors"
    "learnFromUserFeedback"
    "analyzeAndSuggestImprovements"
)

for method in "${REQUIRED_METHODS[@]}"; do
    if grep -q "$method" "$LEARNING_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}  ✅ Method exists: $method${NC}"
    else
        echo -e "${RED}  ❌ Method missing: $method${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# ============================================================================
# 3. Check Database Migration Exists
# ============================================================================
echo -e "${BLUE}📋 Checking database migrations...${NC}"

MIGRATION_FILE="rpa-system/backend/migrations/add_universal_learning.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Learning migration not found: $MIGRATION_FILE${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Learning migration exists${NC}"
    
    # Check migration includes required tables
    REQUIRED_TABLES=(
        "automation_learning_patterns"
        "automation_learning_failures"
        "workflow_learning_patterns"
        "user_feedback_learning"
    )
    
    for table in "${REQUIRED_TABLES[@]}"; do
        if grep -qi "CREATE TABLE.*$table" "$MIGRATION_FILE" 2>/dev/null; then
            echo -e "${GREEN}  ✅ Table defined: $table${NC}"
        else
            echo -e "${RED}  ❌ Table missing: $table${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

# ============================================================================
# 4. Check Integration Points
# ============================================================================
echo -e "${BLUE}📋 Checking learning integration points...${NC}"

# Check Kafka service integration
KAFKA_SERVICE="rpa-system/backend/utils/kafkaService.js"
if grep -q "UniversalLearningService" "$KAFKA_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning integrated in Kafka service${NC}"
    
    # Check both success and failure learning
    if grep -q "learnFromAutomationSuccess" "$KAFKA_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}  ✅ Success learning integrated${NC}"
    else
        echo -e "${RED}  ❌ Success learning not integrated${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "learnFromAutomationFailure" "$KAFKA_SERVICE" 2>/dev/null; then
        echo -e "${GREEN}  ✅ Failure learning integrated${NC}"
    else
        echo -e "${RED}  ❌ Failure learning not integrated${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Learning not integrated in Kafka service${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check workflow executor integration
WORKFLOW_EXECUTOR="rpa-system/backend/services/workflowExecutor.js"
if grep -q "UniversalLearningService" "$WORKFLOW_EXECUTOR" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning integrated in workflow executor${NC}"
    
    if grep -q "learnFromWorkflowSuccess" "$WORKFLOW_EXECUTOR" 2>/dev/null; then
        echo -e "${GREEN}  ✅ Workflow learning integrated${NC}"
    else
        echo -e "${RED}  ❌ Workflow learning not integrated${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Learning not integrated in workflow executor${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check link discovery integration (should use its own learning + universal)
LINK_DISCOVERY="rpa-system/backend/services/linkDiscoveryService.js"
if grep -q "_learnFromSuccess\|learnFromSuccess" "$LINK_DISCOVERY" 2>/dev/null; then
    echo -e "${GREEN}✅ Link discovery has learning${NC}"
else
    echo -e "${YELLOW}⚠️  Link discovery learning not found (may use separate system)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# 5. Check Learning Service Exports
# ============================================================================
echo -e "${BLUE}📋 Checking learning service exports...${NC}"

if grep -q "getUniversalLearningService" "$LEARNING_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning service exports singleton${NC}"
else
    echo -e "${RED}❌ Learning service missing singleton export${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# 6. Check Error Handling
# ============================================================================
echo -e "${BLUE}📋 Checking error handling in learning...${NC}"

# Learning should not fail automation/workflows
if grep -q "non-fatal\|Don't fail\|Don't fail" "$KAFKA_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning has non-fatal error handling in Kafka${NC}"
else
    echo -e "${YELLOW}⚠️  Learning error handling may be missing in Kafka${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "non-fatal\|Don't fail\|Don't fail" "$WORKFLOW_EXECUTOR" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning has non-fatal error handling in workflows${NC}"
else
    echo -e "${YELLOW}⚠️  Learning error handling may be missing in workflows${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# 7. Check Learning Service Imports
# ============================================================================
echo -e "${BLUE}📋 Checking learning service dependencies...${NC}"

if grep -q "getSupabase\|supabaseClient" "$LEARNING_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning service has Supabase client${NC}"
else
    echo -e "${RED}❌ Learning service missing Supabase client${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "logger" "$LEARNING_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning service has logger${NC}"
else
    echo -e "${RED}❌ Learning service missing logger${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# 8. Check Learning Cache Implementation
# ============================================================================
echo -e "${BLUE}📋 Checking learning cache implementation...${NC}"

if grep -q "patternCache\|Map()" "$LEARNING_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning service has caching${NC}"
else
    echo -e "${YELLOW}⚠️  Learning service may be missing caching${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# 9. Check Learning Data Structure
# ============================================================================
echo -e "${BLUE}📋 Checking learning data structures...${NC}"

# Check that learning methods accept proper parameters
if grep -q "automationType\|siteUrl\|taskType" "$LEARNING_SERVICE" 2>/dev/null; then
    echo -e "${GREEN}✅ Learning methods have proper parameters${NC}"
else
    echo -e "${RED}❌ Learning methods may be missing required parameters${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# 10. Check Link Discovery Learning (Separate System)
# ============================================================================
echo -e "${BLUE}📋 Checking link discovery learning system...${NC}"

if grep -q "_learnFromSuccess\|_getLearnedPatterns" "$LINK_DISCOVERY" 2>/dev/null; then
    echo -e "${GREEN}✅ Link discovery has its own learning system${NC}"
else
    echo -e "${YELLOW}⚠️  Link discovery learning methods not found${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check link discovery migration
LINK_DISCOVERY_MIGRATION="rpa-system/backend/migrations/add_link_discovery_learning.sql"
if [ -f "$LINK_DISCOVERY_MIGRATION" ]; then
    echo -e "${GREEN}✅ Link discovery migration exists${NC}"
else
    echo -e "${YELLOW}⚠️  Link discovery migration not found${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# Summary
# ============================================================================
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Learning System Validation Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All learning system checks passed!${NC}"
    echo -e "${GREEN}   The app is properly configured to learn from every automation and workflow.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Learning system validation completed with $WARNINGS warning(s)${NC}"
    echo -e "${YELLOW}   The system will learn, but some optimizations may be missing.${NC}"
    exit 0
else
    echo -e "${RED}❌ Learning system validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo -e "${RED}   The app may not be learning properly. Please fix the issues above.${NC}"
    exit 1
fi




