#!/bin/bash
# Single Responsibility Principle (SRP) Validation
# Checks files, methods, functions, and documentation for SRP compliance
# In PR context: only checks files changed in the PR (don't fail on pre-existing issues)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Single Responsibility Principle (SRP) Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Configuration
MAX_FUNCTIONS_PER_FILE=20
MAX_METHODS_PER_CLASS=15
MAX_LINES_PER_FUNCTION=100
MAX_LINES_PER_FILE=1000
MAX_TOPICS_PER_DOC=100  # Comprehensive docs naturally have many sections

# In PR context, only check changed files (don't fail on pre-existing technical debt)
CHANGED_FILES_ONLY=false
CHANGED_FILES=""
if [ -n "$GITHUB_EVENT_NAME" ] && [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
  CHANGED_FILES_ONLY=true
  # Get list of changed files in the PR
  if [ -n "$GITHUB_BASE_REF" ]; then
    # Fetch base branch if needed
    git fetch origin "$GITHUB_BASE_REF" --depth=1 2>/dev/null || true
    CHANGED_FILES=$(git diff --name-only "origin/$GITHUB_BASE_REF"...HEAD 2>/dev/null || echo "")
  fi
  if [ -n "$CHANGED_FILES" ]; then
    echo "${CYAN}ℹ️  PR mode: Only checking files changed in this PR${NC}"
    echo "${CYAN}   Changed files: $(echo "$CHANGED_FILES" | wc -l | tr -d ' ')${NC}\n"
  else
    echo "${YELLOW}⚠️  Could not determine changed files, checking all${NC}\n"
    CHANGED_FILES_ONLY=false
  fi
fi

# Helper function to check if file is in changed files list
is_changed_file() {
  local file="$1"
  if [ "$CHANGED_FILES_ONLY" = false ]; then
    return 0  # Check all files
  fi
  echo "$CHANGED_FILES" | grep -q "^$file$" && return 0
  return 1
}

# Directories to check
CODE_DIRS=(
    "rpa-system/backend"
    "rpa-system/rpa-dashboard/src"
    "rpa-system/automation/automation-service"
)

DOC_DIRS=(
    "docs"
)

echo "${BLUE}Checking code files for SRP violations...${NC}\n"

# Function to check a single file
check_file_srp() {
    local file="$1"
    local violations=0
    
    # Skip test files and generated files
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *"build"* ]]; then
        return 0
    fi
    
    # Count functions/methods in file
    if [[ "$file" == *.js ]] || [[ "$file" == *.jsx ]] || [[ "$file" == *.ts ]] || [[ "$file" == *.tsx ]]; then
        local func_count=$(grep -E "^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(|^\s*(export\s+)?class\s+\w+|^\s*\w+\s*:\s*(async\s+)?\(|^\s*(public|private|protected)\s+(async\s+)?\w+\s*\(" "$file" 2>/dev/null | wc -l || echo "0")
        local line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
        
        # Check for too many functions (indicates multiple responsibilities)
        if [ "$func_count" -gt "$MAX_FUNCTIONS_PER_FILE" ]; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Too many functions: ${func_count} (max: ${MAX_FUNCTIONS_PER_FILE})${NC}"
            echo "    ${CYAN}   Recommendation: Split into smaller, focused modules${NC}"
            violations=$((violations + 1))
        fi
        
        # Check for too many lines (indicates multiple responsibilities)
        if [ "$line_count" -gt "$MAX_LINES_PER_FILE" ]; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Too many lines: ${line_count} (max: ${MAX_LINES_PER_FILE})${NC}"
            echo "    ${CYAN}   Recommendation: Break into smaller files with single responsibilities${NC}"
            violations=$((violations + 1))
        fi
        
        # Check for long functions (indicates multiple responsibilities within function)
        local long_functions=$(awk '
            /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(|^\s*\w+\s*:\s*(async\s+)?\(/ {
                start = NR
                brace_count = 0
                in_function = 1
            }
            in_function {
                brace_count += gsub(/{/, "")
                brace_count -= gsub(/}/, "")
                if (brace_count == 0 && NR > start) {
                    func_lines = NR - start
                    if (func_lines > '$MAX_LINES_PER_FUNCTION') {
                        print start ":" func_lines
                    }
                    in_function = 0
                }
            }
        ' "$file" 2>/dev/null || echo "")
        
        if [ -n "$long_functions" ]; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Long functions detected (exceeding ${MAX_LINES_PER_FUNCTION} lines)${NC}"
            echo "    ${CYAN}   Recommendation: Extract logic into smaller, focused functions${NC}"
            violations=$((violations + 1))
        fi
    fi
    
    # Check Python files
    if [[ "$file" == *.py ]]; then
        local func_count=$(grep -E "^\s*def\s+\w+|^\s*class\s+\w+" "$file" 2>/dev/null | wc -l || echo "0")
        local class_count=$(grep -E "^\s*class\s+\w+" "$file" 2>/dev/null | wc -l || echo "0")
        local line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
        
        if [ "$func_count" -gt "$MAX_FUNCTIONS_PER_FILE" ]; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Too many functions: ${func_count} (max: ${MAX_FUNCTIONS_PER_FILE})${NC}"
            violations=$((violations + 1))
        fi
        
        if [ "$line_count" -gt "$MAX_LINES_PER_FILE" ]; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Too many lines: ${line_count} (max: ${MAX_LINES_PER_FILE})${NC}"
            violations=$((violations + 1))
        fi
        
        # Check classes for too many methods
        if [ "$class_count" -gt 0 ]; then
            local methods_in_class=$(grep -E "^\s*def\s+\w+" "$file" 2>/dev/null | wc -l || echo "0")
            if [ "$methods_in_class" -gt "$MAX_METHODS_PER_CLASS" ]; then
                echo "  ${YELLOW}⚠ ${file}${NC}"
                echo "    ${RED}✗ Too many methods in class: ${methods_in_class} (max: ${MAX_METHODS_PER_CLASS})${NC}"
                violations=$((violations + 1))
            fi
        fi
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Check documentation files for SRP
check_doc_srp() {
    local file="$1"
    
    if [[ "$file" != *.md ]]; then
        return 0
    fi
    
    # Count distinct topics/sections (indicates multiple responsibilities)
    local topic_count=$(grep -E "^#+\s+" "$file" 2>/dev/null | wc -l || echo "0")
    
    if [ "$topic_count" -gt "$MAX_TOPICS_PER_DOC" ]; then
        if [ "$PERMISSIVE_DOC_MODE" = true ]; then
            # Just warn on feature branches, don't fail
            echo "  ${YELLOW}⚠ ${file} - ${topic_count} topics (warning only)${NC}"
        else
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Too many topics: ${topic_count} (max: ${MAX_TOPICS_PER_DOC})${NC}"
            echo "    ${CYAN}   Recommendation: Split into multiple focused documentation files${NC}"
            TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
            FAILED=$((FAILED + 1))
        fi
    fi
}

# Scan code directories
for dir in "${CODE_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    
    echo "${BLUE}Scanning ${dir}...${NC}"
    while IFS= read -r -d '' file; do
        # In PR mode, skip files not changed in this PR
        if [ "$CHANGED_FILES_ONLY" = true ]; then
            if ! echo "$CHANGED_FILES" | grep -q "^${file}$"; then
                continue
            fi
        fi
        check_file_srp "$file" || FAILED=$((FAILED + 1))
    done < <(find "$dir" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/__pycache__/*" \
        ! -name "*.test.js" \
        ! -name "*.spec.js" \
        -print0 2>/dev/null)
done

# Scan documentation (exclude node_modules and third-party docs)
echo "\n${BLUE}Checking documentation files for SRP violations...${NC}\n"
for dir in "${DOC_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    
    while IFS= read -r -d '' file; do
        # Skip node_modules and third-party documentation
        if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"CHANGELOG"* ]]; then
            continue
        fi
        # In PR mode, skip docs not changed in this PR
        if [ "$CHANGED_FILES_ONLY" = true ]; then
            if ! echo "$CHANGED_FILES" | grep -q "^${file}$"; then
                continue
            fi
        fi
        check_doc_srp "$file"
    done < <(find "$dir" -type f -name "*.md" \
        ! -path "*/node_modules/*" \
        ! -name "CHANGELOG.md" \
        -print0 2>/dev/null)
done

# Summary
echo "\n${BLUE}=== SRP Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ No SRP violations found!${NC}"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} SRP violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Split large files into smaller, focused modules"
    echo "  2. Extract long functions into smaller, single-purpose functions"
    echo "  3. Break large classes into smaller, focused classes"
    echo "  4. Split documentation with multiple topics into separate files"
    echo ""
    exit 1
fi

