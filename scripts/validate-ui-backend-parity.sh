#!/bin/bash
# Validate UI/Backend Feature Parity
# 
# Checks that:
# 1. Backend API endpoints have corresponding UI implementations
# 2. Frontend API calls reference existing backend endpoints
# 3. UI components are properly implemented and call backend APIs
#
# Exit codes:
#   0 = All checks passed
#   1 = Critical issues found (blocking in strict mode)
#   2 = Warnings found (non-blocking in permissive mode)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get validation mode from environment (set by CI/CD)
STRICT_MODE="${STRICT_MODE:-false}"
if [ "$STRICT_MODE" = "true" ] || [ "$STRICT_MODE" = "1" ]; then
  IS_STRICT=true
else
  IS_STRICT=false
fi

# Counters
ERRORS=0
WARNINGS=0
UNUSED_ENDPOINTS=0
BROKEN_UI_CALLS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 VALIDATING UI/BACKEND FEATURE PARITY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Mode: ${IS_STRICT}${NC} (${IS_STRICT} = strict/blocking, false = permissive/warnings only)"
echo ""

# Temporary files
BACKEND_ROUTES_FILE=$(mktemp)
FRONTEND_CALLS_FILE=$(mktemp)
trap "rm -f $BACKEND_ROUTES_FILE $FRONTEND_CALLS_FILE" EXIT

# ============================================================================
# 1. Extract Backend API Routes
# ============================================================================
echo -e "${BLUE}📋 Step 1: Extracting backend API routes...${NC}"

if [ ! -d "rpa-system/backend/routes" ] && [ ! -f "rpa-system/backend/app.js" ]; then
  echo -e "${YELLOW}⚠ Backend directory not found, skipping backend route extraction${NC}"
else
  # Extract routes from route files
  if [ -d "rpa-system/backend/routes" ]; then
    find rpa-system/backend/routes -name "*.js" -type f 2>/dev/null | while read -r file; do
      # Extract router.get, router.post, router.put, router.delete, router.patch patterns
      grep -hE "router\.(get|post|put|delete|patch|all)\s*\(" "$file" 2>/dev/null | \
        sed -E "s/.*router\.(get|post|put|delete|patch|all)\s*\(\s*['\"]([^'\"]+)['\"].*/\1 \2/" | \
        while read -r method path; do
          if [ -n "$method" ] && [ -n "$path" ]; then
            # Normalize path (remove :param to match patterns)
            normalized_path=$(echo "$path" | sed 's/:[a-zA-Z0-9_]*/{param}/g')
            echo "$method $normalized_path $file" >> "$BACKEND_ROUTES_FILE"
          fi
        done
    done
  fi
  
  # Extract routes from app.js
  if [ -f "rpa-system/backend/app.js" ]; then
    grep -hE "app\.(get|post|put|delete|patch|all)\s*\(" rpa-system/backend/app.js 2>/dev/null | \
      sed -E "s/.*app\.(get|post|put|delete|patch|all)\s*\(\s*['\"]([^'\"]+)['\"].*/\1 \2/" | \
      while read -r method path; do
        if [ -n "$method" ] && [ -n "$path" ]; then
          normalized_path=$(echo "$path" | sed 's/:[a-zA-Z0-9_]*/{param}/g')
          echo "$method $normalized_path rpa-system/backend/app.js" >> "$BACKEND_ROUTES_FILE"
        fi
      done
  fi
fi

BACKEND_ROUTES_COUNT=$(wc -l < "$BACKEND_ROUTES_FILE" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✓ Found ${BACKEND_ROUTES_COUNT} backend API routes${NC}"
echo ""

# ============================================================================
# 2. Extract Frontend API Calls
# ============================================================================
echo -e "${BLUE}📋 Step 2: Extracting frontend API calls...${NC}"

if [ ! -d "rpa-system/rpa-dashboard/src" ]; then
  echo -e "${YELLOW}⚠ Frontend directory not found, skipping frontend API call extraction${NC}"
else
  # Find all JS/JSX/TS/TSX files in frontend
  find rpa-system/rpa-dashboard/src -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | \
    grep -v node_modules | grep -v ".test." | grep -v ".spec." | while read -r file; do
      
      # Extract api.get('/api/...'), api.post('/api/...'), etc.
      grep -hE "(api|fetch|axios)\.(get|post|put|delete|patch)[[:space:]]*\(" "$file" 2>/dev/null | \
        sed -E "s|.*(api|fetch|axios)\.(get|post|put|delete|patch)[[:space:]]*\([[:space:]]*['\"\`]([^'\"\`]+)['\"\`].*|\2 \3|" | \
        while read -r method path; do
          if [ -n "$method" ] && [ -n "$path" ]; then
            # Extract API path (remove base URL if present)
            api_path=$(echo "$path" | sed -E "s|^https?://[^/]+||" | sed -E "s|^\$?\{.*baseURL.*\}||")
            if echo "$api_path" | grep -q "^/api/"; then
              # Normalize path (UUIDs and numbers to {id})
              normalized_path=$(echo "$api_path" | sed 's/[0-9a-fA-F]\{8\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{12\}/{id}/g' | sed 's/[0-9]\+/{id}/g')
              echo "$method $normalized_path $file" >> "$FRONTEND_CALLS_FILE"
            fi
          fi
        done
      
      # Also extract fetch('/api/...') calls
      grep -hE "fetch[[:space:]]*\([[:space:]]*['\"\`]/api/" "$file" 2>/dev/null | \
        sed -E "s|.*fetch[[:space:]]*\([[:space:]]*['\"\`]([^'\"\`]+)['\"\`].*|\1|" | \
        while read -r url; do
          if [ -n "$url" ] && echo "$url" | grep -q "^/api/"; then
            # Try to determine method from context (look for POST, PUT, DELETE in surrounding lines)
            method="get"  # Default
            normalized_path=$(echo "$url" | sed 's/[0-9a-fA-F]\{8\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{4\}-[0-9a-fA-F]\{12\}/{id}/g' | sed 's/[0-9]\+/{id}/g')
            echo "$method $normalized_path $file" >> "$FRONTEND_CALLS_FILE"
          fi
        done
  done
fi

FRONTEND_CALLS_COUNT=$(wc -l < "$FRONTEND_CALLS_FILE" 2>/dev/null | tr -d ' ' || echo "0")
echo -e "${GREEN}✓ Found ${FRONTEND_CALLS_COUNT} frontend API calls${NC}"
echo ""

# ============================================================================
# 3. Check for Backend Endpoints Without UI Usage
# ============================================================================
echo -e "${BLUE}📋 Step 3: Checking for backend endpoints without UI usage...${NC}"

# Skip internal/health endpoints that don't need UI
INTERNAL_PATTERNS="/health /metrics /healthz /status /api/health /api/metrics"

if [ -s "$BACKEND_ROUTES_FILE" ] && [ -s "$FRONTEND_CALLS_FILE" ]; then
  while IFS= read -r backend_route; do
    method=$(echo "$backend_route" | awk '{print $1}')
    path=$(echo "$backend_route" | awk '{print $2}')
    file=$(echo "$backend_route" | awk '{print $3}')
    
    # Skip internal endpoints
    is_internal=false
    for pattern in $INTERNAL_PATTERNS; do
      if echo "$path" | grep -q "$pattern"; then
        is_internal=true
        break
      fi
    done
    [ "$is_internal" = true ] && continue
    
    # Check if this endpoint is called from frontend
    if ! grep -q "$path" "$FRONTEND_CALLS_FILE" 2>/dev/null; then
      # Check if path matches any frontend call (with parameter normalization)
      matched=false
      while IFS= read -r frontend_call; do
        frontend_path=$(echo "$frontend_call" | awk '{print $2}')
        # Simple pattern matching (could be improved)
        if [ "$path" = "$frontend_path" ]; then
          matched=true
          break
        fi
      done < "$FRONTEND_CALLS_FILE"
      
      if [ "$matched" = false ]; then
        UNUSED_ENDPOINTS=$((UNUSED_ENDPOINTS + 1))
        if [ "$IS_STRICT" = true ]; then
          echo -e "${RED}✗ Backend endpoint not used in UI: ${method} ${path}${NC}"
          echo -e "  ${YELLOW}  Location: $file${NC}"
          ERRORS=$((ERRORS + 1))
        else
          echo -e "${YELLOW}⚠ Backend endpoint not used in UI: ${method} ${path}${NC}"
          echo -e "  ${CYAN}  Location: $file${NC}"
          WARNINGS=$((WARNINGS + 1))
        fi
      fi
    fi
  done < "$BACKEND_ROUTES_FILE"
fi

if [ $UNUSED_ENDPOINTS -eq 0 ]; then
  echo -e "${GREEN}✓ All backend endpoints have UI usage${NC}"
fi
echo ""

# ============================================================================
# 4. Check for Frontend Calls to Non-Existent Endpoints
# ============================================================================
echo -e "${BLUE}📋 Step 4: Checking for frontend calls to non-existent endpoints...${NC}"

if [ -s "$FRONTEND_CALLS_FILE" ] && [ -s "$BACKEND_ROUTES_FILE" ]; then
  while IFS= read -r frontend_call; do
    method=$(echo "$frontend_call" | awk '{print $1}')
    path=$(echo "$frontend_call" | awk '{print $2}')
    file=$(echo "$frontend_call" | awk '{print $3}')
    
    # Skip internal endpoints
    is_internal=false
    for pattern in $INTERNAL_PATTERNS; do
      if echo "$path" | grep -q "$pattern"; then
        is_internal=true
        break
      fi
    done
    [ "$is_internal" = true ] && continue
    
    # Check if this endpoint exists in backend
    if ! grep -q "$path" "$BACKEND_ROUTES_FILE" 2>/dev/null; then
      # Check if path matches any backend route (with parameter normalization)
      matched=false
      while IFS= read -r backend_route; do
        backend_path=$(echo "$backend_route" | awk '{print $2}')
        backend_method=$(echo "$backend_route" | awk '{print $1}')
        # Simple pattern matching
        if [ "$path" = "$backend_path" ] && [ "$method" = "$backend_method" ]; then
          matched=true
          break
        fi
      done < "$BACKEND_ROUTES_FILE"
      
      if [ "$matched" = false ]; then
        BROKEN_UI_CALLS=$((BROKEN_UI_CALLS + 1))
        if [ "$IS_STRICT" = true ]; then
          echo -e "${RED}✗ Frontend calls non-existent endpoint: ${method} ${path}${NC}"
          echo -e "  ${YELLOW}  Location: $file${NC}"
          ERRORS=$((ERRORS + 1))
        else
          echo -e "${YELLOW}⚠ Frontend calls potentially non-existent endpoint: ${method} ${path}${NC}"
          echo -e "  ${CYAN}  Location: $file${NC}"
          WARNINGS=$((WARNINGS + 1))
        fi
      fi
    fi
  done < "$FRONTEND_CALLS_FILE"
fi

if [ $BROKEN_UI_CALLS -eq 0 ]; then
  echo -e "${GREEN}✓ All frontend API calls reference existing endpoints${NC}"
fi
echo ""

# ============================================================================
# 5. Summary
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 VALIDATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Backend routes found: ${CYAN}${BACKEND_ROUTES_COUNT}${NC}"
echo -e "Frontend API calls found: ${CYAN}${FRONTEND_CALLS_COUNT}${NC}"
echo -e "Unused backend endpoints: ${YELLOW}${UNUSED_ENDPOINTS}${NC}"
echo -e "Broken frontend calls: ${YELLOW}${BROKEN_UI_CALLS}${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Validation failed with ${ERRORS} error(s)${NC}"
  if [ "$IS_STRICT" = true ]; then
    echo -e "${RED}   This is blocking in strict mode (main branch)${NC}"
    exit 1
  else
    echo -e "${YELLOW}   This is non-blocking in permissive mode (dev branch)${NC}"
    exit 0
  fi
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with ${WARNINGS} warning(s)${NC}"
  if [ "$IS_STRICT" = true ]; then
    echo -e "${RED}   Warnings are treated as errors in strict mode (main branch)${NC}"
    exit 1
  else
    echo -e "${GREEN}   Warnings are allowed in permissive mode (dev branch)${NC}"
    exit 0
  fi
else
  echo -e "${GREEN}✅ All UI/Backend feature parity checks passed!${NC}"
  exit 0
fi
