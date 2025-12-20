#!/bin/sh
# EasyFlow Security Scan with Snyk
# Scans code and dependencies for security vulnerabilities before code reaches public
# Adapted from workspace security best practices

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Security Scan (Snyk) ===${NC}\n"

# Check if Snyk CLI is available
if ! command -v snyk >/dev/null 2>&1; then
    echo "${YELLOW}⚠ Snyk CLI not found. Installing...${NC}"
    npm install -g snyk
fi

# Check if authenticated
if ! snyk auth status >/dev/null 2>&1; then
    echo "${YELLOW}⚠ Snyk not authenticated. Please run: snyk auth${NC}"
    echo "${YELLOW}  Or set SNYK_TOKEN environment variable${NC}"
    echo "${YELLOW}  For CI/CD, set SNYK_TOKEN as a GitHub secret${NC}"
    
    # In CI/CD, try to use token from environment
    if [ -n "$SNYK_TOKEN" ]; then
        echo "${BLUE}Using SNYK_TOKEN from environment...${NC}"
        snyk config set api="$SNYK_TOKEN" >/dev/null 2>&1 || true
    else
        echo "${RED}✗ Snyk authentication required${NC}"
        echo "${YELLOW}  Run 'snyk auth' locally or set SNYK_TOKEN in CI/CD${NC}"
        exit 1
    fi
fi

SCAN_FAILED=0
SEVERITY_THRESHOLD="${SNYK_SEVERITY_THRESHOLD:-high}"  # Default to 'high', can be set to 'critical' for stricter

echo "${BLUE}Scanning for vulnerabilities (threshold: ${SEVERITY_THRESHOLD})...${NC}\n"

# Scan Backend (Node.js)
if [ -f "rpa-system/backend/package.json" ]; then
    echo "${BLUE}Scanning backend dependencies...${NC}"
    cd rpa-system/backend
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-backend.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-backend.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            echo "  ${YELLOW}⚠ Backend: Found vulnerabilities (see details below)${NC}"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            echo "  ${GREEN}✓ Backend: No ${SEVERITY_THRESHOLD}+ vulnerabilities found${NC}"
        fi
    else
        echo "  ${YELLOW}⚠ Backend: Snyk scan completed with warnings${NC}"
    fi
    cd ../..
fi

# Scan Frontend (React)
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    echo "\n${BLUE}Scanning frontend dependencies...${NC}"
    cd rpa-system/rpa-dashboard
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-frontend.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-frontend.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            echo "  ${YELLOW}⚠ Frontend: Found vulnerabilities (see details below)${NC}"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            echo "  ${GREEN}✓ Frontend: No ${SEVERITY_THRESHOLD}+ vulnerabilities found${NC}"
        fi
    else
        echo "  ${YELLOW}⚠ Frontend: Snyk scan completed with warnings${NC}"
    fi
    cd ../..
fi

# Scan Python dependencies (if requirements.txt exists)
if [ -f "rpa-system/automation/automation-service/requirements.txt" ]; then
    echo "\n${BLUE}Scanning Python dependencies...${NC}"
    cd rpa-system/automation/automation-service
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --file=requirements.txt --json >/tmp/snyk-python.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-python.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            echo "  ${YELLOW}⚠ Python: Found vulnerabilities (see details below)${NC}"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" --file=requirements.txt || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            echo "  ${GREEN}✓ Python: No ${SEVERITY_THRESHOLD}+ vulnerabilities found${NC}"
        fi
    else
        echo "  ${YELLOW}⚠ Python: Snyk scan completed with warnings${NC}"
    fi
    cd ../../..
fi

# Scan code for security issues (SAST - Static Application Security Testing)
echo "\n${BLUE}Scanning code for security issues (SAST)...${NC}"
if snyk code test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-code.json 2>&1 || true; then
    ISSUES=$(cat /tmp/snyk-code.json 2>/dev/null | grep -o '"runs":\[[^]]*\]' | grep -o 'runs' | wc -l || echo "0")
    if [ "$ISSUES" -gt 0 ]; then
        echo "  ${YELLOW}⚠ Code: Found security issues (see details below)${NC}"
        snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
    else
        echo "  ${GREEN}✓ Code: No ${SEVERITY_THRESHOLD}+ security issues found${NC}"
    fi
else
    echo "  ${YELLOW}⚠ Code: Snyk code scan completed with warnings${NC}"
fi

# Cleanup temp files
rm -f /tmp/snyk-*.json

echo "\n${BLUE}=== Security Scan Summary ===${NC}"

if [ $SCAN_FAILED -eq 0 ]; then
    echo "${GREEN}✅ Security scan passed! No ${SEVERITY_THRESHOLD}+ vulnerabilities found.${NC}"
    exit 0
else
    echo "${RED}❌ Security scan failed! Found ${SEVERITY_THRESHOLD}+ vulnerabilities.${NC}"
    echo "${YELLOW}  Please fix vulnerabilities before pushing to public.${NC}"
    echo "${YELLOW}  Run 'snyk test' in each directory for detailed information.${NC}"
    exit 1
fi

