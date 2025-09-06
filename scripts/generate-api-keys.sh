#!/bin/bash

# API Key Generator for EasyFlow Deployment
# Run this script to generate secure API keys for production

echo "🔐 Generating Secure API Keys for EasyFlow Deployment"
echo "=================================================="
echo ""

echo "📋 Copy these values to your environment configurations:"
echo ""

echo "1. Backend API Key:"
echo "   API_KEY=$(openssl rand -hex 32)"
echo ""

echo "2. Automation API Key:"
echo "   AUTOMATION_API_KEY=$(openssl rand -hex 32)"
echo ""

echo "3. Email Webhook Secret:"
echo "   SEND_EMAIL_WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo ""

echo "4. Admin API Secret (optional):"
echo "   ADMIN_API_SECRET=$(openssl rand -hex 32)"
echo ""

echo "=================================================="
echo "✅ Use these keys in your Render.com and Vercel environment variables"
echo "⚠️  Keep these keys secure and never commit them to Git!"
echo ""
echo "Next steps:"
echo "1. Copy each key to the appropriate environment variables"
echo "2. Update placeholders in deployment configuration"
echo "3. Deploy to Render.com and Vercel"
echo ""
