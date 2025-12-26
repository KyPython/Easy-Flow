#!/bin/bash
# Terraform Validate Script
# Validates Terraform configuration syntax and logic

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Validating Terraform configuration...${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    exit 1
fi

# Check if we're in a Terraform directory
if [ ! -f "main.tf" ] && [ ! -f "*.tf" ]; then
    echo -e "${YELLOW}⚠ Warning: No .tf files found in current directory${NC}"
    exit 1
fi

# Initialize if needed
if [ ! -d ".terraform" ]; then
    echo -e "${YELLOW}⚠ Terraform not initialized. Running init...${NC}"
    terraform init -backend=false > /dev/null 2>&1 || {
        echo -e "${RED}❌ Failed to initialize Terraform${NC}"
        exit 1
    }
fi

# Validate configuration
echo -e "${GREEN}📋 Running validation checks...${NC}"

# Format check
echo -n "Checking formatting... "
if terraform fmt -check -recursive > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Files need formatting${NC}"
    echo "Run 'terraform fmt' to fix"
fi

# Syntax and logic validation
echo -n "Validating syntax and logic... "
VALIDATION_OUTPUT=$(terraform validate -no-color 2>&1)
VALIDATION_EXIT=$?

if [ ${VALIDATION_EXIT} -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
    echo -e "${GREEN}✅ Terraform configuration is valid${NC}"
    exit 0
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}❌ Validation failed:${NC}"
    echo "${VALIDATION_OUTPUT}"
    exit 1
fi

