#!/bin/bash
# Validate Duplicate CI/CD Workflows Detection
# Checks for duplicate workflow files, duplicate step patterns, and duplicate job names

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== Duplicate CI/CD Workflows Detection ===${NC}\n"

ERRORS=0
WARNINGS=0
WORKFLOWS_DIR=".github/workflows"

if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo -e "${YELLOW}⚠ Workflows directory not found: $WORKFLOWS_DIR${NC}"
    exit 0
fi

# 1. Check for duplicate workflow file names (should never happen, but check anyway)
echo -e "${CYAN}1. Checking for duplicate workflow file names...${NC}"
WORKFLOW_FILES=$(find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" 2>/dev/null | sort)
DUPLICATE_NAMES=$(echo "$WORKFLOW_FILES" | xargs -n1 basename | sort | uniq -d)

if [ -n "$DUPLICATE_NAMES" ]; then
    echo -e "${RED}✗ Duplicate workflow file names found:${NC}"
    echo "$DUPLICATE_NAMES" | while read name; do
        echo -e "  ${YELLOW}$name${NC}"
        find "$WORKFLOWS_DIR" -name "$name" | while read file; do
            echo -e "    → $file"
        done
    done
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ No duplicate workflow file names${NC}"
fi

echo ""

# 2. Check for duplicate job names within the same workflow file
echo -e "${CYAN}2. Checking for duplicate job names within workflow files...${NC}"

find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" | while read workflow_file; do
    if [ ! -f "$workflow_file" ]; then
        continue
    fi
    
    # Extract job names (jobs: section, then job names)
    JOB_NAMES=$(grep -E "^\s+[a-zA-Z0-9_-]+:\s*$" "$workflow_file" 2>/dev/null | \
        sed 's/^[[:space:]]*//;s/[[:space:]]*:$//' | \
        awk '/^jobs:/{flag=1; next} /^[a-zA-Z]/ && !/^[[:space:]]/ && flag==1 {flag=0} flag==1')
    
    # Also check for job names after "jobs:" line
    if grep -q "^jobs:" "$workflow_file" 2>/dev/null; then
        JOB_NAMES=$(awk '/^jobs:/{flag=1; next} /^[a-zA-Z]/ && !/^[[:space:]]/ && flag==1 {flag=0} flag==1 {if (NF==1 && $0 ~ /^[a-zA-Z0-9_-]+:$/) {gsub(/:/, "", $0); print $0}}' "$workflow_file" 2>/dev/null || \
            grep -A 100 "^jobs:" "$workflow_file" 2>/dev/null | \
            grep -E "^\s+[a-zA-Z0-9_-]+:\s*$" | \
            sed 's/^[[:space:]]*//;s/[[:space:]]*:$//' | head -20)
    fi
    
    if [ -n "$JOB_NAMES" ]; then
        DUPLICATE_JOBS=$(echo "$JOB_NAMES" | sort | uniq -d)
        if [ -n "$DUPLICATE_JOBS" ]; then
            echo -e "${RED}✗ Duplicate job names in ${workflow_file}:${NC}"
            echo "$DUPLICATE_JOBS" | while read job; do
                echo -e "  ${YELLOW}$job${NC}"
            done
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ No duplicate job names found${NC}"
fi

echo ""

# 3. Check for duplicate workflow triggers (same trigger pattern in multiple files)
echo -e "${CYAN}3. Checking for duplicate workflow triggers...${NC}"

TRIGGER_FILE=$(mktemp)
find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" | while read workflow_file; do
    if [ ! -f "$workflow_file" ]; then
        continue
    fi
    
    # Extract workflow name and trigger patterns
    WORKFLOW_NAME=$(grep -E "^name:" "$workflow_file" 2>/dev/null | head -1 | sed 's/name://;s/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Extract on: triggers (branches, paths, etc.)
    if grep -q "^on:" "$workflow_file" 2>/dev/null; then
        # Get branches
        BRANCHES=$(grep -A 20 "^on:" "$workflow_file" 2>/dev/null | \
            grep -E "^\s*branches:" | head -1 | \
            sed 's/.*branches:[[:space:]]*\[\(.*\)\].*/\1/' | \
            sed 's/[[:space:]]*//g' | tr ',' '\n' | sort | tr '\n' ',' | sed 's/,$//')
        
        # Get paths if any
        PATHS=$(grep -A 30 "^on:" "$workflow_file" 2>/dev/null | \
            grep -A 10 "paths:" | grep -E "^\s+-" | \
            sed 's/^[[:space:]]*-[[:space:]]*//' | sort | tr '\n' ',' | sed 's/,$//')
        
        TRIGGER_KEY="branches:${BRANCHES:-*}|paths:${PATHS:-*}"
        echo "$TRIGGER_KEY|$WORKFLOW_NAME|$workflow_file" >> "$TRIGGER_FILE"
    fi
done

if [ -f "$TRIGGER_FILE" ] && [ -s "$TRIGGER_FILE" ]; then
    # Check for exact duplicate triggers (same branches + paths)
    DUPLICATE_TRIGGERS=$(cut -d'|' -f1 "$TRIGGER_FILE" | sort | uniq -d)
    if [ -n "$DUPLICATE_TRIGGERS" ]; then
        echo -e "${YELLOW}⚠ Potential duplicate workflow triggers found (may be intentional):${NC}"
        echo "$DUPLICATE_TRIGGERS" | while read trigger; do
            echo -e "  ${YELLOW}${trigger}${NC}"
            grep "^${trigger}|" "$TRIGGER_FILE" | cut -d'|' -f2- | while read line; do
                workflow_name=$(echo "$line" | cut -d'|' -f1)
                file=$(echo "$line" | cut -d'|' -f2)
                echo -e "    → $workflow_name ($file)"
            done
        done
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ No exact duplicate triggers found${NC}"
    fi
    rm -f "$TRIGGER_FILE"
else
    echo -e "${YELLOW}⚠ Could not analyze triggers${NC}"
    rm -f "$TRIGGER_FILE"
fi

echo ""

# 4. Check for duplicate step patterns (same step name + run command in multiple workflows)
echo -e "${CYAN}4. Checking for duplicate step patterns...${NC}"

STEP_PATTERN_FILE=$(mktemp)
find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" | while read workflow_file; do
    if [ ! -f "$workflow_file" ]; then
        continue
    fi
    
    # Extract step names and their run commands
    awk '/^\s+- name:/{name=$0; getline; while(getline && /^\s+(run:|uses:|with:)/){cmd=cmd$0"\n"} if(cmd!=""){gsub(/^[[:space:]]*- name:[[:space:]]*/, "", name); gsub(/[[:space:]]*$/, "", name); print name"|"cmd"|"FILENAME; cmd=""}}' "$workflow_file" 2>/dev/null || true
done | while read line; do
    step_name=$(echo "$line" | cut -d'|' -f1)
    step_cmd=$(echo "$line" | cut -d'|' -f2 | head -5)  # First 5 lines of command
    file=$(echo "$line" | cut -d'|' -f3)
    
    # Create a simplified pattern (just step name + first command line)
    pattern=$(echo "$step_cmd" | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -c 100)
    echo "${step_name}|${pattern}|${file}" >> "$STEP_PATTERN_FILE"
done

if [ -f "$STEP_PATTERN_FILE" ] && [ -s "$STEP_PATTERN_FILE" ]; then
    # Check for duplicates (same step name + command pattern)
    DUPLICATE_STEPS=$(cut -d'|' -f1-2 "$STEP_PATTERN_FILE" | sort | uniq -d)
    if [ -n "$DUPLICATE_STEPS" ]; then
        echo -e "${YELLOW}⚠ Similar step patterns found (may be intentional reuse):${NC}"
        echo "$DUPLICATE_STEPS" | head -5 | while read step_pattern; do
            step_name=$(echo "$step_pattern" | cut -d'|' -f1)
            pattern=$(echo "$step_pattern" | cut -d'|' -f2)
            echo -e "  ${YELLOW}Step: ${step_name}${NC}"
            grep "^${step_name}|${pattern}|" "$STEP_PATTERN_FILE" | cut -d'|' -f3 | while read file; do
                echo -e "    → $file"
            done
        done
        # Don't count as error - reuse is fine, just informational
    else
        echo -e "${GREEN}✓ No duplicate step patterns found${NC}"
    fi
    rm -f "$STEP_PATTERN_FILE"
else
    echo -e "${YELLOW}⚠ Could not analyze step patterns${NC}"
    rm -f "$STEP_PATTERN_FILE"
fi

echo ""

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No duplicate CI/CD workflow issues found${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Warnings found but no critical issues${NC}"
    exit 0
else
    echo -e "${RED}❌ Duplicate CI/CD workflows detected (${ERRORS} error(s), ${WARNINGS} warning(s))${NC}"
    echo -e "${CYAN}💡 Recommendation: Consolidate duplicate workflows or rename jobs${NC}"
    exit 1
fi
