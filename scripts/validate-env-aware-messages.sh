#!/bin/bash
# Environment-Aware Messages Validation
# Ensures all user-facing messages and logs use environment-aware utilities

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Environment-Aware Messages Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Directories to check
FRONTEND_DIR="rpa-system/rpa-dashboard/src"
BACKEND_DIR="rpa-system/backend"

# Environment-aware utilities that should be used
ENV_MESSAGE_UTILS="getEnvMessage|getUserMessage|getEnvErrorMessage|formatNotification|getEnvLogMessage|envLog"
ENV_LOGGING_UTILS="envLog|getEnvLogMessage"

# Patterns that indicate user-facing messages (should use env-aware utils)
# These are common patterns for error/success messages shown to users
USER_FACING_PATTERNS=(
    "setError\("
    "setSuccess\("
    "setMessage\("
    "showError\("
    "showSuccess\("
    "showMessage\("
    "alert\("
    "toast\."
    "notification\."
    "\.error\("
    "\.success\("
    "\.warning\("
    "throw new Error\("
    "res\.json.*error"
    "res\.status.*json.*error"
)

# Hardcoded string patterns that should use env-aware messages
# These are common user-facing strings that should be environment-aware
HARDCODED_MESSAGE_PATTERNS=(
    "Connection failed"
    "Authentication failed"
    "Please try again"
    "Contact support"
    "An error occurred"
    "Something went wrong"
    "Failed to"
    "Successfully"
    "connected successfully"
    "disconnected successfully"
    "test successful"
    "test failed"
)

# Exclude patterns (files/directories to skip)
EXCLUDE_PATTERNS=(
    "node_modules"
    "dist"
    "build"
    ".test."
    ".spec."
    "__tests__"
    "__mocks__"
    "envAwareMessages.js"  # The utility file itself
    "logger.js"  # Logger utilities
)

echo "${BLUE}Checking for environment-aware message usage...${NC}\n"

# Function to check if file should be excluded
should_exclude_file() {
    local file="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$file" == *"$pattern"* ]]; then
            return 0  # Should exclude
        fi
    done
    return 1  # Should not exclude
}

# Function to check frontend file for env-aware messages
check_frontend_messages() {
    local file="$1"
    local violations=0
    
    if should_exclude_file "$file"; then
        return 0
    fi
    
    if [[ "$file" != *.js ]] && [[ "$file" != *.jsx ]] && [[ "$file" != *.ts ]] && [[ "$file" != *.tsx ]]; then
        return 0
    fi
    
    # Check if file imports env-aware utilities
    local has_env_utils=$(grep -E "import.*(${ENV_MESSAGE_UTILS})|from.*envAwareMessages" "$file" 2>/dev/null | wc -l || echo "0")
    
    # Check for user-facing message patterns that contain actual string messages
    for pattern in "${USER_FACING_PATTERNS[@]}"; do
        # Get lines with the pattern that contain string literals (quotes)
        local lines_with_pattern=$(grep -n -E "${pattern}" "$file" 2>/dev/null | grep -v "//" | grep -E "['\"]" || true)
        
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                local line_num=$(echo "$line" | cut -d: -f1)
                local line_content=$(echo "$line" | cut -d: -f2-)
                
                # Skip if it's just clearing/null (setError(null), setError(''), etc.)
                if echo "$line_content" | grep -qE "(setError\(null\)|setError\(''\)|setError\(\"\"\)|setSuccess\(null\)|setSuccess\(''\)|setSuccess\(\"\"\))"; then
                    continue
                fi
                
                # Check if this line uses env-aware utilities
                if ! echo "$line_content" | grep -qE "${ENV_MESSAGE_UTILS}"; then
                    # Check if it contains hardcoded user-facing strings
                    local has_hardcoded=false
                    for hardcoded in "${HARDCODED_MESSAGE_PATTERNS[@]}"; do
                        if echo "$line_content" | grep -qi "$hardcoded"; then
                            has_hardcoded=true
                            break
                        fi
                    done
                    
                    # Only flag if it has hardcoded strings or if file doesn't use env utils at all
                    if [ "$has_hardcoded" = true ]; then
                        echo "  ${YELLOW}⚠ ${file}:${line_num}${NC}"
                        echo "    ${RED}✗ User-facing message may not be environment-aware${NC}"
                        echo "    ${CYAN}   Line: ${line_content:0:80}...${NC}"
                        echo "    ${CYAN}   Recommendation: Use getEnvMessage({ dev: '...', prod: '...' })${NC}"
                        violations=$((violations + 1))
                    fi
                fi
            fi
        done <<< "$lines_with_pattern"
    done
    
    # Check for hardcoded error/success messages in string literals
    # Only flag if they're in user-facing contexts (setError, setSuccess, throw Error, etc.)
    local hardcoded_in_context=$(grep -E "(setError|setSuccess|setMessage|showError|showSuccess|showMessage|throw new Error|res\.(status|json).*error).*['\"].*($(IFS='|'; echo "${HARDCODED_MESSAGE_PATTERNS[*]}")).*['\"]" "$file" 2>/dev/null | grep -v "//" | grep -v "getEnvMessage\|getUserMessage\|getEnvErrorMessage\|formatNotification" | wc -l || echo "0")
    
    if [ "$hardcoded_in_context" -gt 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded user-facing messages detected (${hardcoded_in_context} found)${NC}"
        echo "    ${CYAN}   Recommendation: Import getEnvMessage from utils/envAwareMessages and use it${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Function to check backend file for env-aware messages
check_backend_messages() {
    local file="$1"
    local violations=0
    
    if should_exclude_file "$file"; then
        return 0
    fi
    
    if [[ "$file" != *.js ]] && [[ "$file" != *.ts ]]; then
        return 0
    fi
    
    # Check for error responses that should be environment-aware
    local error_responses=$(grep -E "res\.(status|json).*error|throw new Error" "$file" 2>/dev/null | grep -v "//" | grep -v "getEnvMessage\|getUserMessage\|getEnvErrorMessage" | wc -l || echo "0")
    
    if [ "$error_responses" -gt 0 ]; then
        # Check if file imports or uses env-aware utilities
        local has_env_utils=$(grep -E "${ENV_MESSAGE_UTILS}" "$file" 2>/dev/null | wc -l || echo "0")
        
        if [ "$has_env_utils" -eq 0 ]; then
            # Check for hardcoded error messages
            local hardcoded_errors=$(grep -E "['\"].*($(IFS='|'; echo "${HARDCODED_MESSAGE_PATTERNS[*]}")).*['\"]" "$file" 2>/dev/null | grep -v "//" | wc -l || echo "0")
            
            if [ "$hardcoded_errors" -gt 0 ]; then
                echo "  ${YELLOW}⚠ ${file}${NC}"
                echo "    ${RED}✗ Error responses may contain hardcoded messages (${hardcoded_errors} found)${NC}"
                echo "    ${CYAN}   Recommendation: Use getEnvMessage for user-facing error messages${NC}"
                violations=$((violations + 1))
            fi
        fi
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Scan frontend
if [ -d "$FRONTEND_DIR" ]; then
    echo "${BLUE}Scanning frontend files for environment-aware messages...${NC}"
    while IFS= read -r -d '' file; do
        check_frontend_messages "$file" || FAILED=$((FAILED + 1))
    done < <(find "$FRONTEND_DIR" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        -print0 2>/dev/null)
fi

# Scan backend
if [ -d "$BACKEND_DIR" ]; then
    echo "\n${BLUE}Scanning backend files for environment-aware messages...${NC}"
    while IFS= read -r -d '' file; do
        check_backend_messages "$file" || FAILED=$((FAILED + 1))
    done < <(find "$BACKEND_DIR" -type f \( -name "*.js" -o -name "*.ts" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        -print0 2>/dev/null)
fi

# Summary
echo "\n${BLUE}=== Environment-Aware Messages Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ All user-facing messages are environment-aware!${NC}"
    echo ""
    echo "${CYAN}Best practices followed:${NC}"
    echo "  ✓ User-facing messages use getEnvMessage({ dev: '...', prod: '...' })"
    echo "  ✓ Error messages use getEnvErrorMessage() or getEnvMessage()"
    echo "  ✓ Logs use envLog() or getEnvLogMessage()"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} environment-aware message violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Import getEnvMessage from utils/envAwareMessages"
    echo "  2. Wrap all user-facing messages: getEnvMessage({ dev: 'technical', prod: 'user-friendly' })"
    echo "  3. Use getUserMessage() for notifications"
    echo "  4. Use envLog() for console logs that should differ by environment"
    echo ""
    echo "${YELLOW}Example:${NC}"
    echo "  ${CYAN}Before:${NC} setError('Connection failed')"
    echo "  ${CYAN}After:${NC} setError(getEnvMessage({"
    echo "    dev: 'Connection failed: ' + err.message,"
    echo "    prod: 'Connection failed. Please try again.'"
    echo "  }))"
    echo ""
    exit 1
fi

