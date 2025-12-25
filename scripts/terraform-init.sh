#!/bin/bash
# Terraform Init Script
# Initializes Terraform workspace with proper backend configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get environment from argument or default to 'dev'
ENVIRONMENT="${1:-dev}"

echo -e "${GREEN}🚀 Initializing Terraform for environment: ${ENVIRONMENT}${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    echo "Install Terraform: https://www.terraform.io/downloads"
    exit 1
fi

# Check Terraform version
TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version' 2>/dev/null || terraform version | head -1)
echo -e "${GREEN}✓ Terraform version: ${TERRAFORM_VERSION}${NC}"

# Check if we're in a Terraform directory
if [ ! -f "main.tf" ] && [ ! -f "*.tf" ]; then
    echo -e "${YELLOW}⚠ Warning: No .tf files found in current directory${NC}"
    echo "Make sure you're in a directory with Terraform configuration files"
fi

# Initialize Terraform
echo -e "${GREEN}📦 Initializing Terraform...${NC}"
terraform init \
    -upgrade \
    -input=false \
    -backend-config="environment=${ENVIRONMENT}" 2>&1 | tee /tmp/terraform-init.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Terraform initialized successfully${NC}"
    
    # Show provider information
    echo -e "${GREEN}📋 Provider information:${NC}"
    terraform providers 2>/dev/null || echo "Run 'terraform providers' for details"
    
    exit 0
else
    echo -e "${RED}❌ Terraform initialization failed${NC}"
    echo "Check the logs above for details"
    exit 1
fi

