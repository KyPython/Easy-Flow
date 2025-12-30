#!/usr/bin/env bash
# Feature Readiness Assessment Script
# Analyzes features in dev branch to determine production readiness

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
CHANGELOG="CHANGELOG.md"

echo "${BLUE}=== 🔍 Assessing Feature Readiness ===${NC}\n"

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "${RED}✗ Not in a git repository${NC}"
    exit 1
fi

# Create features directory if it doesn't exist (cross-platform)
mkdir -p "$FEATURES_DIR" 2>/dev/null || {
    # Fallback for systems where mkdir -p might fail
    if [ ! -d "$FEATURES_DIR" ]; then
        mkdir "$FEATURES_DIR" 2>/dev/null || {
            echo "${RED}✗ Failed to create features directory${NC}"
            exit 1
        }
    fi
}

# Initialize features manifest if it doesn't exist
if [ ! -f "$FEATURES_MANIFEST" ]; then
    echo "[]" > "$FEATURES_MANIFEST"
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null | sed 's/[^a-zA-Z0-9._-]//g')
if [ -z "$CURRENT_BRANCH" ]; then
    echo "${RED}✗ Could not determine current branch${NC}"
    exit 1
fi

echo "${BLUE}Current branch: ${CYAN}$CURRENT_BRANCH${NC}\n"

# Get commits since last production release (main branch)
if git rev-parse --verify main >/dev/null 2>&1; then
    LAST_RELEASE=$(git merge-base "$CURRENT_BRANCH" main 2>/dev/null || echo "")
    if [ -n "$LAST_RELEASE" ]; then
        COMMITS_SINCE_RELEASE=$(git log --oneline "$LAST_RELEASE".."$CURRENT_BRANCH" 2>/dev/null | wc -l | tr -d ' ')
        echo "${BLUE}Commits since last release: ${CYAN}$COMMITS_SINCE_RELEASE${NC}\n"
    fi
fi

# Extract features from commit messages
echo "${BLUE}Extracting features from commit messages...${NC}"
FEATURE_COMMITS=$(git log --oneline --grep="feat:" --grep="feature:" -i --since="30 days ago" 2>/dev/null || echo "")

if [ -z "$FEATURE_COMMITS" ]; then
    echo "${YELLOW}⚠️  No feature commits found in last 30 days${NC}"
    echo "${BLUE}Checking all commits on current branch...${NC}"
    FEATURE_COMMITS=$(git log --oneline --grep="feat:" --grep="feature:" -i 2>/dev/null || echo "")
fi

# Function to check if feature has tests
check_feature_tests() {
    local feature_name="$1"
    local feature_files="$2"
    
    # Check if any test files exist for this feature
    local has_tests=false
    
    # Look for test files that might relate to this feature
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            # Check for corresponding test files
            local base_name=$(basename "$file" | sed 's/\.[^.]*$//')
            local dir=$(dirname "$file")
            
            # Look for test files
            if find "$dir" -name "*test*" -o -name "*spec*" 2>/dev/null | grep -q .; then
                has_tests=true
                break
            fi
        fi
    done <<< "$feature_files"
    
    echo "$has_tests"
}

# Function to check if feature passes validation
check_feature_validation() {
    local feature_name="$1"
    
    # Run quick validation checks
    local validation_passed=true
    
    # Check if code quality passes
    if ! ./scripts/code-quality-check.sh >/dev/null 2>&1; then
        validation_passed=false
    fi
    
    echo "$validation_passed"
}

# Parse features from commits (using temp file for cross-platform compatibility)
# Cross-platform temp file creation
if command -v mktemp >/dev/null 2>&1; then
    TEMP_FEATURES_FILE=$(mktemp)
elif [ -n "$TMPDIR" ]; then
    TEMP_FEATURES_FILE="$TMPDIR/features_$$.tmp"
elif [ -n "$TEMP" ]; then
    TEMP_FEATURES_FILE="$TEMP/features_$$.tmp"
else
    TEMP_FEATURES_FILE="/tmp/features_$$.tmp"
fi
trap "rm -f $TEMP_FEATURES_FILE" EXIT INT TERM

while IFS= read -r commit; do
    if [ -z "$commit" ]; then
        continue
    fi
    
    COMMIT_HASH=$(echo "$commit" | cut -d' ' -f1)
    COMMIT_MSG=$(echo "$commit" | cut -d' ' -f2-)
    
    # Extract feature name from commit message
    FEATURE_NAME=$(echo "$COMMIT_MSG" | sed -n 's/.*[Ff]eat[ure]*[:]\s*\([^:]*\).*/\1/p' | head -1 | xargs)
    
    if [ -z "$FEATURE_NAME" ]; then
        # Try to extract from commit message more broadly
        FEATURE_NAME=$(echo "$COMMIT_MSG" | sed 's/^[^:]*:\s*//' | head -c 50 | xargs)
    fi
    
    if [ -n "$FEATURE_NAME" ] && [ -n "$COMMIT_HASH" ]; then
        # Get files changed in this commit
        FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r "$COMMIT_HASH" 2>/dev/null || echo "")
        
        # Store in temp file: feature_name|commit_hash|files_changed
        echo "${FEATURE_NAME}|${COMMIT_HASH}|${FILES_CHANGED}" >> "$TEMP_FEATURES_FILE"
    fi
done <<< "$FEATURE_COMMITS"

# Assess each feature
echo "${BLUE}Assessing features...${NC}\n"

READY_FEATURES=()
NOT_READY_FEATURES=()

# Process features from temp file
while IFS='|' read -r feature_name commit_hash files_changed; do
    if [ -z "$feature_name" ]; then
        continue
    fi
    
    echo "${CYAN}Assessing: ${BLUE}$feature_name${NC}"
    echo "  Commit: $commit_hash"
    
    # Check tests
    HAS_TESTS=$(check_feature_tests "$feature_name" "$files_changed")
    
    # Check validation
    VALIDATION_PASSED=$(check_feature_validation "$feature_name")
    
    # Determine readiness
    READY=true
    REASONS=()
    
    if [ "$HAS_TESTS" = "false" ]; then
        READY=false
        REASONS+=("no tests found")
    fi
    
    if [ "$VALIDATION_PASSED" = "false" ]; then
        READY=false
        REASONS+=("validation failed")
    fi
    
    # Check if feature is already in manifest
    FEATURE_EXISTS=$(jq -r ".[] | select(.name == \"$feature_name\") | .name" "$FEATURES_MANIFEST" 2>/dev/null || echo "")
    
    if [ -z "$FEATURE_EXISTS" ]; then
        # Add new feature to manifest
        FEATURE_JSON=$(jq -n \
            --arg name "$feature_name" \
            --arg commit "$commit_hash" \
            --arg status "draft" \
            --arg has_tests "$HAS_TESTS" \
            --arg validation_passed "$VALIDATION_PASSED" \
            --arg date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
            '{name: $name, commit: $commit, status: $status, has_tests: ($has_tests == "true"), validation_passed: ($validation_passed == "true"), date_created: $date, date_ready: null, date_shipped: null, reasons: []}' 2>/dev/null || echo "{}")
        
        if command -v jq >/dev/null 2>&1; then
            jq ". += [$FEATURE_JSON]" "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
        fi
    else
        # Update existing feature
        if command -v jq >/dev/null 2>&1; then
            jq "map(if .name == \"$feature_name\" then .has_tests = ($HAS_TESTS == \"true\") | .validation_passed = ($VALIDATION_PASSED == \"true\") else . end)" "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
        fi
    fi
    
    if [ "$READY" = "true" ]; then
        echo "  ${GREEN}✓ Ready for production${NC}"
        READY_FEATURES+=("$feature_name")
        
        # Update status to ready
        if command -v jq >/dev/null 2>&1; then
            jq "map(if .name == \"$feature_name\" then .status = \"ready\" | .date_ready = \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\" else . end)" "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
        fi
    else
        echo "  ${YELLOW}⚠ Not ready: ${REASONS[*]}${NC}"
        NOT_READY_FEATURES+=("$feature_name")
    fi
    
    echo ""
done < "$TEMP_FEATURES_FILE"

# Summary
echo "${BLUE}=== 📊 Summary ===${NC}\n"

if [ ${#READY_FEATURES[@]} -gt 0 ]; then
    echo "${GREEN}✅ Ready for Production (${#READY_FEATURES[@]}):${NC}"
    for feature in "${READY_FEATURES[@]}"; do
        echo "  - $feature"
    done
    echo ""
fi

if [ ${#NOT_READY_FEATURES[@]} -gt 0 ]; then
    echo "${YELLOW}⚠️  Not Ready (${#NOT_READY_FEATURES[@]}):${NC}"
    for feature in "${NOT_READY_FEATURES[@]}"; do
        echo "  - $feature"
    done
    echo ""
fi

# Generate report
REPORT_FILE="${FEATURES_DIR}/readiness-report.txt"
{
    echo "Feature Readiness Report"
    echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Branch: $CURRENT_BRANCH"
    echo ""
    echo "Ready for Production: ${#READY_FEATURES[@]}"
    for feature in "${READY_FEATURES[@]}"; do
        echo "  - $feature"
    done
    echo ""
    echo "Not Ready: ${#NOT_READY_FEATURES[@]}"
    for feature in "${NOT_READY_FEATURES[@]}"; do
        echo "  - $feature"
    done
} > "$REPORT_FILE"

echo "${BLUE}Report saved to: ${CYAN}$REPORT_FILE${NC}"
echo "${BLUE}Manifest updated: ${CYAN}$FEATURES_MANIFEST${NC}\n"

if [ ${#READY_FEATURES[@]} -gt 0 ]; then
    echo "${GREEN}🎉 You have ${#READY_FEATURES[@]} feature(s) ready to ship!${NC}"
    echo "${BLUE}Run: ${CYAN}npm run ship:features${NC} to ship them to production"
    exit 0
else
    echo "${YELLOW}No features are ready for production yet.${NC}"
    echo "${BLUE}Assessment completed successfully.${NC}"
    exit 0
fi

