#!/bin/bash
# Logging Integration Validation
# Ensures all logs use the observability system (structured logging)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Logging Integration Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Directories to check
BACKEND_DIR="rpa-system/backend"
FRONTEND_DIR="rpa-system/rpa-dashboard/src"
AUTOMATION_DIR="rpa-system/automation/automation-service"

# Expected logging patterns
BACKEND_LOGGER_PATTERN="createLogger|getLogger|logger\\.|rootLogger\\."
FRONTEND_LOGGER_PATTERN="createLogger|logger\\.|realtimeLogger\\.|apiLogger\\.|authLogger\\."
PYTHON_LOGGER_PATTERN="logging\\.|logger\\.|getLogger"

# Anti-patterns (should not be used)
CONSOLE_LOG_PATTERN="console\\.(log|info|warn|error|debug)"
PRINT_PATTERN="^\\s*print\\s*\\("

echo "${BLUE}Checking for proper logging integration...${NC}\n"

# Function to check backend file
check_backend_logging() {
    local file="$1"
    local violations=0
    
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *"jest.setup"* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *"build"* ]]; then
        return 0
    fi
    
    if [[ "$file" != *.js ]] && [[ "$file" != *.ts ]]; then
        return 0
    fi
    
    # Skip logger files themselves
    if [[ "$file" == *"logger"* ]] && [[ "$file" == *"utils"* ]]; then
        return 0
    fi
    
    # Check for console.log usage (should use structured logger)
    local console_logs=$(grep -E "${CONSOLE_LOG_PATTERN}" "$file" 2>/dev/null | grep -v "//" | grep -v "console.debug" | wc -l || echo "0")
    
    if [ "$console_logs" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ console.log/info/warn/error detected (${console_logs} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use createLogger() or logger from structuredLogging${NC}"
        violations=$((violations + 1))
    fi
    
    # Check if file uses structured logger
    local uses_logger=$(grep -E "${BACKEND_LOGGER_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    
    # If file has logging but doesn't use structured logger, flag it
    if [ "$console_logs" -gt 0 ] && [ "$uses_logger" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Uses console.* instead of structured logger${NC}"
        echo "    ${CYAN}   Recommendation: Import and use createLogger() from structuredLogging${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Function to check frontend file
check_frontend_logging() {
    local file="$1"
    local violations=0
    
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *"jest.setup"* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *"build"* ]]; then
        return 0
    fi
    
    if [[ "$file" != *.js ]] && [[ "$file" != *.jsx ]] && [[ "$file" != *.ts ]] && [[ "$file" != *.tsx ]]; then
        return 0
    fi
    
    # Skip logger files themselves
    if [[ "$file" == *"logger"* ]] && [[ "$file" == *"utils"* ]]; then
        return 0
    fi
    
    # Check for console.log usage (should use observability logger)
    local console_logs=$(grep -E "${CONSOLE_LOG_PATTERN}" "$file" 2>/dev/null | grep -v "console.debug" | grep -v "//" | wc -l || echo "0")
    
    if [ "$console_logs" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ console.log/info/warn/error detected (${console_logs} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use createLogger() from utils/logger${NC}"
        violations=$((violations + 1))
    fi
    
    # Check if file uses observability logger
    local uses_logger=$(grep -E "${FRONTEND_LOGGER_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    
    if [ "$console_logs" -gt 0 ] && [ "$uses_logger" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Uses console.* instead of observability logger${NC}"
        echo "    ${CYAN}   Recommendation: Import and use createLogger() from utils/logger${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Function to check Python file
check_python_logging() {
    local file="$1"
    local violations=0
    
    if [[ "$file" == *".test."* ]] || [[ "$file" == *"__pycache__"* ]] || [[ "$file" == *"node_modules"* ]]; then
        return 0
    fi
    
    if [[ "$file" != *.py ]]; then
        return 0
    fi
    
    # Check for print statements (should use logging)
    local print_statements=$(grep -E "${PRINT_PATTERN}" "$file" 2>/dev/null | grep -v "#" | wc -l || echo "0")
    
    if [ "$print_statements" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ print() statements detected (${print_statements} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use logging module instead of print()${NC}"
        violations=$((violations + 1))
    fi
    
    # Check if file uses logging module
    local uses_logging=$(grep -E "${PYTHON_LOGGER_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    
    if [ "$print_statements" -gt 0 ] && [ "$uses_logging" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Uses print() instead of logging module${NC}"
        echo "    ${CYAN}   Recommendation: Import logging and use logger instead${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Scan backend
if [ -d "$BACKEND_DIR" ]; then
    echo "${BLUE}Scanning backend files...${NC}"
    while IFS= read -r -d '' file; do
        check_backend_logging "$file" || FAILED=$((FAILED + 1))
    done < <(find "$BACKEND_DIR" -type f \( -name "*.js" -o -name "*.ts" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        ! -name "jest.setup.js" \
        -print0 2>/dev/null)
fi

# Scan frontend
if [ -d "$FRONTEND_DIR" ]; then
    echo "\n${BLUE}Scanning frontend files...${NC}"
    while IFS= read -r -d '' file; do
        check_frontend_logging "$file" || FAILED=$((FAILED + 1))
    done < <(find "$FRONTEND_DIR" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        ! -name "jest.setup.js" \
        -print0 2>/dev/null)
fi

# Scan Python automation
if [ -d "$AUTOMATION_DIR" ]; then
    echo "\n${BLUE}Scanning Python automation files...${NC}"
    while IFS= read -r -d '' file; do
        check_python_logging "$file" || FAILED=$((FAILED + 1))
    done < <(find "$AUTOMATION_DIR" -type f -name "*.py" \
        ! -path "*/__pycache__/*" \
        ! -name "*.test.py" \
        -print0 2>/dev/null)
fi

# Summary
echo "\n${BLUE}=== Logging Integration Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ All logs are integrated with observability system!${NC}"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} logging integration violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Backend: Use createLogger() from middleware/structuredLogging"
    echo "  2. Frontend: Use createLogger() from utils/logger"
    echo "  3. Python: Use logging module instead of print()"
    echo "  4. Replace all console.log/info/warn/error with structured logger"
    echo ""
    exit 1
fi

