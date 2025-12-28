#!/usr/bin/env bash
# Verify that critical fixes have been applied

set -e

echo "🔍 Verifying Critical Fixes..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Fix #1: Logger imports
echo "📋 Fix #1: Logger Reference Errors"
echo "-----------------------------------"

NOTIFICATION_SERVICE="/Users/ky/Easy-Flow/rpa-system/rpa-dashboard/src/utils/notificationService.js"
BULK_PROCESSOR="/Users/ky/Easy-Flow/rpa-system/rpa-dashboard/src/components/BulkProcessor/BulkInvoiceProcessor.jsx"

if [ -f "$NOTIFICATION_SERVICE" ]; then
    if grep -q "import.*logger\|const logger.*createLogger" "$NOTIFICATION_SERVICE"; then
        echo -e "${GREEN}✅ notificationService.js has logger import${NC}"
    else
        echo -e "${RED}❌ notificationService.js missing logger import${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  notificationService.js not found${NC}"
fi

if [ -f "$BULK_PROCESSOR" ]; then
    if grep -q "import.*logger\|const logger.*createLogger" "$BULK_PROCESSOR"; then
        echo -e "${GREEN}✅ BulkInvoiceProcessor.jsx has logger import${NC}"
    else
        echo -e "${RED}❌ BulkInvoiceProcessor.jsx missing logger import${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "import.*api" "$BULK_PROCESSOR"; then
        echo -e "${GREEN}✅ BulkInvoiceProcessor.jsx has api import${NC}"
    else
        echo -e "${RED}❌ BulkInvoiceProcessor.jsx missing api import${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  BulkInvoiceProcessor.jsx not found${NC}"
fi

echo ""

# Fix #2: Backend OAuth config
echo "📋 Fix #2: Backend OAuth Configuration"
echo "-----------------------------------"

BACKEND_ENV="/Users/ky/Easy-Flow/rpa-system/backend/.env"

if [ -f "$BACKEND_ENV" ]; then
    if grep -q "^GOOGLE_CLIENT_ID=" "$BACKEND_ENV" && ! grep -q "^GOOGLE_CLIENT_ID=$" "$BACKEND_ENV" && ! grep -q "^GOOGLE_CLIENT_ID=your-" "$BACKEND_ENV"; then
        echo -e "${GREEN}✅ GOOGLE_CLIENT_ID is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  GOOGLE_CLIENT_ID is missing or not set (optional)${NC}"
    fi
    
    if grep -q "^GOOGLE_CLIENT_SECRET=" "$BACKEND_ENV" && ! grep -q "^GOOGLE_CLIENT_SECRET=$" "$BACKEND_ENV" && ! grep -q "^GOOGLE_CLIENT_SECRET=your-" "$BACKEND_ENV"; then
        echo -e "${GREEN}✅ GOOGLE_CLIENT_SECRET is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  GOOGLE_CLIENT_SECRET is missing or not set (optional)${NC}"
    fi
    
    if grep -q "^SLACK_CLIENT_ID=" "$BACKEND_ENV" && ! grep -q "^SLACK_CLIENT_ID=$" "$BACKEND_ENV" && ! grep -q "^SLACK_CLIENT_ID=your-" "$BACKEND_ENV"; then
        echo -e "${GREEN}✅ SLACK_CLIENT_ID is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SLACK_CLIENT_ID is missing or not set (optional)${NC}"
    fi
    
    if grep -q "^SLACK_CLIENT_SECRET=" "$BACKEND_ENV" && ! grep -q "^SLACK_CLIENT_SECRET=$" "$BACKEND_ENV" && ! grep -q "^SLACK_CLIENT_SECRET=your-" "$BACKEND_ENV"; then
        echo -e "${GREEN}✅ SLACK_CLIENT_SECRET is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SLACK_CLIENT_SECRET is missing or not set (optional)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backend .env file not found at $BACKEND_ENV${NC}"
    echo "   Run: cd rpa-system/backend && ./check_env.sh"
fi

echo ""

# Fix #3: Firebase config matching
echo "📋 Fix #3: Firebase Configuration Matching"
echo "-----------------------------------"

FRONTEND_ENV="/Users/ky/Easy-Flow/rpa-system/rpa-dashboard/.env.local"

if [ -f "$BACKEND_ENV" ] && [ -f "$FRONTEND_ENV" ]; then
    BACKEND_PROJECT_ID=$(grep "^FIREBASE_PROJECT_ID=" "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")
    FRONTEND_PROJECT_ID=$(grep "^REACT_APP_FIREBASE_PROJECT_ID=" "$FRONTEND_ENV" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")
    
    if [ -n "$BACKEND_PROJECT_ID" ] && [ -n "$FRONTEND_PROJECT_ID" ]; then
        if [ "$BACKEND_PROJECT_ID" = "$FRONTEND_PROJECT_ID" ]; then
            echo -e "${GREEN}✅ Firebase Project IDs match: $BACKEND_PROJECT_ID${NC}"
        else
            echo -e "${RED}❌ Firebase Project ID mismatch!${NC}"
            echo "   Backend:  $BACKEND_PROJECT_ID"
            echo "   Frontend: $FRONTEND_PROJECT_ID"
            ERRORS=$((ERRORS + 1))
        fi
    else
        if [ -z "$BACKEND_PROJECT_ID" ]; then
            echo -e "${RED}❌ FIREBASE_PROJECT_ID not set in backend .env${NC}"
            ERRORS=$((ERRORS + 1))
        fi
        if [ -z "$FRONTEND_PROJECT_ID" ]; then
            echo -e "${RED}❌ REACT_APP_FIREBASE_PROJECT_ID not set in frontend .env.local${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
else
    if [ ! -f "$BACKEND_ENV" ]; then
        echo -e "${YELLOW}⚠️  Backend .env not found${NC}"
    fi
    if [ ! -f "$FRONTEND_ENV" ]; then
        echo -e "${YELLOW}⚠️  Frontend .env.local not found${NC}"
    fi
fi

echo ""

# Fix #4: Vercel routing
echo "📋 Fix #4: Vercel API Routing"
echo "-----------------------------------"

VERCEL_JSON="/Users/ky/Easy-Flow/vercel.json"

if [ -f "$VERCEL_JSON" ]; then
    if grep -q '"/api/(.*)"' "$VERCEL_JSON" && grep -q "easyflow-backend" "$VERCEL_JSON"; then
        echo -e "${GREEN}✅ Vercel API rewrites are configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Vercel API rewrites may be missing${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  vercel.json not found${NC}"
fi

echo ""
echo "-----------------------------------"
echo "📊 Summary"
echo "-----------------------------------"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All critical code fixes verified!${NC}"
    echo ""
    echo "⚠️  Note: OAuth credentials are optional but recommended for integrations."
    echo "   See: docs/CRITICAL_FIXES_APPLIED.md for setup instructions"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS critical issue(s)${NC}"
    echo ""
    echo "See: docs/CRITICAL_FIXES_APPLIED.md for fix instructions"
    exit 1
fi

