#!/bin/bash
# Validate Duplicate Features Detection
# Checks for duplicate API routes, duplicate components, duplicate utilities

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=== Duplicate Features Detection ===${NC}\n"

ERRORS=0
WARNINGS=0

# 1. Check for duplicate API routes
echo -e "${CYAN}1. Checking for duplicate API routes...${NC}"

# Extract all route definitions from backend
if [ -d "rpa-system/backend" ]; then
    ROUTE_FILE=$(mktemp)
    
    # Find all route files and extract route patterns
    find rpa-system/backend/routes -name "*.js" -type f 2>/dev/null | while read file; do
        # Extract router.get, router.post, etc. patterns
        grep -hE "router\.(get|post|put|delete|patch)\(" "$file" 2>/dev/null | \
            sed -E "s/.*router\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"].*/\1 \2/" | \
            while read method path; do
                if [ -n "$method" ] && [ -n "$path" ]; then
                    echo "$method $path $file" >> "$ROUTE_FILE"
                fi
            done
    done
    
    # Also check app.js for inline routes
    if [ -f "rpa-system/backend/app.js" ]; then
        grep -hE "app\.(get|post|put|delete|patch)\s*\(" rpa-system/backend/app.js 2>/dev/null | \
            sed -E "s/.*app\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"].*/\1 \2/" | \
            while read method path; do
                if [ -n "$method" ] && [ -n "$path" ]; then
                    echo "$method $path rpa-system/backend/app.js" >> "$ROUTE_FILE"
                fi
            done
    fi
    
    # Check for duplicates
    if [ -f "$ROUTE_FILE" ] && [ -s "$ROUTE_FILE" ]; then
        DUPLICATES=$(sort "$ROUTE_FILE" | cut -d' ' -f1-2 | uniq -d)
        if [ -n "$DUPLICATES" ]; then
            echo -e "${RED}✗ Duplicate routes found:${NC}"
            echo "$DUPLICATES" | while read method path; do
                echo -e "  ${YELLOW}${method} ${path}${NC}"
                grep "^${method} ${path}" "$ROUTE_FILE" | while read line; do
                    file=$(echo "$line" | awk '{print $3}')
                    echo -e "    → $file"
                done
            done
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${GREEN}✓ No duplicate routes found${NC}"
        fi
        rm -f "$ROUTE_FILE"
    else
        echo -e "${YELLOW}⚠ Could not extract routes${NC}"
        rm -f "$ROUTE_FILE"
    fi
else
    echo -e "${YELLOW}⚠ Backend directory not found${NC}"
fi

echo ""

# 2. Check for duplicate component names (frontend)
echo -e "${CYAN}2. Checking for duplicate component names...${NC}"

if [ -d "rpa-system/rpa-dashboard/src/components" ]; then
    COMPONENT_NAMES=$(mktemp)
    
    # Find all component files and extract component names
    find rpa-system/rpa-dashboard/src/components -name "*.jsx" -o -name "*.tsx" -o -name "*.js" -o -name "*.ts" | \
        while read file; do
            # Extract export default function/const component names
            COMPONENT_NAME=$(basename "$file" | sed 's/\.[^.]*$//')
            # Also try to extract from file content
            if grep -q "export default" "$file" 2>/dev/null; then
                EXPORT_NAME=$(grep -h "export default" "$file" 2>/dev/null | \
                    sed -E "s/.*export default\s+(function|const|class)\s+([A-Z][a-zA-Z0-9]*).*/\2/" | head -1)
                if [ -n "$EXPORT_NAME" ]; then
                    COMPONENT_NAME="$EXPORT_NAME"
                fi
            fi
            echo "$COMPONENT_NAME $file" >> "$COMPONENT_NAMES"
        done
    
    # Check for duplicates (same component name in different locations)
    if [ -f "$COMPONENT_NAMES" ] && [ -s "$COMPONENT_NAMES" ]; then
        DUPLICATE_NAMES=$(sort "$COMPONENT_NAMES" | cut -d' ' -f1 | uniq -d)
        if [ -n "$DUPLICATE_NAMES" ]; then
            echo -e "${YELLOW}⚠ Potential duplicate component names:${NC}"
            echo "$DUPLICATE_NAMES" | while read name; do
                echo -e "  ${CYAN}${name}${NC}"
                grep "^${name} " "$COMPONENT_NAMES" | cut -d' ' -f2- | while read file; do
                    echo -e "    → $file"
                done
            done
            WARNINGS=$((WARNINGS + 1))
        else
            echo -e "${GREEN}✓ No duplicate component names found${NC}"
        fi
        rm -f "$COMPONENT_NAMES"
    else
        rm -f "$COMPONENT_NAMES"
    fi
else
    echo -e "${YELLOW}⚠ Frontend components directory not found${NC}"
fi

echo ""

# 3. Check for duplicate utility functions
echo -e "${CYAN}3. Checking for duplicate utility function names...${NC}"

UTIL_FUNCTIONS=$(mktemp)

# Check backend utils
if [ -d "rpa-system/backend/utils" ]; then
    find rpa-system/backend/utils -name "*.js" -type f | \
        while read file; do
            # Extract exported function names
            grep -hE "^(exports\.|module\.exports\.|function |const .* = (async )?\(|export (async )?function |export const )" "$file" 2>/dev/null | \
                sed -E "s/.*(exports\.|module\.exports\.|function |const |export (async )?function |export const )([a-zA-Z_$][a-zA-Z0-9_$]*).*/\2/" | \
                while read func_name; do
                    if [ -n "$func_name" ] && [ "$func_name" != "exports" ] && [ "$func_name" != "module" ]; then
                        echo "$func_name $file" >> "$UTIL_FUNCTIONS"
                    fi
                done
        done
fi

# Check frontend utils
if [ -d "rpa-system/rpa-dashboard/src/utils" ]; then
    find rpa-system/rpa-dashboard/src/utils -name "*.js" -o -name "*.ts" | \
        while read file; do
            grep -hE "^(export (async )?function |export const |export default function )" "$file" 2>/dev/null | \
                sed -E "s/.*(export (async )?function |export const |export default function )([a-zA-Z_$][a-zA-Z0-9_$]*).*/\2/" | \
                while read func_name; do
                    if [ -n "$func_name" ]; then
                        echo "$func_name $file" >> "$UTIL_FUNCTIONS"
                    fi
                done
        done
fi

# Check for duplicates
if [ -f "$UTIL_FUNCTIONS" ] && [ -s "$UTIL_FUNCTIONS" ]; then
    DUPLICATE_FUNCS=$(sort "$UTIL_FUNCTIONS" | cut -d' ' -f1 | uniq -d)
    if [ -n "$DUPLICATE_FUNCS" ]; then
        echo -e "${YELLOW}⚠ Potential duplicate utility function names:${NC}"
        echo "$DUPLICATE_FUNCS" | head -10 | while read func_name; do
            echo -e "  ${CYAN}${func_name}${NC}"
            grep "^${func_name} " "$UTIL_FUNCTIONS" | cut -d' ' -f2- | while read file; do
                echo -e "    → $file"
            done
        done
        if [ "$(echo "$DUPLICATE_FUNCS" | wc -l)" -gt 10 ]; then
            echo -e "  ${YELLOW}... and more (showing first 10)${NC}"
        fi
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ No duplicate utility function names found${NC}"
    fi
    rm -f "$UTIL_FUNCTIONS"
else
    echo -e "${YELLOW}⚠ Could not extract utility functions${NC}"
    rm -f "$UTIL_FUNCTIONS"
fi

echo ""

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No duplicate features detected${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found (potential duplicate features)${NC}"
    echo -e "${CYAN}💡 Recommendation: Review and consolidate duplicate features${NC}"
    # In strict mode, warnings should fail
    if [ "${STRICT_MODE:-false}" = "true" ]; then
        exit 1
    else
        exit 0
    fi
else
    echo -e "${RED}❌ ${ERRORS} error(s), ${WARNINGS} warning(s) found${NC}"
    echo -e "${CYAN}💡 Recommendation: Fix duplicate routes/features immediately${NC}"
    exit 1
fi
