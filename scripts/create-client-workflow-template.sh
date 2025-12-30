#!/bin/bash
# Create Client Workflow Template
# Helps you quickly create workflows for client automations

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     EasyFlow Client Workflow Template Creator            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}\n"

# Get client information
read -p "Client Name: " CLIENT_NAME
read -p "Task Description (e.g., 'PDF to Excel conversion'): " TASK_DESC
read -p "Pricing Tier (simple/medium/complex) [simple]: " PRICING_TIER
PRICING_TIER=${PRICING_TIER:-simple}

# Generate workflow name
WORKFLOW_NAME="${CLIENT_NAME} - ${TASK_DESC}"

echo -e "\n${CYAN}Creating workflow template for:${NC}"
echo -e "  Client: ${GREEN}${CLIENT_NAME}${NC}"
echo -e "  Task: ${GREEN}${TASK_DESC}${NC}"
echo -e "  Tier: ${GREEN}${PRICING_TIER}${NC}"
echo -e "  Workflow Name: ${GREEN}${WORKFLOW_NAME}${NC}\n"

# Create template file
TEMPLATE_FILE="docs/client-workflow-templates/${CLIENT_NAME// /_}-${TASK_DESC// /_}.md"

mkdir -p docs/client-workflow-templates

cat > "$TEMPLATE_FILE" << EOF
# Client Workflow: ${WORKFLOW_NAME}

## Client Information
- **Name**: ${CLIENT_NAME}
- **Task**: ${TASK_DESC}
- **Pricing Tier**: ${PRICING_TIER}
- **Created**: $(date +"%Y-%m-%d")}

## Workflow Details
- **Name**: ${WORKFLOW_NAME}
- **Status**: Draft
- **Estimated Build Time**: $(case $PRICING_TIER in simple) echo "1-2 hours" ;; medium) echo "2-4 hours" ;; complex) echo "4-8 hours" ;; esac)

## Requirements
- [ ] Client requirements documented
- [ ] Access to client tools (if needed)
- [ ] Pricing confirmed
- [ ] Timeline agreed

## Build Steps
1. [ ] Create workflow in EasyFlow
2. [ ] Configure steps
3. [ ] Test workflow
4. [ ] Create demo video
5. [ ] Deliver to client

## Delivery Checklist
- [ ] Workflow built and tested
- [ ] Demo video created
- [ ] Client access provided
- [ ] Documentation shared
- [ ] Invoice sent
- [ ] Payment received

## Notes
- Add any specific requirements or notes here

EOF

echo -e "${GREEN}✅ Template created: ${TEMPLATE_FILE}${NC}\n"

# Create workflow in EasyFlow (via API or instructions)
echo -e "${CYAN}Next Steps:${NC}"
echo -e "1. Go to EasyFlow: ${BLUE}http://localhost:3000/app/workflows/builder${NC}"
echo -e "2. Click 'New Workflow'"
echo -e "3. Name it: ${GREEN}${WORKFLOW_NAME}${NC}"
echo -e "4. Build the automation"
echo -e "5. Test thoroughly"
echo -e "6. Create demo video"
echo -e "7. Deliver to client\n"

echo -e "${YELLOW}💡 Tip: Use the template file to track progress!${NC}\n"

