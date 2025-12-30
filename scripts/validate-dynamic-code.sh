#!/bin/bash
# Dynamic Code Validation
# Ensures code is dynamic and flexible without breaking functionality

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Dynamic Code Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Directories to check
CODE_DIRS=(
    "rpa-system/backend"
    "rpa-system/rpa-dashboard/src"
)

echo "${BLUE}Checking for hardcoded values and static configurations...${NC}\n"

# Function to check a file for dynamic code violations
check_file_dynamic() {
    local file="$1"
    local violations=0
    
    # Skip test files
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *"build"* ]]; then
        return 0
    fi
    
    # Check for hardcoded URLs (should use environment variables or config)
    local hardcoded_urls=$(grep -E "https?://[a-zA-Z0-9.-]+\.(com|net|org|io|co|dev|app)" "$file" 2>/dev/null | grep -v "localhost" | grep -v "127.0.0.1" | grep -v "example.com" | grep -v "http://localhost" | grep -v "https://localhost" | grep -v "//.*localhost" | wc -l || echo "0")
    
    if [ "$hardcoded_urls" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded URLs detected (${hardcoded_urls} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use environment variables or configuration files${NC}"
        violations=$((violations + 1))
    fi
    
    # Check for hardcoded API keys/tokens (security issue + not dynamic)
    local hardcoded_keys=$(grep -iE "(api[_-]?key|token|secret|password)\s*[:=]\s*['\"][^'\"]{10,}" "$file" 2>/dev/null | grep -v "process.env" | grep -v "import.*from" | wc -l || echo "0")
    
    if [ "$hardcoded_keys" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded credentials detected (${hardcoded_keys} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use environment variables or secure config${NC}"
        violations=$((violations + 1))
    fi
    
    # Check for magic numbers (should be constants or config)
    local magic_numbers=$(grep -E "[^a-zA-Z_]([0-9]{3,}|[0-9]+\.[0-9]+)" "$file" 2>/dev/null | grep -v "0x" | grep -v "//" | grep -v "http" | grep -v "localhost" | grep -v "version" | grep -v "\.test\." | wc -l || echo "0")
    
    # Only flag if there are many magic numbers (some are acceptable)
    if [ "$magic_numbers" -gt 10 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Many magic numbers detected (${magic_numbers} found)${NC}"
        echo "    ${CYAN}   Recommendation: Extract to named constants or configuration${NC}"
        violations=$((violations + 1))
    fi
    
    # Check for hardcoded file paths (should be configurable)
    local hardcoded_paths=$(grep -E "['\"](/[^'\"]+|\.\.[^'\"]+|/[a-zA-Z]:[^'\"]+)" "$file" 2>/dev/null | grep -v "node_modules" | grep -v "import.*from" | grep -v "require(" | wc -l || echo "0")
    
    if [ "$hardcoded_paths" -gt 5 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded file paths detected (${hardcoded_paths} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use path.join() or configuration${NC}"
        violations=$((violations + 1))
    fi
    
    # Check for use of process.env (good - dynamic)
    local uses_env=$(grep -c "process.env" "$file" 2>/dev/null || echo "0")
    local uses_config=$(grep -iE "(config|settings|options)" "$file" 2>/dev/null | grep -v "//" | wc -l || echo "0")
    
    # If file has hardcoded values but doesn't use env/config, flag it
    if [ "$hardcoded_urls" -gt 0 ] && [ "$uses_env" -eq 0 ] && [ "$uses_config" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded values without environment/config usage${NC}"
        echo "    ${CYAN}   Recommendation: Make values configurable via environment or config files${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Scan code directories
for dir in "${CODE_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    
    echo "${BLUE}Scanning ${dir}...${NC}"
    while IFS= read -r -d '' file; do
        check_file_dynamic "$file" || FAILED=$((FAILED + 1))
    done < <(find "$dir" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        -print0 2>/dev/null)
done

# Summary
echo "\n${BLUE}=== Dynamic Code Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ Code is dynamic and configurable!${NC}"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} dynamic code violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Replace hardcoded URLs with environment variables"
    echo "  2. Extract magic numbers to named constants or config"
    echo "  3. Use configuration files for file paths"
    echo "  4. Never hardcode credentials - use environment variables"
    echo ""
    exit 1
fi

