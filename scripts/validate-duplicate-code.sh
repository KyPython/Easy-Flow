#!/bin/bash
# Validate Duplicate Code Detection
# Uses jscpd (JavaScript Copy/Paste Detector) to find duplicate code blocks

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== Duplicate Code Detection ===${NC}\n"

# Check if jscpd is available
if ! command -v jscpd >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
    echo -e "${RED}✗ jscpd not found and npx not available${NC}"
    echo "  Install: npm install -g jscpd"
    exit 1
fi

# Use jscpd directly or via npx
JSCPD_CMD=""
if command -v jscpd >/dev/null 2>&1; then
    JSCPD_CMD="jscpd"
    echo -e "${GREEN}✓ Using global jscpd installation${NC}"
else
    JSCPD_CMD="npx -y jscpd@latest"
    echo -e "${YELLOW}⚠ Using npx (consider installing globally: npm install -g jscpd)${NC}"
fi

# Configuration
MIN_LINES="${MIN_LINES:-10}"  # Minimum lines for duplicate detection
THRESHOLD="${THRESHOLD:-3}"   # Maximum allowed duplicates (3% threshold)
FORMAT="${FORMAT:-console}"   # Output format
REPORT_DIR="${REPORT_DIR:-reports/duplicates}"

# Directories to check
TARGET_DIRS=(
    "rpa-system/backend"
    "rpa-system/rpa-dashboard/src"
)

# Directories to ignore
IGNORE_PATTERNS=(
    "**/node_modules/**"
    "**/dist/**"
    "**/build/**"
    "**/.next/**"
    "**/coverage/**"
    "**/*.test.js"
    "**/*.spec.js"
    "**/*.test.ts"
    "**/*.spec.ts"
    "**/__tests__/**"
    "**/__mocks__/**"
)

echo -e "${CYAN}Configuration:${NC}"
echo "  Min Lines: ${MIN_LINES}"
echo "  Threshold: ${THRESHOLD}%"
echo "  Report Dir: ${REPORT_DIR}"
echo ""

# Build ignore pattern
IGNORE_FLAG=""
for pattern in "${IGNORE_PATTERNS[@]}"; do
    IGNORE_FLAG="${IGNORE_FLAG} --ignore '${pattern}'"
done

# Run duplicate code detection
echo -e "${BLUE}Scanning for duplicate code...${NC}\n"

ERRORS=0
WARNINGS=0

for dir in "${TARGET_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠ Directory not found: ${dir}${NC}"
        continue
    fi

    echo -e "${CYAN}Checking: ${dir}${NC}"
    
    # Run jscpd and capture output
    OUTPUT=$(mktemp)
    ERROR_OUTPUT=$(mktemp)
    
    # jscpd command with thresholds
    if eval "$JSCPD_CMD \"$dir\" \
        --min-lines ${MIN_LINES} \
        --threshold ${THRESHOLD} \
        --format ${FORMAT} \
        --reporters console \
        ${IGNORE_FLAG} \
        --skip-comments \
        --ignore-case" > "$OUTPUT" 2> "$ERROR_OUTPUT"; then
        
        # Check if duplicates were found
        if grep -q "found" "$OUTPUT" && grep -q "%" "$OUTPUT"; then
            # Extract percentage (works with basic grep, no -P needed)
            DUPLICATE_PERCENT=$(grep -oE '[0-9]+\.?[0-9]*%' "$OUTPUT" | grep -oE '[0-9]+\.?[0-9]*' | head -1 || echo "0")
            # Simple numeric comparison without bc (compare integers)
            DUPLICATE_INT=${DUPLICATE_PERCENT%.*}
            THRESHOLD_INT=${THRESHOLD%.*}
            if [ -n "$DUPLICATE_PERCENT" ] && [ "$DUPLICATE_INT" -gt "$THRESHOLD_INT" ] 2>/dev/null; then
                echo -e "${RED}✗ Duplicate code detected: ${DUPLICATE_PERCENT}% (threshold: ${THRESHOLD}%)${NC}"
                cat "$OUTPUT"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "${GREEN}✓ Duplicate code within threshold: ${DUPLICATE_PERCENT}%${NC}"
            fi
        else
            echo -e "${GREEN}✓ No duplicate code detected${NC}"
        fi
    else
        # Command failed - check error output
        if [ -s "$ERROR_OUTPUT" ]; then
            echo -e "${YELLOW}⚠ Warning from jscpd:${NC}"
            cat "$ERROR_OUTPUT" | head -10
            WARNINGS=$((WARNINGS + 1))
        fi
        # Still show output if available
        if [ -s "$OUTPUT" ]; then
            cat "$OUTPUT"
        fi
    fi
    
    rm -f "$OUTPUT" "$ERROR_OUTPUT"
    echo ""
done

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No duplicate code issues found${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Warnings found but no critical issues${NC}"
    exit 0
else
    echo -e "${RED}❌ Duplicate code detected (${ERRORS} error(s), ${WARNINGS} warning(s))${NC}"
    echo -e "${CYAN}💡 Recommendation: Refactor duplicate code blocks into reusable functions${NC}"
    exit 1
fi
