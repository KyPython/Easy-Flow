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

# Count features found
FEATURE_COUNT=$(echo "$FEATURE_COMMITS" | grep -v '^$' | wc -l | tr -d ' ')
if [ "$FEATURE_COUNT" -gt 0 ]; then
    echo "${GREEN}Found ${FEATURE_COUNT} feature commit(s)${NC}\n"
else
    echo "${YELLOW}No feature commits found${NC}\n"
fi

# Function to check if feature has tests
check_feature_tests() {
    local feature_name="$1"
    local feature_files="$2"
    
    # Check if any test files exist for this feature
    local has_tests=false

    # Normalize the feature file list:
    # - stored as semicolon-separated paths in the temp file
    # - but we want to iterate one path per line
    local normalized_files
    normalized_files=$(echo "$feature_files" | tr ';' '\n')

    # If the commit only touched non-runtime assets (docs/config/workflows),
    # don't block readiness on "tests".
    local requires_tests=false
    while IFS= read -r file; do
        if [ -z "$file" ]; then
            continue
        fi
        case "$file" in
            *.md|*.txt|*.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico|*.pdf) ;;
            *.yml|*.yaml|*.json|*.toml|*.ini|*.env|*.example|*.lock) ;;
            .github/workflows/*) ;;
            docs/*) ;;
            *)
                requires_tests=true
                break
                ;;
        esac
    done <<< "$normalized_files"
    if [ "$requires_tests" = "false" ]; then
        echo "true"
        return 0
    fi
    
    # Look for test files that might relate to this feature
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            # Check for corresponding test files
            local base_name=$(basename "$file" | sed 's/\.[^.]*$//')
            local dir=$(dirname "$file")
            
            # Look for test files
            if find "$dir" -maxdepth 5 -type f \( -name "*test*" -o -name "*spec*" \) 2>/dev/null | grep -q .; then
                has_tests=true
                break
            fi

            # Also consider the commit as having tests if it directly includes test/spec files.
            if echo "$file" | grep -qiE '(test|spec)'; then
                has_tests=true
                break
            fi

            # Heuristic: if this change is within a known subproject, look for tests within that subproject root.
            # This avoids "false negatives" when tests live in centralized `tests/` dirs.
            case "$file" in
                rpa-system/backend/*)
                    if find "rpa-system/backend" -maxdepth 6 -type f \( -name "*test*" -o -name "*spec*" \) 2>/dev/null | grep -q .; then
                        has_tests=true
                        break
                    fi
                    ;;
                rpa-system/rpa-dashboard/*)
                    if find "rpa-system/rpa-dashboard" -maxdepth 6 -type f \( -name "*test*" -o -name "*spec*" \) 2>/dev/null | grep -q .; then
                        has_tests=true
                        break
                    fi
                    ;;
                easyflow-metrics/*)
                    if find "easyflow-metrics" -maxdepth 6 -type f \( -name "test_*.py" -o -name "*_test.py" -o -name "*test*" -o -name "*spec*" \) 2>/dev/null | grep -q .; then
                        has_tests=true
                        break
                    fi
                    ;;
            esac
        fi
    done <<< "$normalized_files"
    
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

# Track unique features to avoid duplicates (using temp file for cross-platform compatibility)
SEEN_FEATURES_FILE="${TEMP_FEATURES_FILE}.seen"
touch "$SEEN_FEATURES_FILE"
trap "rm -f $SEEN_FEATURES_FILE" EXIT INT TERM

while IFS= read -r commit; do
    if [ -z "$commit" ]; then
        continue
    fi
    
    COMMIT_HASH=$(echo "$commit" | awk '{print $1}')
    COMMIT_MSG=$(echo "$commit" | cut -d' ' -f2-)
    
    # Extract feature name from commit message (after "feat:" or "feature:")
    # Remove "feat:" or "feature:" prefix and clean up
    FEATURE_NAME=$(echo "$COMMIT_MSG" | sed -E 's/.*[Ff]eat[ure]*:\s*//' | sed 's/;.*$//' | sed 's/\s*$//' | head -c 100)
    FEATURE_NAME=$(echo "$FEATURE_NAME" | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Skip if feature name is empty or too short
    if [ -z "$FEATURE_NAME" ] || [ ${#FEATURE_NAME} -lt 5 ]; then
        continue
    fi
    
    # Skip file paths (check for common patterns)
    if echo "$FEATURE_NAME" | grep -qE '^[./]|\.(js|ts|jsx|tsx|py|sh|yml|yaml|json|md|css)$|^[a-z]+/[a-z]+/|^[a-z]+\.[a-z]+$'; then
        continue
    fi
    
    # Skip if we've already seen this feature (deduplicate)
    FEATURE_KEY=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
    if grep -q "^${FEATURE_KEY}$" "$SEEN_FEATURES_FILE" 2>/dev/null; then
        continue
    fi
    echo "$FEATURE_KEY" >> "$SEEN_FEATURES_FILE"
    
    if [ -n "$FEATURE_NAME" ] && [ -n "$COMMIT_HASH" ]; then
        # Get files changed in this commit (replace newlines with semicolons to avoid parsing issues)
        FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r "$COMMIT_HASH" 2>/dev/null | tr '\n' ';' | sed 's/;$//' || echo "")
        
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
    FEATURE_EXISTS=$(jq -r --arg feature_name "$feature_name" '.[] | select(.name == $feature_name) | .name' "$FEATURES_MANIFEST" 2>/dev/null || echo "")
    
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
            jq --arg feature_name "$feature_name" \
               --argjson has_tests "$HAS_TESTS" \
               --argjson validation_passed "$VALIDATION_PASSED" \
               'map(if .name == $feature_name then .has_tests = $has_tests | .validation_passed = $validation_passed else . end)' \
               "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
        fi
    fi
    
    if [ "$READY" = "true" ]; then
        echo "  ${GREEN}✓ Ready for production${NC}"
        READY_FEATURES+=("$feature_name")
        
        # Update status to ready
        if command -v jq >/dev/null 2>&1; then
            jq --arg feature_name "$feature_name" \
               --arg date_ready "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
               'map(if .name == $feature_name then .status = "ready" | .date_ready = $date_ready else . end)' \
               "$FEATURES_MANIFEST" > "${FEATURES_MANIFEST}.tmp" && mv "${FEATURES_MANIFEST}.tmp" "$FEATURES_MANIFEST"
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
    echo "Total Features Assessed: $(jq 'length' "$FEATURES_MANIFEST" 2>/dev/null || echo "0")"
    echo ""
    echo "Ready for Production: ${#READY_FEATURES[@]}"
    if [ ${#READY_FEATURES[@]} -gt 0 ]; then
        for feature in "${READY_FEATURES[@]}"; do
            echo "  - $feature"
        done
    else
        echo "  (none)"
    fi
    echo ""
    echo "Not Ready: ${#NOT_READY_FEATURES[@]}"
    if [ ${#NOT_READY_FEATURES[@]} -gt 0 ]; then
        for feature in "${NOT_READY_FEATURES[@]}"; do
            echo "  - $feature"
        done
    else
        echo "  (none)"
    fi
    echo ""
    echo "All Features:"
    jq -r '.[] | "  - \(.name) [\(.status)] - Tests: \(.has_tests), Validation: \(.validation_passed)"' "$FEATURES_MANIFEST" 2>/dev/null || echo "  (unable to parse manifest)"
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

