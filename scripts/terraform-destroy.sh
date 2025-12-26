#!/bin/bash
# Terraform Destroy Script
# Safely destroys infrastructure with multiple confirmations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get environment from argument or default to 'dev'
ENVIRONMENT="${1:-dev}"

echo -e "${RED}⚠️  DESTROY OPERATION - This will DELETE infrastructure${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    exit 1
fi

# Check if Terraform is initialized
if [ ! -d ".terraform" ]; then
    echo -e "${YELLOW}⚠ Terraform not initialized${NC}"
    exit 1
fi

# Show what will be destroyed
echo -e "${BLUE}📋 Generating destroy plan...${NC}"
terraform plan -destroy -var="environment=${ENVIRONMENT}" -no-color > /tmp/terraform-destroy-plan.log 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to generate destroy plan${NC}"
    cat /tmp/terraform-destroy-plan.log
    exit 1
fi

# Show plan
cat /tmp/terraform-destroy-plan.log

# Multiple confirmations required
if [ -z "${CI:-}" ]; then
    echo -e "${RED}⚠️  WARNING: This will DESTROY all infrastructure shown above${NC}"
    echo -e "${YELLOW}This action cannot be undone!${NC}"
    
    read -p "Type 'DESTROY' to confirm: " CONFIRM1
    if [ "${CONFIRM1}" != "DESTROY" ]; then
        echo -e "${YELLOW}❌ Destroy cancelled${NC}"
        exit 0
    fi
    
    read -p "Type the environment name '${ENVIRONMENT}' to confirm again: " CONFIRM2
    if [ "${CONFIRM2}" != "${ENVIRONMENT}" ]; then
        echo -e "${YELLOW}❌ Destroy cancelled (environment mismatch)${NC}"
        exit 0
    fi
fi

# Backup state file
if [ -f "terraform.tfstate" ]; then
    BACKUP_FILE="terraform.tfstate.backup.destroy.$(date +%Y%m%d_%H%M%S)"
    echo -e "${BLUE}💾 Backing up state file to: ${BACKUP_FILE}${NC}"
    cp terraform.tfstate "${BACKUP_FILE}"
fi

# Destroy
echo -e "${RED}🗑️  Destroying infrastructure...${NC}"
terraform destroy \
    -var="environment=${ENVIRONMENT}" \
    -auto-approve \
    -no-color

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure destroyed successfully${NC}"
    echo -e "${YELLOW}💡 State file backed up to: ${BACKUP_FILE:-N/A}${NC}"
    exit 0
else
    echo -e "${RED}❌ Destroy failed${NC}"
    exit 1
fi

