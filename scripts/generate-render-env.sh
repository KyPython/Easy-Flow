#!/bin/bash

# Environment Variables Generator for Render.com Backend
# Extracts values from your existing .env files

echo "🚀 Render.com Backend Environment Variables"
echo "==========================================="
echo ""
echo "Copy these directly into Render.com environment variables:"
echo ""

# Extract from existing .env file
ENV_FILE="/Users/ky/Desktop/GitHub/VS_Code/EasyFlow/Easy-Flow/rpa-system/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at $ENV_FILE"
    exit 1
fi

# Production settings
echo "NODE_ENV=production"
echo "PORT=3030"
echo ""

# Extract and output existing values
echo "# Supabase Configuration"
grep "SUPABASE_URL=" "$ENV_FILE"
grep "SUPABASE_ANON_KEY=" "$ENV_FILE"
grep "SUPABASE_SERVICE_ROLE=" "$ENV_FILE"
grep "SUPABASE_BUCKET=" "$ENV_FILE"
grep "SUPABASE_USE_SIGNED_URLS=" "$ENV_FILE"
grep "SUPABASE_SIGNED_URL_EXPIRES=" "$ENV_FILE"
echo ""

echo "# API Security"
grep "API_KEY=" "$ENV_FILE"
grep "ADMIN_API_SECRET=" "$ENV_FILE"
echo ""

echo "# Email Configuration"
grep "SENDGRID_API_KEY=" "$ENV_FILE"
grep "SENDGRID_FROM_EMAIL=" "$ENV_FILE"
grep "SENDGRID_FROM_NAME=" "$ENV_FILE"
echo "SEND_EMAIL_WEBHOOK=https://YOUR_BACKEND_URL.onrender.com/api/send-email-now"
grep "SEND_EMAIL_WEBHOOK_SECRET=" "$ENV_FILE"
echo ""

echo "# Integrations"
grep "HUBSPOT_API_KEY=" "$ENV_FILE" | tail -1  # Get the latest one
grep "UCHAT_API_KEY=" "$ENV_FILE"
grep "POLAR_API_KEY=" "$ENV_FILE"
grep "POLAR_WEBHOOK_SECRET=" "$ENV_FILE"
grep "DUCK_TOKEN=" "$ENV_FILE"
echo ""

echo "# Analytics"
grep "MEASUREMENT_ID=" "$ENV_FILE" | tail -1
echo ""

echo "# URLs (UPDATE THESE AFTER DEPLOYMENT)"
echo "ALLOWED_ORIGINS=https://YOUR_FRONTEND_URL.vercel.app"
echo "AUTOMATION_URL=https://YOUR_AUTOMATION_URL.onrender.com"
echo "APP_URL=https://YOUR_FRONTEND_URL.vercel.app"
echo ""

echo "# Generate this new API key:"
echo "AUTOMATION_API_KEY=$(openssl rand -hex 32)"
echo ""

echo "==========================================="
echo "✅ Copy these to Render.com environment variables"
echo "🔄 Update the URLs after you get your actual deployment URLs"
