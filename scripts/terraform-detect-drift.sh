#!/bin/bash
# Terraform Drift Detection Script
# Detects infrastructure drift (when reality differs from code)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get environment from argument or default to 'dev'
ENVIRONMENT="${1:-dev}"

echo -e "${GREEN}🔍 Detecting infrastructure drift for environment: ${ENVIRONMENT}${NC}"

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

# Refresh state to get current infrastructure state
echo -e "${BLUE}🔄 Refreshing Terraform state...${NC}"
terraform refresh -var="environment=${ENVIRONMENT}" -no-color > /tmp/terraform-refresh.log 2>&1

# Run plan to detect differences
echo -e "${BLUE}📊 Comparing code with actual infrastructure...${NC}"
terraform plan \
    -var="environment=${ENVIRONMENT}" \
    -detailed-exitcode \
    -no-color \
    > /tmp/terraform-drift.log 2>&1

PLAN_EXIT_CODE=${PIPESTATUS[0]}

# Display results
case ${PLAN_EXIT_CODE} in
    0)
        echo -e "${GREEN}✅ No drift detected. Infrastructure matches code${NC}"
        exit 0
        ;;
    1)
        echo -e "${RED}❌ Error during drift detection${NC}"
        cat /tmp/terraform-drift.log
        exit 1
        ;;
    2)
        echo -e "${YELLOW}⚠️  DRIFT DETECTED: Infrastructure differs from code${NC}"
        echo ""
        cat /tmp/terraform-drift.log
        echo ""
        echo -e "${BLUE}💡 To fix drift:${NC}"
        echo "  1. Review the differences above"
        echo "  2. Either update your code to match infrastructure, or"
        echo "  3. Run 'terraform apply' to update infrastructure to match code"
        exit 2
        ;;
    *)
        echo -e "${RED}❌ Unexpected exit code: ${PLAN_EXIT_CODE}${NC}"
        exit 1
        ;;
esac

