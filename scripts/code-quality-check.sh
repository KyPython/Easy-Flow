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
if [ -f "/Users/ky/software-entropy/dist/cli.js" ]; then
    SOFTWARE_ENTROPY_CMD="node /Users/ky/software-entropy/dist/cli.js"
    echo "${GREEN}✓ Using local Software Entropy tool${NC}"
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

# Hotspot-focused configuration
HOTSPOT_WINDOW="${HOTSPOT_WINDOW:-30}"  # Days for churn analysis
TOP_HOTSPOTS="${TOP_HOTSPOTS:-10}"      # Number of top hotspots to show
CONFIG_FILE="${CONFIG_FILE:-.code-quality-config.json}"
OUTPUT_FILE="${1:-code-quality-report.json}"

# Check if we're in a git repository (required for hotspot analysis)
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "${YELLOW}⚠ Not a git repository. Hotspot analysis requires git history.${NC}"
    echo "  Run: git init (if new repo) or ensure you're in a git repo"
    echo "  Falling back to traditional scan (without hotspots)..."
    USE_HOTSPOTS=false
else
    USE_HOTSPOTS=true
    echo "${GREEN}✓ Git repository detected - hotspot analysis enabled${NC}"
fi

echo ""
echo "${BLUE}Configuration:${NC}"
echo "  Hotspot Window: ${CYAN}${HOTSPOT_WINDOW} days${NC}"
echo "  Top Hotspots: ${CYAN}${TOP_HOTSPOTS}${NC}"
if [ -f "$CONFIG_FILE" ]; then
    echo "  Config File: ${CYAN}${CONFIG_FILE}${NC}"
fi
echo ""

# Run hotspot-focused analysis
echo "${BLUE}Running hotspot analysis...${NC}"
echo "${CYAN}This identifies files that are BOTH complex AND frequently changed.${NC}"
echo ""

if [ "$USE_HOTSPOTS" = true ]; then
    # Hotspot analysis (default - this is the core value)
    # Note: Tool may output errors to stderr but still succeed
    OUTPUT=$(mktemp)
    ERROR_OUTPUT=$(mktemp)
    
    if $SOFTWARE_ENTROPY_CMD . \
        --config "$CONFIG_FILE" \
        --hotspot-window "$HOTSPOT_WINDOW" \
        --top-hotspots "$TOP_HOTSPOTS" \
        --output "${OUTPUT_FILE:-code-quality-report.json}" \
        > "$OUTPUT" 2> "$ERROR_OUTPUT"; then
        cat "$OUTPUT"
        # Show errors if any (but don't fail)
        if [ -s "$ERROR_OUTPUT" ]; then
            echo ""
            echo "${YELLOW}⚠ Warnings (non-critical):${NC}"
            cat "$ERROR_OUTPUT" | head -5
        fi
        rm -f "$OUTPUT" "$ERROR_OUTPUT"
        echo ""
        echo "${GREEN}✅ Hotspot analysis complete!${NC}"
        echo ""
        echo "${CYAN}💡 Next Steps:${NC}"
        echo "  1. Review the top ${TOP_HOTSPOTS} hotspots above"
        echo "  2. Start with the highest-scoring files (complexity × churn)"
        echo "  3. Refactor complex functions in these files"
        echo "  4. Add tests before refactoring"
        echo ""
        exit 0
    else
        # Show output even if command failed
        cat "$OUTPUT" 2>/dev/null || true
        cat "$ERROR_OUTPUT" 2>/dev/null || true
        rm -f "$OUTPUT" "$ERROR_OUTPUT"
        echo ""
        echo "${RED}✗ Hotspot analysis failed${NC}"
        exit 1
    fi
else
    # Fallback: Traditional scan without hotspots
    echo "${YELLOW}Running traditional scan (no hotspots - git required)...${NC}"
    OUTPUT=$(mktemp)
    ERROR_OUTPUT=$(mktemp)
    
    if $SOFTWARE_ENTROPY_CMD . \
        --config "$CONFIG_FILE" \
        --no-hotspots \
        --output "${OUTPUT_FILE:-code-quality-report.json}" \
        > "$OUTPUT" 2> "$ERROR_OUTPUT"; then
        cat "$OUTPUT"
        if [ -s "$ERROR_OUTPUT" ]; then
            echo ""
            echo "${YELLOW}⚠ Warnings:${NC}"
            cat "$ERROR_OUTPUT" | head -5
        fi
        rm -f "$OUTPUT" "$ERROR_OUTPUT"
        echo ""
        echo "${GREEN}✅ Code quality scan complete!${NC}"
        exit 0
    else
        cat "$OUTPUT" 2>/dev/null || true
        cat "$ERROR_OUTPUT" 2>/dev/null || true
        rm -f "$OUTPUT" "$ERROR_OUTPUT"
        echo ""
        echo "${RED}✗ Code quality scan failed${NC}"
        exit 1
    fi
fi

