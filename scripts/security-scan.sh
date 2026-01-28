#!/bin/sh
# EasyFlow Security Scan with Snyk
# Scans code and dependencies for security vulnerabilities before code reaches public
# Adapted from workspace security best practices

set -e

# CI/structured logging helpers
IS_GITHUB_ACTIONS="${GITHUB_ACTIONS:-}"
IS_CI="${CI:-}"
LOG_FORMAT="${CI_LOG_FORMAT:-text}" # text | json

ts_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

log_json() {
  # Usage: log_json <level> <event> <message>
  printf '{"ts":"%s","level":"%s","event":"%s","msg":%s}\n' \
    "$(ts_utc)" "$1" "$2" "$(printf '%s' "$3" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$3")"
}

log_text() {
  # Usage: log_text <level> <message>
  printf '[%s] %-5s %s\n' "$(ts_utc)" "$1" "$2"
}

log() {
  # Usage: log <level> <event> <message>
  if [ "$LOG_FORMAT" = "json" ]; then
    log_json "$1" "$2" "$3"
  else
    log_text "$1" "$3"
  fi
}

group_start() {
  # Usage: group_start <title>
  if [ -n "$IS_GITHUB_ACTIONS" ]; then
    echo "::group::$1"
  else
    log "INFO" "group" "▶ $1"
  fi
}

group_end() {
  if [ -n "$IS_GITHUB_ACTIONS" ]; then
    echo "::endgroup::"
  fi
}

run_with_heartbeat() {
  # Usage: run_with_heartbeat <heartbeat_seconds> <title> <command...>
  # Runs command; while running, prints periodic heartbeat so CI logs never go silent.
  local interval="$1"
  local title="$2"
  shift 2

  group_start "$title"
  log "INFO" "cmd.start" "$title"

  # Run in background so we can heartbeat.
  "$@" &
  local pid=$!

  while kill -0 "$pid" >/dev/null 2>&1; do
    sleep "$interval"
    if kill -0 "$pid" >/dev/null 2>&1; then
      log "INFO" "cmd.heartbeat" "$title still running..."
    fi
  done

  wait "$pid"
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    log "INFO" "cmd.end" "$title completed"
  else
    log "WARN" "cmd.end" "$title completed with exit $exit_code"
  fi
  group_end
  return $exit_code
}

# Colors (disable in CI so logs are readable/parsable)
if [ -n "$IS_GITHUB_ACTIONS" ] || [ -n "$IS_CI" ]; then
  GREEN=""
  YELLOW=""
  RED=""
  BLUE=""
  NC=""
else
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  BLUE='\033[0;34m'
  NC='\033[0m'
fi

echo "${BLUE}=== EasyFlow Security Scan (Snyk) ===${NC}\n"

# Check if Snyk CLI is available
if ! command -v snyk >/dev/null 2>&1; then
    log "WARN" "snyk.missing" "Snyk CLI not found. Installing..."
    npm install -g snyk
fi

# Check if authenticated
if ! snyk auth status >/dev/null 2>&1; then
    # In CI/CD, try to use token from environment
    if [ -n "$SNYK_TOKEN" ]; then
        log "INFO" "snyk.auth" "Using SNYK_TOKEN from environment..."
        snyk config set api="$SNYK_TOKEN" >/dev/null 2>&1 || true
        # Verify authentication worked
        if ! snyk auth status >/dev/null 2>&1; then
            log "ERROR" "snyk.auth" "Snyk authentication failed with SNYK_TOKEN (check validity)"
            exit 1
        fi
    else
        log "WARN" "snyk.auth" "Snyk not authenticated. Set SNYK_TOKEN for CI/CD or run 'snyk auth' locally."
        # In local dev, don't block if not authenticated (user can run manually)
        # In CI/CD, this should fail (SNYK_TOKEN should be set)
        if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
            log "ERROR" "snyk.auth" "Snyk authentication required in CI/CD"
            exit 1
        else
            log "INFO" "snyk.auth" "Skipping security scan in local dev (non-blocking)"
            exit 0  # Non-blocking in local dev
        fi
    fi
fi

SCAN_FAILED=0
SEVERITY_THRESHOLD="${SNYK_SEVERITY_THRESHOLD:-high}"  # Default to 'high', can be set to 'critical' for stricter

log "INFO" "scan.start" "Scanning for vulnerabilities (threshold: ${SEVERITY_THRESHOLD})"

# Scan Backend (Node.js)
if [ -f "rpa-system/backend/package.json" ]; then
    group_start "Snyk deps: backend"
    log "INFO" "scan.backend" "Scanning backend dependencies"
    cd rpa-system/backend
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-backend.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-backend.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            log "WARN" "scan.backend" "Backend: Found vulnerabilities (showing details)"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            log "INFO" "scan.backend" "Backend: No ${SEVERITY_THRESHOLD}+ vulnerabilities found"
        fi
    else
        log "WARN" "scan.backend" "Backend: Snyk scan completed with warnings"
    fi
    cd ../..
    group_end
fi

# Scan Frontend (React)
if [ -f "rpa-system/rpa-dashboard/package.json" ]; then
    group_start "Snyk deps: frontend"
    log "INFO" "scan.frontend" "Scanning frontend dependencies"
    cd rpa-system/rpa-dashboard
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --json >/tmp/snyk-frontend.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-frontend.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            log "WARN" "scan.frontend" "Frontend: Found vulnerabilities (showing details)"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            log "INFO" "scan.frontend" "Frontend: No ${SEVERITY_THRESHOLD}+ vulnerabilities found"
        fi
    else
        log "WARN" "scan.frontend" "Frontend: Snyk scan completed with warnings"
    fi
    cd ../..
    group_end
fi

# Scan Python dependencies (if requirements.txt exists)
if [ -f "rpa-system/automation/automation-service/requirements.txt" ]; then
    group_start "Snyk deps: python"
    log "INFO" "scan.python" "Scanning Python dependencies"
    cd rpa-system/automation/automation-service
    if snyk test --severity-threshold="$SEVERITY_THRESHOLD" --file=requirements.txt --json >/tmp/snyk-python.json 2>&1 || true; then
        VULNS=$(cat /tmp/snyk-python.json 2>/dev/null | grep -o '"vulnerabilities":\[[^]]*\]' | grep -o 'vulnerabilities' | wc -l || echo "0")
        if [ "$VULNS" -gt 0 ]; then
            log "WARN" "scan.python" "Python: Found vulnerabilities (showing details)"
            snyk test --severity-threshold="$SEVERITY_THRESHOLD" --file=requirements.txt || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            log "INFO" "scan.python" "Python: No ${SEVERITY_THRESHOLD}+ vulnerabilities found"
        fi
    else
        log "WARN" "scan.python" "Python: Snyk scan completed with warnings"
    fi
    cd ../../..
    group_end
fi

# Scan code for security issues (SAST - Static Application Security Testing)
# Scan the ENTIRE codebase - no loose ends!
group_start "Snyk code (SAST)"
log "INFO" "scan.code" "Scanning entire codebase for security issues (SAST)"
log "INFO" "scan.code" "Scanning: rpa-system/, scripts/, migrations/, .github/, root config files"

# Known false positive files (placeholder strings in error messages, not actual secrets)
FALSE_POSITIVE_FILES="rpa-system/rpa-dashboard/public/firebase-messaging-sw.js rpa-system/rpa-dashboard/vercel-scripts/generate-firebase-config.js"

# Scan from root to cover entire codebase.
# NOTE: This can be slow and sometimes produces no output for long stretches.
# We run it with a heartbeat to keep CI logs alive.
if run_with_heartbeat 20 "Snyk code test (may take a while)" snyk code test --severity-threshold="$SEVERITY_THRESHOLD" --json --sarif-file-output=/tmp/snyk-code.sarif > /tmp/snyk-code.json 2>&1 || true; then
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
                log "INFO" "scan.code" "Code: No ${SEVERITY_THRESHOLD}+ security issues found (only false positives from error messages)"
            else
                log "WARN" "scan.code" "Code: Found $ISSUES_COUNT security issue(s) (showing details)"
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
                log "INFO" "scan.code" "Code: No ${SEVERITY_THRESHOLD}+ security issues found (only false positives from error messages)"
            else
                log "WARN" "scan.code" "Code: Found $ISSUES_COUNT security issue(s) (showing details)"
                snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
            fi
        fi
    else
        # Also check for runs array with issues
        HAS_ISSUES=$(cat /tmp/snyk-code.json 2>/dev/null | grep -o '"runs":\s*\[[^]]*\]' | grep -v '\[\]' | wc -l || echo "0")
        if [ "$HAS_ISSUES" -gt 0 ]; then
            log "WARN" "scan.code" "Code: Found security issues (showing details)"
            snyk code test --severity-threshold="$SEVERITY_THRESHOLD" || SCAN_FAILED=$((SCAN_FAILED + 1))
        else
            log "INFO" "scan.code" "Code: No ${SEVERITY_THRESHOLD}+ security issues found in entire codebase"
        fi
    fi
else
    log "WARN" "scan.code" "Snyk code scan completed with warnings"
    # Still try to run it to show output
    snyk code test --severity-threshold="$SEVERITY_THRESHOLD" 2>&1 || true
fi
group_end

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

log "INFO" "scan.summary" "=== Security Scan Summary ==="

if [ $SCAN_FAILED -eq 0 ]; then
    log "INFO" "scan.summary" "Security scan passed: no ${SEVERITY_THRESHOLD}+ vulnerabilities found"
    exit 0
else
    log "ERROR" "scan.summary" "Security scan failed: found ${SEVERITY_THRESHOLD}+ vulnerabilities"
    log "ERROR" "scan.summary" "Fix vulnerabilities before pushing public code"
    exit 1
fi

