#!/bin/sh
# EasyFlow Simple Deployment Script
# Adapted from shell-games toolkit: https://github.com/KyPython/shell-games
# Simulates deployment workflow for EasyFlow services

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="${1:-.}"
DEPLOY_DIR="${PROJECT_DIR}/deploy"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo "${BLUE}=== EasyFlow Deployment Simulation ===${NC}\n"

# Check if we're in the EasyFlow root directory
if [ ! -f "${PROJECT_DIR}/ecosystem.config.js" ] && [ ! -f "${PROJECT_DIR}/package.json" ]; then
    echo "${YELLOW}⚠ Warning: Doesn't look like EasyFlow root directory${NC}"
    echo "Usage: ./scripts/simple-deploy.sh [project-directory]"
    exit 1
fi

# Create deploy directory
mkdir -p "${DEPLOY_DIR}"

echo "${BLUE}Step 1: Building services...${NC}"

# Build Frontend (React Dashboard)
if [ -f "${PROJECT_DIR}/rpa-system/rpa-dashboard/package.json" ]; then
    echo "  Building frontend (React dashboard)..."
    cd "${PROJECT_DIR}/rpa-system/rpa-dashboard"
    if npm run build >/dev/null 2>&1; then
        echo "  ${GREEN}✓ Frontend build successful${NC}"
        
        # Copy frontend build
        if [ -d "build" ]; then
            mkdir -p "${DEPLOY_DIR}/frontend"
            cp -r build/* "${DEPLOY_DIR}/frontend/"
            echo "  ${GREEN}✓ Frontend artifacts copied${NC}"
        fi
    else
        echo "  ${YELLOW}⚠ Frontend build failed or skipped${NC}"
    fi
    cd - >/dev/null
fi

# Build Backend (check for build script)
if [ -f "${PROJECT_DIR}/rpa-system/backend/package.json" ]; then
    echo "  Checking backend..."
    cd "${PROJECT_DIR}/rpa-system/backend"
    if grep -q '"build"' package.json; then
        if npm run build >/dev/null 2>&1; then
            echo "  ${GREEN}✓ Backend build successful${NC}"
            
            # Copy backend build if dist/ exists
            if [ -d "dist" ]; then
                mkdir -p "${DEPLOY_DIR}/backend"
                cp -r dist/* "${DEPLOY_DIR}/backend/"
                echo "  ${GREEN}✓ Backend artifacts copied${NC}"
            fi
        else
            echo "  ${YELLOW}⚠ Backend build failed or skipped${NC}"
        fi
    else
        echo "  ${GREEN}✓ Backend (no build step - runs directly)${NC}"
    fi
    cd - >/dev/null
fi

# Python Automation Service (check for requirements)
if [ -f "${PROJECT_DIR}/rpa-system/automation/automation-service/requirements.txt" ]; then
    echo "  Checking Python automation service..."
    echo "  ${GREEN}✓ Python service ready (no build step)${NC}"
    
    # Copy Python service files
    mkdir -p "${DEPLOY_DIR}/automation"
    cp -r "${PROJECT_DIR}/rpa-system/automation/automation-service"/* "${DEPLOY_DIR}/automation/" 2>/dev/null || true
    echo "  ${GREEN}✓ Automation service files copied${NC}"
fi

echo "\n${BLUE}Step 2: Creating deployment metadata...${NC}"

# Create deployment info file
cat > "${DEPLOY_DIR}/.deploy-info" <<EOF
EasyFlow Deployment Information
===============================
Deployment Time: ${TIMESTAMP}
Project Directory: ${PROJECT_DIR}
Deploy Directory: ${DEPLOY_DIR}

Services:
- Frontend: ${GREEN}$([ -d "${DEPLOY_DIR}/frontend" ] && echo "✓ Deployed" || echo "✗ Not deployed")${NC}
- Backend: ${GREEN}$([ -d "${DEPLOY_DIR}/backend" ] && echo "✓ Deployed" || echo "✗ Not deployed")${NC}
- Automation: ${GREEN}$([ -d "${DEPLOY_DIR}/automation" ] && echo "✓ Deployed" || echo "✗ Not deployed")${NC}

Next Steps:
1. Review deployment artifacts in: ${DEPLOY_DIR}
2. For production deployment, use:
   - PM2: pm2 start ecosystem.config.js
   - Docker: docker-compose up -d
   - Cloud: Deploy to your cloud provider

Note: This is a simulation. For actual deployment, use your CI/CD pipeline.
EOF

echo "  ${GREEN}✓ Deployment metadata created${NC}"

echo "\n${BLUE}Step 3: Deployment summary...${NC}"
echo "  Deploy directory: ${GREEN}${DEPLOY_DIR}${NC}"
echo "  Deployment info: ${GREEN}${DEPLOY_DIR}/.deploy-info${NC}"

# List deployed artifacts
echo "\n${BLUE}Deployed Artifacts:${NC}"
if [ -d "${DEPLOY_DIR}/frontend" ]; then
    echo "  ${GREEN}✓ Frontend${NC} (${DEPLOY_DIR}/frontend)"
fi
if [ -d "${DEPLOY_DIR}/backend" ]; then
    echo "  ${GREEN}✓ Backend${NC} (${DEPLOY_DIR}/backend)"
fi
if [ -d "${DEPLOY_DIR}/automation" ]; then
    echo "  ${GREEN}✓ Automation Service${NC} (${DEPLOY_DIR}/automation)"
fi

echo "\n${GREEN}✅ Deployment simulation complete!${NC}"
echo "\n${YELLOW}Note:${NC} This is a simulation. For actual deployment:"
echo "  - Use PM2: ${BLUE}pm2 start ecosystem.config.js${NC}"
echo "  - Use Docker: ${BLUE}docker-compose up -d${NC}"
echo "  - Or deploy to your cloud provider"

