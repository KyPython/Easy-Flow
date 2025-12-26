#!/bin/bash
# Terraform Plan Script
# Runs terraform plan with safety checks and output formatting

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get environment from argument or default to 'dev'
ENVIRONMENT="${1:-dev}"

echo -e "${GREEN}📋 Running Terraform Plan for environment: ${ENVIRONMENT}${NC}"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Error: Terraform is not installed${NC}"
    exit 1
fi

# Check if Terraform is initialized
if [ ! -d ".terraform" ]; then
    echo -e "${YELLOW}⚠ Terraform not initialized. Running init...${NC}"
    ./scripts/terraform-init.sh "${ENVIRONMENT}" || {
        echo -e "${RED}❌ Failed to initialize Terraform${NC}"
        exit 1
    }
fi

# Validate configuration first
echo -e "${BLUE}🔍 Validating Terraform configuration...${NC}"
if ! terraform validate -no-color > /dev/null 2>&1; then
    echo -e "${RED}❌ Terraform configuration validation failed${NC}"
    terraform validate
    exit 1
fi
echo -e "${GREEN}✓ Configuration is valid${NC}"

# Format check
echo -e "${BLUE}🎨 Checking Terraform formatting...${NC}"
if ! terraform fmt -check -recursive > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Some files need formatting. Run 'terraform fmt' to fix${NC}"
fi

# Run terraform plan
PLAN_FILE="terraform-${ENVIRONMENT}.plan"
echo -e "${GREEN}📊 Generating Terraform plan...${NC}"

terraform plan \
    -out="${PLAN_FILE}" \
    -var="environment=${ENVIRONMENT}" \
    -no-color \
    -detailed-exitcode \
    > /tmp/terraform-plan.log 2>&1

PLAN_EXIT_CODE=${PIPESTATUS[0]}

# Display plan output
cat /tmp/terraform-plan.log

# Interpret exit code
case ${PLAN_EXIT_CODE} in
    0)
        echo -e "${GREEN}✅ No changes. Infrastructure is up-to-date${NC}"
        ;;
    1)
        echo -e "${RED}❌ Error during plan${NC}"
        exit 1
        ;;
    2)
        echo -e "${YELLOW}⚠ Changes detected. Plan saved to: ${PLAN_FILE}${NC}"
        echo -e "${BLUE}💡 Review the plan above, then run: ./scripts/terraform-apply.sh ${ENVIRONMENT}${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Unexpected exit code: ${PLAN_EXIT_CODE}${NC}"
        exit 1
        ;;
esac

