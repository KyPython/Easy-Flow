#!/bin/bash
# Check Vercel Configuration
# Verifies that Vercel is configured correctly for production deployments

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Vercel Configuration Check ===${NC}\n"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not installed${NC}"
    echo -e "   Install: ${CYAN}npm i -g vercel${NC}"
    echo -e "   Or check settings manually in Vercel dashboard: https://vercel.com/dashboard\n"
    echo -e "${YELLOW}Manual Check Required:${NC}"
    echo -e "   1. Go to: https://vercel.com/dashboard"
    echo -e "   2. Select your EasyFlow project"
    echo -e "   3. Settings → Git → Production Branch"
    echo -e "   4. Must be set to: ${GREEN}main${NC}"
    echo -e "   5. ${RED}If set to 'dev', FIX IT IMMEDIATELY${NC}\n"
    exit 0
fi

# Check if we're in a Vercel project
if [ ! -f ".vercel/project.json" ] && [ ! -f "rpa-system/rpa-dashboard/.vercel/project.json" ]; then
    echo -e "${YELLOW}⚠️  Not a Vercel project (no .vercel directory found)${NC}"
    echo -e "   This script checks Vercel CLI configuration"
    echo -e "   For dashboard settings, check manually:\n"
    echo -e "   ${BLUE}https://vercel.com/dashboard → Your Project → Settings → Git${NC}\n"
    exit 0
fi

echo -e "${BLUE}Checking Vercel project configuration...${NC}\n"

# Try to get project info (requires authentication)
if vercel project ls &> /dev/null; then
    echo -e "${GREEN}✓ Vercel CLI authenticated${NC}"
    
    # Note: Vercel CLI doesn't expose production branch setting directly
    # This is a dashboard-only setting
    echo -e "\n${YELLOW}⚠️  Production branch setting is NOT accessible via CLI${NC}"
    echo -e "   This must be checked in the Vercel dashboard:\n"
    echo -e "   ${BLUE}https://vercel.com/dashboard → Your Project → Settings → Git${NC}\n"
    echo -e "${RED}CRITICAL CHECK:${NC}"
    echo -e "   Production Branch MUST be: ${GREEN}main${NC}"
    echo -e "   ${RED}If it's set to 'dev', this is WRONG and must be fixed!${NC}\n"
else
    echo -e "${YELLOW}⚠️  Vercel CLI not authenticated${NC}"
    echo -e "   Run: ${CYAN}vercel login${NC}\n"
fi

echo -e "${BLUE}=== Manual Verification Required ===${NC}\n"
echo -e "Vercel production branch is configured in the dashboard, not in code.\n"
echo -e "${YELLOW}Steps to verify/fix:${NC}"
echo -e "  1. Go to: ${BLUE}https://vercel.com/dashboard${NC}"
echo -e "  2. Select your EasyFlow project"
echo -e "  3. Click ${CYAN}Settings${NC} → ${CYAN}Git${NC}"
echo -e "  4. Check ${CYAN}Production Branch${NC} setting"
echo -e "  5. Must be: ${GREEN}main${NC}"
echo -e "  6. If it's ${RED}dev${NC}, change it to ${GREEN}main${NC} and save\n"
echo -e "${YELLOW}Preview Deployments:${NC}"
echo -e "  - ${CYAN}dev${NC} branch can create preview deployments (safe)"
echo -e "  - But ${RED}production${NC} MUST deploy from ${GREEN}main${NC} only\n"

