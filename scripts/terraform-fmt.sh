#!/bin/bash
# Terraform Format Script
# Formats Terraform files to match style guidelines

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for --check flag
CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
    CHECK_ONLY=true
fi

echo -e "${GREEN}🎨 Formatting Terraform files...${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    exit 1
fi

# Format files
if [ "${CHECK_ONLY}" = true ]; then
    echo -e "${GREEN}🔍 Checking formatting (no changes will be made)...${NC}"
    if terraform fmt -check -recursive; then
        echo -e "${GREEN}✅ All files are properly formatted${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some files need formatting${NC}"
        echo "Run 'terraform fmt' to fix"
        exit 1
    fi
else
    echo -e "${GREEN}📝 Formatting files...${NC}"
    terraform fmt -recursive
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Files formatted successfully${NC}"
        exit 0
    else
        echo -e "${RED}❌ Formatting failed${NC}"
        exit 1
    fi
fi

