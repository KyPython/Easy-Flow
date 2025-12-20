#!/bin/sh
# EasyFlow Production Deployment Script
# Integrates with shell-games simple-deploy.sh for deployment simulation
# Then uses PM2 for actual deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Production Deployment ===${NC}\n"

# Step 1: Run environment check
echo "${BLUE}Step 1: Verifying environment...${NC}"
if ! ./scripts/dev-env-check.sh; then
    echo "${RED}❌ Environment check failed. Please fix issues before deploying.${NC}"
    exit 1
fi

# Step 2: Run deployment simulation
echo "\n${BLUE}Step 2: Running deployment simulation...${NC}"
./scripts/simple-deploy.sh

# Step 3: Build services
echo "\n${BLUE}Step 3: Building services...${NC}"

# Build Frontend
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    echo "  Building frontend..."
    cd rpa-system/rpa-dashboard
    npm run build
    echo "  ${GREEN}✓ Frontend built${NC}"
    cd ../..
fi

# Step 4: Deploy with PM2
echo "\n${BLUE}Step 4: Deploying with PM2...${NC}"

# Check if PM2 is installed
if ! command -v pm2 >/dev/null 2>&1; then
    echo "${RED}✗ PM2 is not installed. Installing...${NC}"
    npm install -g pm2
fi

# Stop existing processes
echo "  Stopping existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start with PM2 ecosystem
echo "  Starting services with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "  Setting up PM2 startup..."
pm2 startup 2>/dev/null || echo "${YELLOW}  ⚠ PM2 startup script generation skipped (may need sudo)${NC}"

echo "\n${GREEN}✅ Deployment complete!${NC}"
echo "\n${BLUE}Services:${NC}"
pm2 status

echo "\n${BLUE}Useful commands:${NC}"
echo "  View logs:     ${GREEN}pm2 logs${NC}"
echo "  Restart:       ${GREEN}pm2 restart all${NC}"
echo "  Stop:          ${GREEN}pm2 stop all${NC}"
echo "  Monitor:       ${GREEN}pm2 monit${NC}"

