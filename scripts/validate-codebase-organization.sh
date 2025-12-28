#!/bin/bash
# Codebase Organization and Navigation Validation
# Ensures codebase is well-organized, navigable, and clearly documented

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Codebase Organization & Navigation Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Required documentation files
REQUIRED_DOCS=(
    "CODEBASE_NAVIGATION.md"
    "ROUTE_MAP.md"
    "QUICK_REFERENCE.md"
    "README.md"
)

# Required README files in key directories
REQUIRED_READMES=(
    "rpa-system/rpa-dashboard/src/README.md"
    "rpa-system/rpa-dashboard/src/pages/README.md"
    "rpa-system/rpa-dashboard/src/components/README.md"
    "rpa-system/backend/README.md"
    "rpa-system/backend/routes/README.md"
    "rpa-system/backend/services/README.md"
)

# Key directories that should exist
REQUIRED_DIRS=(
    "rpa-system/rpa-dashboard/src/pages"
    "rpa-system/rpa-dashboard/src/components"
    "rpa-system/rpa-dashboard/src/hooks"
    "rpa-system/rpa-dashboard/src/utils"
    "rpa-system/backend/routes"
    "rpa-system/backend/services"
    "rpa-system/backend/middleware"
    "rpa-system/backend/utils"
)

echo "${BLUE}Checking for required documentation...${NC}\n"

# Check root-level documentation
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        # Check if file has meaningful content (more than 50 lines)
        line_count=$(wc -l < "$doc" 2>/dev/null || echo "0")
        if [ "$line_count" -lt 50 ]; then
            echo "  ${YELLOW}⚠ ${doc}${NC}"
            echo "    ${RED}✗ File exists but is too short (${line_count} lines, expected 50+)${NC}"
            echo "    ${CYAN}   Recommendation: Add more comprehensive documentation${NC}"
            TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
            FAILED=$((FAILED + 1))
        else
            echo "  ${GREEN}✓ ${doc}${NC}"
        fi
    else
        echo "  ${RED}✗ ${doc}${NC}"
        echo "    ${RED}   Missing required documentation file${NC}"
        echo "    ${CYAN}   Recommendation: Create comprehensive navigation documentation${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
done

echo "\n${BLUE}Checking for README files in key directories...${NC}\n"

# Check README files in key directories
for readme in "${REQUIRED_READMES[@]}"; do
    if [ -f "$readme" ]; then
        # Check if README has meaningful content (more than 20 lines)
        line_count=$(wc -l < "$readme" 2>/dev/null || echo "0")
        if [ "$line_count" -lt 20 ]; then
            echo "  ${YELLOW}⚠ ${readme}${NC}"
            echo "    ${RED}✗ README exists but is too short (${line_count} lines, expected 20+)${NC}"
            echo "    ${CYAN}   Recommendation: Add more detailed directory documentation${NC}"
            TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
            FAILED=$((FAILED + 1))
        else
            echo "  ${GREEN}✓ ${readme}${NC}"
        fi
    else
        echo "  ${RED}✗ ${readme}${NC}"
        echo "    ${RED}   Missing README file${NC}"
        echo "    ${CYAN}   Recommendation: Create README.md explaining directory contents${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
done

echo "\n${BLUE}Checking directory structure...${NC}\n"

# Check required directories exist
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ${GREEN}✓ ${dir}${NC}"
    else
        echo "  ${RED}✗ ${dir}${NC}"
        echo "    ${RED}   Missing required directory${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
done

echo "\n${BLUE}Checking for navigation links in main README...${NC}\n"

# Check if main README links to navigation docs
if [ -f "README.md" ]; then
    if grep -q "CODEBASE_NAVIGATION\|ROUTE_MAP\|QUICK_REFERENCE" README.md 2>/dev/null; then
        echo "  ${GREEN}✓ README.md contains navigation links${NC}"
    else
        echo "  ${YELLOW}⚠ README.md${NC}"
        echo "    ${RED}✗ Missing links to navigation documentation${NC}"
        echo "    ${CYAN}   Recommendation: Add links to CODEBASE_NAVIGATION.md, ROUTE_MAP.md, QUICK_REFERENCE.md${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ${RED}✗ README.md missing${NC}"
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    FAILED=$((FAILED + 1))
fi

echo "\n${BLUE}Checking route documentation completeness...${NC}\n"

# Check if CODEBASE_NAVIGATION.md contains route information
if [ -f "CODEBASE_NAVIGATION.md" ]; then
    if grep -qi "frontend routes\|backend routes\|route map" CODEBASE_NAVIGATION.md 2>/dev/null; then
        echo "  ${GREEN}✓ CODEBASE_NAVIGATION.md contains route information${NC}"
    else
        echo "  ${YELLOW}⚠ CODEBASE_NAVIGATION.md${NC}"
        echo "    ${RED}✗ Missing route documentation${NC}"
        echo "    ${CYAN}   Recommendation: Add frontend and backend route maps${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
fi

echo "\n${BLUE}Checking file naming conventions...${NC}\n"

# Check for inconsistent file naming in pages directory
if [ -d "rpa-system/rpa-dashboard/src/pages" ]; then
    # Check if pages follow naming convention (*Page.jsx)
    non_standard_pages=$(find rpa-system/rpa-dashboard/src/pages -maxdepth 1 -name "*.jsx" ! -name "*Page.jsx" ! -name "*.test.jsx" ! -name "*.spec.jsx" 2>/dev/null | wc -l || echo "0")
    
    if [ "$non_standard_pages" -gt 0 ]; then
        echo "  ${YELLOW}⚠ rpa-system/rpa-dashboard/src/pages${NC}"
        echo "    ${RED}✗ ${non_standard_pages} page(s) don't follow *Page.jsx naming convention${NC}"
        echo "    ${CYAN}   Recommendation: Rename pages to follow *Page.jsx pattern${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    else
        echo "  ${GREEN}✓ Pages follow naming convention (*Page.jsx)${NC}"
    fi
fi

# Check for inconsistent file naming in routes directory
if [ -d "rpa-system/backend/routes" ]; then
    # Check if routes follow naming convention (*Routes.js or feature name)
    non_standard_routes=$(find rpa-system/backend/routes -maxdepth 1 -name "*.js" ! -name "*Routes.js" ! -name "*.test.js" ! -name "*.spec.js" 2>/dev/null | wc -l || echo "0")
    
    # Allow some common exceptions (tasks.js, auth.js are acceptable)
    if [ "$non_standard_routes" -gt 2 ]; then
        echo "  ${YELLOW}⚠ rpa-system/backend/routes${NC}"
        echo "    ${RED}✗ Some route files don't follow *Routes.js naming convention${NC}"
        echo "    ${CYAN}   Recommendation: Consider renaming to *Routes.js for consistency${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    else
        echo "  ${GREEN}✓ Routes follow naming conventions${NC}"
    fi
fi

echo "\n${BLUE}Checking component organization...${NC}\n"

# Check if components are organized in directories
if [ -d "rpa-system/rpa-dashboard/src/components" ]; then
    # Count components not in their own directories
    loose_components=$(find rpa-system/rpa-dashboard/src/components -maxdepth 1 -name "*.jsx" -o -name "*.tsx" 2>/dev/null | wc -l || echo "0")
    
    if [ "$loose_components" -gt 5 ]; then
        echo "  ${YELLOW}⚠ rpa-system/rpa-dashboard/src/components${NC}"
        echo "    ${RED}✗ ${loose_components} component(s) not organized in directories${NC}"
        echo "    ${CYAN}   Recommendation: Organize components in their own directories${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    else
        echo "  ${GREEN}✓ Components are well-organized${NC}"
    fi
fi

echo "\n${BLUE}Checking for navigation clarity...${NC}\n"

# Check if App.dashboard.jsx has route comments
if [ -f "rpa-system/rpa-dashboard/src/App.dashboard.jsx" ]; then
    route_comments=$(grep -c "Route\|path=" rpa-system/rpa-dashboard/src/App.dashboard.jsx 2>/dev/null || echo "0")
    if [ "$route_comments" -gt 10 ]; then
        echo "  ${GREEN}✓ App.dashboard.jsx has route definitions${NC}"
    else
        echo "  ${YELLOW}⚠ App.dashboard.jsx${NC}"
        echo "    ${RED}✗ Routes may not be clearly documented${NC}"
        echo "    ${CYAN}   Recommendation: Add comments explaining route purposes${NC}"
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
        FAILED=$((FAILED + 1))
    fi
fi

# Summary
echo "\n${BLUE}=== Codebase Organization Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ Codebase is well-organized and navigable!${NC}"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} organization violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Ensure all required documentation files exist"
    echo "  2. Add README.md files to key directories"
    echo "  3. Follow consistent naming conventions"
    echo "  4. Organize components in directories"
    echo "  5. Add navigation links in main README"
    echo ""
    exit 1
fi

