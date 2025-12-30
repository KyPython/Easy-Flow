#!/bin/bash
# Check which required environment variables are missing

echo "🔍 Checking backend .env configuration..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Create it at: $(pwd)/.env"
    exit 1
fi

echo "✅ .env file exists"
echo ""

# Source the .env file (safely)
set -a
source .env 2>/dev/null
set +a

# Check Firebase
echo "📋 Firebase Configuration:"
if [ -z "$FIREBASE_PROJECT_ID" ]; then
    echo "  ❌ FIREBASE_PROJECT_ID is missing"
else
    if [ "$FIREBASE_PROJECT_ID" = "easyflow-77db9" ]; then
        echo "  ✅ FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID (matches frontend)"
    else
        echo "  ⚠️  FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID (should be 'easyflow-77db9')"
    fi
fi

[ -z "$FIREBASE_CLIENT_EMAIL" ] && echo "  ❌ FIREBASE_CLIENT_EMAIL is missing" || echo "  ✅ FIREBASE_CLIENT_EMAIL is set"
[ -z "$FIREBASE_PRIVATE_KEY" ] && echo "  ❌ FIREBASE_PRIVATE_KEY is missing" || echo "  ✅ FIREBASE_PRIVATE_KEY is set"
[ -z "$FIREBASE_DATABASE_URL" ] && echo "  ❌ FIREBASE_DATABASE_URL is missing" || echo "  ✅ FIREBASE_DATABASE_URL is set"

echo ""
echo "📋 Supabase Configuration:"
[ -z "$SUPABASE_URL" ] && echo "  ❌ SUPABASE_URL is missing" || echo "  ✅ SUPABASE_URL is set"
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE" ] && [ -z "$SUPABASE_KEY" ]; then
    echo "  ❌ SUPABASE_SERVICE_ROLE_KEY (or alternative) is missing"
else
    echo "  ✅ Supabase service role key is set"
fi

echo ""
echo "📋 Integration OAuth (Optional):"
[ -z "$GOOGLE_CLIENT_ID" ] && echo "  ⚠️  GOOGLE_CLIENT_ID is missing (optional)" || echo "  ✅ GOOGLE_CLIENT_ID is set"
[ -z "$GOOGLE_CLIENT_SECRET" ] && echo "  ⚠️  GOOGLE_CLIENT_SECRET is missing (optional)" || echo "  ✅ GOOGLE_CLIENT_SECRET is set"
[ -z "$SLACK_CLIENT_ID" ] && echo "  ⚠️  SLACK_CLIENT_ID is missing (optional)" || echo "  ✅ SLACK_CLIENT_ID is set"
[ -z "$SLACK_CLIENT_SECRET" ] && echo "  ⚠️  SLACK_CLIENT_SECRET is missing (optional)" || echo "  ✅ SLACK_CLIENT_SECRET is set"

echo ""
echo "📊 Summary:"
MISSING_CRITICAL=0
if [ -z "$FIREBASE_PROJECT_ID" ] || [ -z "$FIREBASE_CLIENT_EMAIL" ] || [ -z "$FIREBASE_PRIVATE_KEY" ]; then
    echo "  ❌ Critical Firebase config missing (will cause 401 errors)"
    MISSING_CRITICAL=1
else
    echo "  ✅ Firebase config present"
fi

if [ -z "$SUPABASE_URL" ] || ([ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE" ] && [ -z "$SUPABASE_KEY" ]); then
    echo "  ❌ Critical Supabase config missing"
    MISSING_CRITICAL=1
else
    echo "  ✅ Supabase config present"
fi

if [ $MISSING_CRITICAL -eq 1 ]; then
    echo ""
    echo "⚠️  Some critical configuration is missing!"
    echo "   See BACKEND_ENV_SETUP.md for setup instructions"
    exit 1
else
    echo ""
    echo "✅ All critical configuration is present!"
fi
