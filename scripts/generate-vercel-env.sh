#!/bin/bash

# Environment Variables Generator for Vercel Frontend
# Extracts values from your existing .env files

echo "🌐 Vercel Frontend Environment Variables"
echo "========================================"
echo ""
echo "Copy these directly into Vercel environment variables:"
echo ""

# Extract from existing .env files
BACKEND_ENV="/Users/ky/Desktop/GitHub/VS_Code/EasyFlow/Easy-Flow/rpa-system/.env"
FRONTEND_ENV="/Users/ky/Desktop/GitHub/VS_Code/EasyFlow/Easy-Flow/rpa-system/rpa-dashboard/.env.production"

if [ ! -f "$BACKEND_ENV" ]; then
    echo "❌ Backend .env file not found at $BACKEND_ENV"
    exit 1
fi

if [ ! -f "$FRONTEND_ENV" ]; then
    echo "❌ Frontend .env file not found at $FRONTEND_ENV"
    exit 1
fi

echo "# Supabase Configuration"
grep "REACT_APP_SUPABASE_URL=" "$FRONTEND_ENV" || grep "SUPABASE_URL=" "$BACKEND_ENV" | sed 's/SUPABASE_URL=/REACT_APP_SUPABASE_URL=/'
grep "REACT_APP_SUPABASE_ANON_KEY=" "$FRONTEND_ENV" || grep "SUPABASE_ANON_KEY=" "$BACKEND_ENV" | sed 's/SUPABASE_ANON_KEY=/REACT_APP_SUPABASE_ANON_KEY=/'
echo ""

echo "# Backend API (UPDATE AFTER DEPLOYMENT)"
echo "REACT_APP_API_URL=https://YOUR_BACKEND_URL.onrender.com"
echo ""

echo "# Analytics"
grep "REACT_APP_GA_MEASUREMENT_ID=" "$FRONTEND_ENV" || grep "MEASUREMENT_ID=" "$BACKEND_ENV" | sed 's/MEASUREMENT_ID=/REACT_APP_GA_MEASUREMENT_ID=/'
echo ""

echo "# Feature Flags"
grep "REACT_APP_ENABLE_REALTIME=" "$FRONTEND_ENV" || echo "REACT_APP_ENABLE_REALTIME=true"
echo "REACT_APP_ENABLE_ANALYTICS=true"
echo "REACT_APP_ENABLE_NOTIFICATIONS=true"
echo ""

echo "# Build Configuration"
echo "CI=false"
echo "GENERATE_SOURCEMAP=false"
echo "BUILD_PATH=build"
echo ""

echo "========================================"
echo "✅ Copy these to Vercel environment variables"
echo "🔄 Update REACT_APP_API_URL after backend deployment"
