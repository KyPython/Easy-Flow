#!/bin/bash
# Auto-Fix Code Formatting Script
# Automatically fixes formatting issues (ESLint, Terraform, Shell scripts)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Auto-Fixing Code Formatting Issues${NC}\n"

FIXED=0

# 1. ESLint Auto-Fix (Frontend)
echo -e "${YELLOW}1. Fixing ESLint issues (Frontend)...${NC}"
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    cd rpa-system/rpa-dashboard
    if npm run lint:fix 2>/dev/null || npx eslint . --ext .js,.jsx --fix 2>/dev/null; then
        echo -e "${GREEN}  ✓ Frontend ESLint fixes applied${NC}"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}  ○ No ESLint fixes needed or ESLint not configured${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}  ○ Frontend not found${NC}"
fi

# 2. ESLint Auto-Fix (Backend)
echo -e "${YELLOW}2. Fixing ESLint issues (Backend)...${NC}"
if [ -f "rpa-system/backend/package.json" ]; then
    cd rpa-system/backend
    if npm run lint:fix 2>/dev/null || npx eslint . --ext .js --fix 2>/dev/null; then
        echo -e "${GREEN}  ✓ Backend ESLint fixes applied${NC}"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}  ○ No ESLint fixes needed or ESLint not configured${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}  ○ Backend not found${NC}"
fi

# 3. Terraform Formatting
echo -e "${YELLOW}3. Formatting Terraform files...${NC}"
if [ -d "infrastructure" ] && command -v terraform >/dev/null 2>&1; then
    TERRAFORM_FIXED=0
    find infrastructure -name "*.tf" -o -name "*.tfvars" | while read file; do
        if terraform fmt "$file" 2>/dev/null; then
            TERRAFORM_FIXED=$((TERRAFORM_FIXED + 1))
        fi
    done
    if [ $TERRAFORM_FIXED -gt 0 ]; then
        echo -e "${GREEN}  ✓ Terraform files formatted${NC}"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}  ○ Terraform files already formatted${NC}"
    fi
else
    echo -e "${YELLOW}  ○ No Terraform files or terraform not installed${NC}"
fi

# 4. Shell Script Formatting (optional - requires shfmt)
echo -e "${YELLOW}4. Formatting shell scripts (optional)...${NC}"
if command -v shfmt >/dev/null 2>&1; then
    SHELL_FIXED=0
    find scripts -name "*.sh" -type f 2>/dev/null | while read file; do
        if shfmt -w "$file" 2>/dev/null; then
            SHELL_FIXED=$((SHELL_FIXED + 1))
        fi
    done
    if [ $SHELL_FIXED -gt 0 ]; then
        echo -e "${GREEN}  ✓ Shell scripts formatted${NC}"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}  ○ Shell scripts already formatted${NC}"
    fi
else
    echo -e "${YELLOW}  ○ shfmt not installed (optional)${NC}"
fi

echo ""
if [ $FIXED -gt 0 ]; then
    echo -e "${GREEN}✅ Auto-fixed $FIXED type(s) of formatting issues${NC}"
    echo -e "${YELLOW}  Review changes and commit if needed${NC}"
    exit 0
else
    echo -e "${GREEN}✅ No formatting issues found - code is already formatted!${NC}"
    exit 0
fi

