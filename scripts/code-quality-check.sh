#!/bin/bash
# EasyFlow Code Quality Check
# Adapted from software-entropy: https://github.com/KyPython/software-entropy
# Scans codebase for code smells: long functions, large files, TODO/FIXME density

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Code Quality Check ===${NC}\n"

# Check if software-entropy is available
if ! command -v npx >/dev/null 2>&1; then
    echo "${RED}✗ npx not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Load configuration from .code-quality-config.json if available
if [ -f ".code-quality-config.json" ]; then
    MAX_FUNCTION_LINES=${MAX_FUNCTION_LINES:-$(node -e "console.log(require('./.code-quality-config.json').rules.longFunction.threshold || 50)" 2>/dev/null || echo "50")}
    MAX_FILE_LINES=${MAX_FILE_LINES:-$(node -e "console.log(require('./.code-quality-config.json').rules.largeFile.threshold || 500)" 2>/dev/null || echo "500")}
    MAX_TODO_DENSITY=${MAX_TODO_DENSITY:-$(node -e "console.log(require('./.code-quality-config.json').rules.todoDensity.threshold || 5)" 2>/dev/null || echo "5")}
else
    # Default thresholds (can be overridden)
    MAX_FUNCTION_LINES=${MAX_FUNCTION_LINES:-50}
    MAX_FILE_LINES=${MAX_FILE_LINES:-500}
    MAX_TODO_DENSITY=${MAX_TODO_DENSITY:-5}
fi

# Directories to scan
SCAN_DIRS=(
    "rpa-system/backend"
    "rpa-system/rpa-dashboard/src"
    "rpa-system/automation/automation-service"
)

# Patterns to include
INCLUDE_PATTERNS="**/*.{js,jsx,ts,tsx,py}"

# Patterns to exclude
EXCLUDE_PATTERNS="**/node_modules/**,**/dist/**,**/build/**,**/__pycache__/**,**/*.test.js,**/*.spec.js,**/*.test.ts,**/*.spec.ts,**/coverage/**,**/.git/**"

# Output file
OUTPUT_FILE="${1:-code-quality-report.json}"

# Track results
TOTAL_ISSUES=0
FAILED_SCANS=0

echo "${BLUE}Configuration:${NC}"
echo "  Max function lines: ${CYAN}$MAX_FUNCTION_LINES${NC}"
echo "  Max file lines: ${CYAN}$MAX_FILE_LINES${NC}"
echo "  Max TODO density: ${CYAN}$MAX_TODO_DENSITY${NC} per 100 lines"
echo ""

# Function to scan a directory
scan_directory() {
    local dir="$1"
    local dir_name=$(basename "$dir")
    
    if [ ! -d "$dir" ]; then
        echo "${YELLOW}○ Skipping $dir (not found)${NC}"
        return 0
    fi
    
    echo "${BLUE}Scanning $dir_name...${NC}"
    
    # Try to run software-entropy via npx
    if npx -y software-entropy@latest "$dir" \
        --max-function-lines "$MAX_FUNCTION_LINES" \
        --max-file-lines "$MAX_FILE_LINES" \
        --max-todo-density "$MAX_TODO_DENSITY" \
        --include "$INCLUDE_PATTERNS" \
        --exclude "$EXCLUDE_PATTERNS" \
        --output "/tmp/${dir_name}-quality.json" \
        --json 2>/dev/null; then
        
        # Check if issues were found
        if [ -f "/tmp/${dir_name}-quality.json" ]; then
            local issues=$(cat "/tmp/${dir_name}-quality.json" | grep -o '"severity"' | wc -l || echo "0")
            if [ "$issues" -gt 0 ]; then
                echo "  ${YELLOW}⚠ Found $issues code quality issues${NC}"
                TOTAL_ISSUES=$((TOTAL_ISSUES + issues))
                
                # Show summary
                cat "/tmp/${dir_name}-quality.json" | grep -E '"file"|"message"|"severity"' | head -15 || true
            else
                echo "  ${GREEN}✓ No issues found${NC}"
            fi
        fi
    else
        echo "  ${YELLOW}⚠ software-entropy not available via npx, using fallback checks${NC}"
        run_fallback_checks "$dir"
        FAILED_SCANS=$((FAILED_SCANS + 1))
    fi
}

# Fallback checks using basic tools
run_fallback_checks() {
    local dir="$1"
    local issues=0
    
    echo "  ${BLUE}Running fallback code quality checks...${NC}"
    
    # Check for large files
    while IFS= read -r file; do
        local lines=$(wc -l < "$file" 2>/dev/null || echo "0")
        if [ "$lines" -gt "$MAX_FILE_LINES" ]; then
            echo "    ${YELLOW}⚠ Large file: $file ($lines lines, threshold: $MAX_FILE_LINES)${NC}"
            issues=$((issues + 1))
        fi
    done < <(find "$dir" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/__pycache__/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        2>/dev/null | head -20)
    
    # Check for TODO/FIXME density
    while IFS= read -r file; do
        local lines=$(wc -l < "$file" 2>/dev/null || echo "1")
        local todos=$(grep -cE "(TODO|FIXME|XXX|HACK|NOTE)" "$file" 2>/dev/null || echo "0")
        local density=$((todos * 100 / lines))
        
        if [ "$density" -gt "$MAX_TODO_DENSITY" ] && [ "$todos" -gt 0 ]; then
            echo "    ${YELLOW}⚠ High TODO density: $file ($todos TODOs in $lines lines, density: ${density}%)${NC}"
            issues=$((issues + 1))
        fi
    done < <(find "$dir" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/__pycache__/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        2>/dev/null | head -20)
    
    TOTAL_ISSUES=$((TOTAL_ISSUES + issues))
    
    if [ "$issues" -eq 0 ]; then
        echo "  ${GREEN}✓ No issues found with fallback checks${NC}"
    fi
}

# Scan each directory
for dir in "${SCAN_DIRS[@]}"; do
    scan_directory "$dir"
    echo ""
done

# Summary
echo "${BLUE}=== Summary ===${NC}"
if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo "${GREEN}✅ No code quality issues found!${NC}"
    exit 0
else
    echo "${YELLOW}⚠ Found $TOTAL_ISSUES code quality issue(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Review large files and consider splitting them"
    echo "  2. Break down long functions into smaller, focused functions"
    echo "  3. Address TODO/FIXME comments or convert them to issues"
    echo "  4. Run with software-entropy for detailed analysis:"
    echo "     ${BLUE}npx -y software-entropy@latest .${NC}"
    echo ""
    
    # Don't fail the script - just warn
    exit 0
fi

