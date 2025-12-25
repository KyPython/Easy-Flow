#!/bin/bash
# Terraform Apply Script
# Applies infrastructure changes with confirmation and safety checks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get environment from argument or default to 'dev'
ENVIRONMENT="${1:-dev}"
AUTO_APPROVE="${2:-}"

echo -e "${GREEN}🚀 Applying Terraform changes for environment: ${ENVIRONMENT}${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    exit 1
fi

# Check if plan file exists
PLAN_FILE="terraform-${ENVIRONMENT}.plan"
if [ ! -f "${PLAN_FILE}" ]; then
    echo -e "${YELLOW}⚠ No plan file found. Running plan first...${NC}"
    ./scripts/terraform-plan.sh "${ENVIRONMENT}" || {
        echo -e "${RED}❌ Plan failed. Cannot proceed with apply${NC}"
        exit 1
    }
    
    if [ ! -f "${PLAN_FILE}" ]; then
        echo -e "${GREEN}✅ No changes to apply${NC}"
        exit 0
    fi
fi

# Backup state file if it exists
if [ -f "terraform.tfstate" ]; then
    BACKUP_FILE="terraform.tfstate.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${BLUE}💾 Backing up state file to: ${BACKUP_FILE}${NC}"
    cp terraform.tfstate "${BACKUP_FILE}"
fi

# Confirmation (unless auto-approve or CI)
if [ -z "${AUTO_APPROVE}" ] && [ -z "${CI:-}" ]; then
    echo -e "${YELLOW}⚠ WARNING: This will apply infrastructure changes${NC}"
    echo -e "${BLUE}📋 Review the plan file: ${PLAN_FILE}${NC}"
    read -p "Do you want to proceed? (yes/no): " CONFIRM
    
    if [ "${CONFIRM}" != "yes" ]; then
        echo -e "${YELLOW}❌ Apply cancelled${NC}"
        exit 0
    fi
fi

# Apply the plan
echo -e "${GREEN}🔄 Applying Terraform plan...${NC}"
terraform apply \
    -no-color \
    "${PLAN_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure applied successfully${NC}"
    
    # Clean up plan file
    rm -f "${PLAN_FILE}"
    echo -e "${BLUE}🧹 Cleaned up plan file${NC}"
    
    exit 0
else
    echo -e "${RED}❌ Apply failed${NC}"
    echo -e "${YELLOW}💡 State file backed up to: ${BACKUP_FILE:-N/A}${NC}"
    exit 1
fi

