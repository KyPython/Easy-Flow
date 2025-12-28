#!/usr/bin/env bash
# Ship Ready Features to Production
# Assesses feature readiness and ships ready features to production
# Can be run standalone or integrated into CI/CD
# Cross-platform compatible (macOS, Linux, Windows with Git Bash/WSL)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

FEATURES_DIR=".features"
FEATURES_MANIFEST="${FEATURES_DIR}/features.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

echo "${BLUE}=== 🚀 Ship Ready Features to Production ===${NC}\n"

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "${RED}✗ Not in a git repository${NC}"
    exit 1
fi

# Check if jq is available (cross-platform)
if ! command -v jq >/dev/null 2>&1; then
    echo "${YELLOW}⚠️  jq is not installed.${NC}"
    echo "${BLUE}Please install jq:${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  macOS: ${CYAN}brew install jq${NC}"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  Linux: ${CYAN}sudo apt-get install jq${NC} (Debian/Ubuntu)"
        echo "         ${CYAN}sudo yum install jq${NC} (RHEL/CentOS)"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "  Windows: ${CYAN}choco install jq${NC} (Chocolatey)"
        echo "           ${CYAN}scoop install jq${NC} (Scoop)"
        echo "           Or download from: https://stedolan.github.io/jq/download/"
    else
        echo "  Download from: https://stedolan.github.io/jq/download/"
    fi
    exit 1
fi

# Step 1: Run feature readiness assessment
echo "${BLUE}Step 1: Assessing feature readiness...${NC}\n"
if [ -f "$SCRIPT_DIR/assess-feature-readiness.sh" ]; then
    chmod +x "$SCRIPT_DIR/assess-feature-readiness.sh"
    "$SCRIPT_DIR/assess-feature-readiness.sh" || {
        echo "${YELLOW}⚠️  Assessment completed with warnings${NC}"
    }
else
    echo "${RED}✗ assess-feature-readiness.sh not found${NC}"
    exit 1
fi

# Step 2: Read ready features from manifest
echo "\n${BLUE}Step 2: Reading ready features from manifest...${NC}"

if [ ! -f "$FEATURES_MANIFEST" ]; then
    echo "${YELLOW}⚠️  No features manifest found. No features to ship.${NC}"
    exit 0
fi

# Get ready features
READY_FEATURES=$(jq -r '.[] | select(.status == "ready") | .name' "$FEATURES_MANIFEST" 2>/dev/null || echo "")

if [ -z "$READY_FEATURES" ]; then
    echo "${YELLOW}⚠️  No features are ready for production.${NC}"
    echo "${BLUE}Run ${CYAN}npm run assess:features${NC} to check feature status.${NC}"
    exit 0
fi

# Convert to array (cross-platform compatible)
if [ -n "$READY_FEATURES" ]; then
    # Use readarray if available (bash 4+), otherwise use while loop
    if command -v readarray >/dev/null 2>&1 || type readarray >/dev/null 2>&1; then
        readarray -t READY_FEATURES_ARRAY <<< "$READY_FEATURES"
    else
        # Fallback for older bash versions
        READY_FEATURES_ARRAY=()
        while IFS= read -r line; do
            [ -n "$line" ] && READY_FEATURES_ARRAY+=("$line")
        done <<< "$READY_FEATURES"
    fi
else
    READY_FEATURES_ARRAY=()
fi

echo "${GREEN}✅ Found ${#READY_FEATURES_ARRAY[@]} ready feature(s):${NC}"
for feature in "${READY_FEATURES_ARRAY[@]}"; do
    if [ -n "$feature" ]; then
        COMMIT=$(jq -r ".[] | select(.name == \"$feature\") | .commit" "$FEATURES_MANIFEST" 2>/dev/null || echo "unknown")
        echo "  - ${CYAN}$feature${NC} (commit: $COMMIT)"
    fi
done

# Step 3: Confirm shipping
echo "\n${BLUE}Step 3: Confirmation${NC}"
if [ "${CI:-false}" = "true" ] || [ "${AUTO_SHIP:-false}" = "true" ]; then
    echo "${GREEN}✓ CI mode: Auto-shipping ready features${NC}"
    CONFIRM="y"
else
    echo "${YELLOW}Ready to ship ${#READY_FEATURES_ARRAY[@]} feature(s) to production.${NC}"
    echo "${BLUE}This will:${NC}"
    echo "  1. Merge dev → main"
    echo "  2. Run validation checks"
    echo "  3. Push to main (triggers production deployment)"
    echo ""
    # Cross-platform read (works in Git Bash, WSL, macOS, Linux)
    if [ -t 0 ]; then
        read -p "Continue? (y/N): " CONFIRM
    else
        # Non-interactive mode
        CONFIRM="n"
    fi
fi

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "${YELLOW}Shipping cancelled.${NC}"
    exit 0
fi

# Step 4: Ship to production using existing script
echo "\n${BLUE}Step 4: Shipping to production...${NC}"
if [ -f "$SCRIPT_DIR/ship-to-production.sh" ]; then
    chmod +x "$SCRIPT_DIR/ship-to-production.sh"
    "$SCRIPT_DIR/ship-to-production.sh" || {
        echo "${RED}✗ Shipping failed. Features remain ready but not shipped.${NC}"
        exit 1
    }
else
    echo "${RED}✗ ship-to-production.sh not found${NC}"
    exit 1
fi

# Step 5: Update manifest with shipped status
echo "\n${BLUE}Step 5: Updating feature manifest...${NC}"

SHIPPED_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
for feature in "${READY_FEATURES_ARRAY[@]}"; do
    if [ -n "$feature" ]; then
        # Update feature status to shipped
        jq "map(if .name == \"$feature\" then .status = \"shipped\" | .date_shipped = \"$SHIPPED_DATE\" else . end)" \
            "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && \
            mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
        echo "  ${GREEN}✓ Marked '$feature' as shipped${NC}"
    fi
done

# Step 6: Generate shipping report
REPORT_FILE="${FEATURES_DIR}/shipping-report-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "Feature Shipping Report"
    echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo ""
    echo "Shipped Features: ${#READY_FEATURES_ARRAY[@]}"
    for feature in "${READY_FEATURES_ARRAY[@]}"; do
        if [ -n "$feature" ]; then
            COMMIT=$(jq -r ".[] | select(.name == \"$feature\") | .commit" "$FEATURES_MANIFEST" 2>/dev/null || echo "unknown")
            echo "  - $feature (commit: $COMMIT)"
        fi
    done
} > "$REPORT_FILE"

echo "\n${GREEN}✅ Successfully shipped ${#READY_FEATURES_ARRAY[@]} feature(s) to production!${NC}"
echo "${BLUE}Shipping report: ${CYAN}$REPORT_FILE${NC}"
echo "${BLUE}Manifest updated: ${CYAN}$FEATURES_MANIFEST${NC}\n"

echo "${GREEN}🎉 Features are now in production!${NC}"

