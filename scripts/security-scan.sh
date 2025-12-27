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
    # In CI/CD, try to use token from environment
    if [ -n "$SNYK_TOKEN" ]; then
        echo "${BLUE}Using SNYK_TOKEN from environment...${NC}"
        snyk config set api="$SNYK_TOKEN" >/dev/null 2>&1 || true
        # Verify authentication worked
        if ! snyk auth status >/dev/null 2>&1; then
            echo "${RED}✗ Snyk authentication failed with SNYK_TOKEN${NC}"
            echo "${YELLOW}  Check that SNYK_TOKEN is valid${NC}"
            exit 1
        fi
    else
        echo "${YELLOW}⚠ Snyk not authenticated. Please run: snyk auth${NC}"
        echo "${YELLOW}  Or set SNYK_TOKEN environment variable${NC}"
        echo "${YELLOW}  For CI/CD, set SNYK_TOKEN as a GitHub secret${NC}"
        echo "${YELLOW}  Skipping security scan (non-blocking in local dev)${NC}"
        # In local dev, don't block if not authenticated (user can run manually)
        # In CI/CD, this should fail (SNYK_TOKEN should be set)
        if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
            echo "${RED}✗ Snyk authentication required in CI/CD${NC}"
            exit 1
        else
            echo "${YELLOW}  Run 'npm run security:scan' manually after authenticating${NC}"
            exit 0  # Non-blocking in local dev
        fi
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
# Scan the ENTIRE codebase - no loose ends!
echo "\n${BLUE}Scanning entire codebase for security issues (SAST)...${NC}"
echo "  Scanning: rpa-system/, scripts/, migrations/, .github/, root config files"

# Known false positive files (placeholder strings in error messages, not actual secrets)
FALSE_POSITIVE_FILES="rpa-system/rpa-dashboard/public/firebase-messaging-sw.js rpa-system/rpa-dashboard/vercel-scripts/generate-firebase-config.js"

# Scan from root to cover entire codebase
# Snyk code test automatically scans all supported file types (JS, JSX, TS, TSX, Python, etc.)
# and all directories by default when run from root
if snyk code test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-code.json 2>&1 || true; then
    # Extract actual issue files using jq if available, otherwise use grep
    if command -v jq >/dev/null 2>&1; then
        # Use jq to extract unique file paths from error-level issues (remove quotes)
        ACTUAL_ISSUE_FILES=$(cat /tmp/snyk-code.json 2>/dev/null | jq -r '.runs[0].results[]? | select(.level == "error") | .locations[0].physicalLocation.artifactLocation.uri' 2>/dev/null | sort -u | grep -v '^$' || echo "")
        ISSUES_COUNT=$(echo "$ACTUAL_ISSUE_FILES" | grep -v '^$' | wc -l | tr -d ' ')
    else
        # Fallback: use grep to count issues
        ISSUES_COUNT=$(cat /tmp/snyk-code.json 2>/dev/null | grep -o '"total":\s*[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
        ACTUAL_ISSUE_FILES=""
    fi
    
    # Filter out false positives by checking if issues are only from known false positive files
    if [ -n "$ISSUES_COUNT" ] && [ "$ISSUES_COUNT" -gt 0 ]; then
        if [ -n "$ACTUAL_ISSUE_FILES" ]; then
            # Check if all issue files are in the false positive list
            ALL_FALSE_POSITIVES=true
            for issue_file in $ACTUAL_ISSUE_FILES; do
                IS_FALSE_POSITIVE=false
                for false_file in $FALSE_POSITIVE_FILES; do
                    if echo "$issue_file" | grep -q "$false_file"; then
                        IS_FALSE_POSITIVE=true
                        break
                    fi
                done
                if [ "$IS_FALSE_POSITIVE" = false ]; then
                    ALL_FALSE_POSITIVES=false
                    break
                fi
            done
            
            if [ "$ALL_FALSE_POSITIVES" = true ]; then
                echo "  ${GREEN}✓ Code: No ${SEVERITY_THRESHOLD}+ security issues found (only false positives from error messages)${NC}"
            else
                echo "  ${YELLOW}⚠ Code: Found $ISSUES_COUNT security issue(s) (see details below)${NC}"
                snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
            fi
        else
            # Fallback: use grep to check if all issues are from false positive files
            FALSE_POSITIVE_COUNT=0
            for false_file in $FALSE_POSITIVE_FILES; do
                FILE_ISSUES=$(cat /tmp/snyk-code.json 2>/dev/null | grep -c "$false_file" || echo "0")
                if [ "$FILE_ISSUES" -gt 0 ]; then
                    FALSE_POSITIVE_COUNT=$((FALSE_POSITIVE_COUNT + 1))
                fi
            done
            
            if [ "$FALSE_POSITIVE_COUNT" -ge "$ISSUES_COUNT" ] && [ "$ISSUES_COUNT" -gt 0 ]; then
                echo "  ${GREEN}✓ Code: No ${SEVERITY_THRESHOLD}+ security issues found (only false positives from error messages)${NC}"
            else
                echo "  ${YELLOW}⚠ Code: Found $ISSUES_COUNT security issue(s) (see details below)${NC}"
                snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
            fi
        fi
    else
        # Also check for runs array with issues
        HAS_ISSUES=$(cat /tmp/snyk-code.json 2>/dev/null | grep -o '"runs":\s*\[[^]]*\]' | grep -v '\[\]' | wc -l || echo "0")
        if [ "$HAS_ISSUES" -gt 0 ]; then
            echo "  ${YELLOW}⚠ Code: Found security issues (see details below)${NC}"
            snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            echo "  ${GREEN}✓ Code: No ${SEVERITY_THRESHOLD}+ security issues found in entire codebase${NC}"
        fi
    fi
else
    echo "  ${YELLOW}⚠ Code: Snyk code scan completed with warnings${NC}"
    # Still try to run it to show output
    snyk code test --severity-threshold="$SEVERITY_THRESHOLD" 2>&1 || true
fi

# Scan Terraform Infrastructure (if exists)
if [ -d "infrastructure" ] && [ -f "infrastructure/main.tf" ]; then
    echo "\n${BLUE}Scanning Terraform infrastructure for security issues...${NC}"
    cd infrastructure
    
    # Use Checkov for Terraform security scanning (if available)
    if command -v checkov >/dev/null 2>&1 || pip3 list 2>/dev/null | grep -q checkov; then
        echo "  Running Checkov security scan..."
        if checkov -d . --framework terraform --quiet --compact 2>&1 | tee /tmp/checkov-terraform.txt; then
            echo "  ${GREEN}✓ Terraform: Security scan completed${NC}"
        else
            CHECKOV_ISSUES=$(grep -c "PASSED\|FAILED" /tmp/checkov-terraform.txt 2>/dev/null || echo "0")
            if [ "$CHECKOV_ISSUES" -gt 0 ]; then
                echo "  ${YELLOW}⚠ Terraform: Security issues found (see details above)${NC}"
                SCAN_FAILED=$((SCAN_FAILED + 1))
            else
                echo "  ${GREEN}✓ Terraform: No security issues found${NC}"
            fi
        fi
        rm -f /tmp/checkov-terraform.txt
    else
        echo "  ${YELLOW}○ Checkov not installed - skipping Terraform security scan${NC}"
        echo "    Install: pip install checkov"
        echo "    Or run manually: checkov -d infrastructure --framework terraform"
    fi
    
    # Also try Snyk for Terraform (if supported)
    if snyk iac test infrastructure --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-terraform.json 2>&1 || true; then
        TERRAFORM_ISSUES=$(cat /tmp/snyk-terraform.json 2>/dev/null | grep -o '"total":\s*[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
        if [ -n "$TERRAFORM_ISSUES" ] && [ "$TERRAFORM_ISSUES" -gt 0 ]; then
            echo "  ${YELLOW}⚠ Terraform (Snyk): Found $TERRAFORM_ISSUES security issue(s)${NC}"
            snyk iac test infrastructure --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            echo "  ${GREEN}✓ Terraform (Snyk): No ${SEVERITY_THRESHOLD}+ security issues found${NC}"
        fi
    fi
    rm -f /tmp/snyk-terraform.json
    cd ..
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

