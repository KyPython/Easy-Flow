#!/bin/bash
# EasyFlow Code Quality Check - Hotspot-Focused Analysis
# Uses Software Entropy tool with hotspot detection (complexity × churn)
# Philosophy: "Fix these 10 hotspots first" instead of "You have 50,000 issues"

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Code Quality Check (Hotspot-Focused) ===${NC}\n"
echo "${CYAN}Why Hotspots Matter:${NC}"
echo "  SonarQube says: \"You have 50,000 bad lines of code.\""
echo "  Software Entropy says: \"Fix these hotspots first.\""
echo "  ${CYAN}Hotspots = Complex Code × Frequent Changes${NC}"
echo ""

# Check for local software-entropy tool first, then fallback to npx
SOFTWARE_ENTROPY_CMD=""

# Prefer a repo-installed dependency (most reliable in CI/local dev)
if [ -x "./node_modules/.bin/software-entropy" ]; then
    SOFTWARE_ENTROPY_CMD="./node_modules/.bin/software-entropy"
    echo "${GREEN}✓ Using repo-installed Software Entropy tool${NC}"
elif command -v software-entropy >/dev/null 2>&1; then
    SOFTWARE_ENTROPY_CMD="software-entropy"
    echo "${GREEN}✓ Using global Software Entropy installation${NC}"
elif command -v npx >/dev/null 2>&1; then
    SOFTWARE_ENTROPY_CMD="npx -y software-entropy@latest"
    echo "${YELLOW}⚠ Using npx (consider installing locally for better performance)${NC}"
else
    echo "${RED}✗ Software Entropy not found.${NC}"
    echo "  Install: npm install -g software-entropy"
    echo "  Or ensure Node.js/npx is available"
    exit 1
fi

# Configuration (kept env-overridable)
MAX_FUNCTION_LINES="${MAX_FUNCTION_LINES:-50}"
MAX_FILE_LINES="${MAX_FILE_LINES:-500}"
MAX_TODO_DENSITY="${MAX_TODO_DENSITY:-5}"
OUTPUT_FILE="${1:-code-quality-report.json}"

echo ""
echo "${BLUE}Configuration:${NC}"
echo "  Max Function Lines: ${CYAN}${MAX_FUNCTION_LINES}${NC}"
echo "  Max File Lines: ${CYAN}${MAX_FILE_LINES}${NC}"
echo "  Max TODO Density: ${CYAN}${MAX_TODO_DENSITY} per 100 lines${NC}"
echo ""

# Run scan (current software-entropy CLI options)
echo "${BLUE}Running code quality scan...${NC}"
echo "${CYAN}This identifies oversized functions/files and TODO density issues.${NC}"
echo ""

OUTPUT=$(mktemp)
ERROR_OUTPUT=$(mktemp)

# Tool may return non-zero depending on findings; treat that as "scan ran" and surface output.
set +e
$SOFTWARE_ENTROPY_CMD . \
  --max-function-lines "$MAX_FUNCTION_LINES" \
  --max-file-lines "$MAX_FILE_LINES" \
  --max-todo-density "$MAX_TODO_DENSITY" \
  --output "${OUTPUT_FILE:-code-quality-report.json}" \
  > "$OUTPUT" 2> "$ERROR_OUTPUT"
EXIT_CODE=$?
set -e

cat "$OUTPUT"
if [ -s "$ERROR_OUTPUT" ]; then
    echo ""
    echo "${YELLOW}⚠ Warnings / Notes:${NC}"
    cat "$ERROR_OUTPUT" | head -10
fi

rm -f "$OUTPUT" "$ERROR_OUTPUT"

echo ""
if [ ! -s "${OUTPUT_FILE:-code-quality-report.json}" ]; then
    echo "${RED}✗ Code quality scan did not produce a report (${OUTPUT_FILE}).${NC}"
    echo "${RED}  Treating as blocking (tool failure).${NC}"
    exit 1
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo "${GREEN}✅ Code quality scan complete!${NC}"
else
    echo "${YELLOW}⚠ Code quality scan completed with findings (exit ${EXIT_CODE}).${NC}"
    echo "${YELLOW}  Treating as non-blocking for readiness; review report: ${OUTPUT_FILE}${NC}"
fi

exit 0

