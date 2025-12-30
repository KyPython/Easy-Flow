#!/bin/bash
# Verify OAuth configuration and show expected redirect URIs

echo "🔍 OAuth Configuration Verification"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found at $(pwd)/.env"
    exit 1
fi

# Source the .env file
set -a
source .env 2>/dev/null
set +a

echo "📋 Current Configuration:"
echo ""

# Check Google OAuth
if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "❌ GOOGLE_CLIENT_ID is not set in .env"
    echo ""
    echo "   Add it to your .env file:"
    echo "   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com"
    exit 1
else
    echo "✅ GOOGLE_CLIENT_ID is set:"
    echo "   $GOOGLE_CLIENT_ID"
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "⚠️  GOOGLE_CLIENT_SECRET is not set"
else
    echo "✅ GOOGLE_CLIENT_SECRET is set"
fi

# Get base URL
API_BASE_URL="${API_BASE_URL:-http://localhost:3030}"
echo ""
echo "📋 Base URL Configuration:"
echo "   API_BASE_URL=${API_BASE_URL:-'http://localhost:3030' (default)}"
echo ""

echo "📋 Expected Redirect URIs (must match Google Cloud Console):"
echo ""
echo "   For Gmail:"
echo "   → ${API_BASE_URL:-http://localhost:3030}/api/integrations/gmail/oauth/callback"
echo ""
echo "   For Google Sheets:"
echo "   → ${API_BASE_URL:-http://localhost:3030}/api/integrations/google_sheets/oauth/callback"
echo ""
echo "   For Google Drive:"
echo "   → ${API_BASE_URL:-http://localhost:3030}/api/integrations/google_drive/oauth/callback"
echo ""
echo "   For Google Meet:"
echo "   → ${API_BASE_URL:-http://localhost:3030}/api/integrations/google_meet/oauth/callback"
echo ""

echo "🔧 Action Required:"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Find OAuth 2.0 Client ID: $GOOGLE_CLIENT_ID"
echo "3. Click Edit (pencil icon)"
echo "4. In 'Authorized redirect URIs', add ALL four URIs shown above"
echo "5. Click Save"
echo "6. Wait 1-2 minutes for changes to propagate"
echo ""
echo "⚠️  Common Mistakes:"
echo "   ❌ Using https:// instead of http:// for localhost"
echo "   ❌ Wrong port number (must be 3030)"
echo "   ❌ Trailing slashes"
echo "   ❌ Typos in the path"
echo "   ❌ Editing the wrong OAuth client ID"
echo ""
echo "✅ Verification Checklist:"
echo "   [ ] All 4 redirect URIs are added"
echo "   [ ] Using http:// (not https://) for localhost"
echo "   [ ] Port is 3030"
echo "   [ ] No trailing slashes"
echo "   [ ] Client ID matches: $GOOGLE_CLIENT_ID"
echo ""
echo "🔐 OAuth App Testing Mode (if you see 'access_denied' error):"
echo ""
echo "   If you get 'Error 403: access_denied' or 'app is being tested':"
echo "   1. Go to: https://console.cloud.google.com/apis/credentials"
echo "   2. Find OAuth consent screen (left sidebar)"
echo "   3. Scroll to 'Test users' section"
echo "   4. Click '+ ADD USERS'"
echo "   5. Add email addresses that need access (e.g., your Gmail)"
echo "   6. Click 'ADD'"
echo "   7. Users will now be able to sign in"
echo ""
echo "   OR publish the app (for production use):"
echo "   1. Go to OAuth consent screen"
echo "   2. Click 'PUBLISH APP' button"
echo "   3. Confirm publishing (app will be available to all users)"
echo ""
echo "⚠️  'Google hasn't verified this app' Warning:"
echo ""
echo "   This warning appears because the app requests sensitive scopes."
echo "   For development/testing, you can proceed:"
echo "   1. Click 'Advanced' on the warning screen"
echo "   2. Click 'Go to [App Name] (unsafe)'"
echo "   3. Continue with the OAuth flow"
echo ""
echo "   To reduce the warning (improve OAuth consent screen):"
echo "   1. Go to: https://console.cloud.google.com/apis/credentials/consent"
echo "   2. Fill out all required fields:"
echo "      - App name: EasyFlow"
echo "      - User support email: your-email@gmail.com"
echo "      - Developer contact: your-email@gmail.com"
echo "      - App logo (optional but recommended)"
echo "      - App domain (optional)"
echo "      - Privacy policy URL (optional but recommended)"
echo "      - Terms of service URL (optional)"
echo "   3. Click 'Save and Continue'"
echo ""
echo "   To get verified (for production):"
echo "   - Submit for Google verification: https://support.google.com/cloud/answer/9110914"
echo "   - This process can take several weeks"
echo "   - Required for apps with sensitive scopes in production"
echo ""

# Check Slack OAuth
if [ -z "$SLACK_CLIENT_ID" ]; then
    echo "⚠️  SLACK_CLIENT_ID is not set (optional)"
else
    echo "📋 Slack OAuth Configuration:"
    echo "✅ SLACK_CLIENT_ID is set:"
    echo "   $SLACK_CLIENT_ID"
    if [ -z "$SLACK_CLIENT_SECRET" ]; then
        echo "⚠️  SLACK_CLIENT_SECRET is not set"
    else
        echo "✅ SLACK_CLIENT_SECRET is set"
    fi
    echo ""
    echo "📋 Expected Slack Redirect URI (must match Slack App settings):"
    echo ""
    # Check if API_BASE_URL uses HTTPS
    if [[ "${API_BASE_URL}" == https://* ]]; then
        SLACK_REDIRECT_URI="${API_BASE_URL}/api/integrations/slack/oauth/callback"
        echo "   → $SLACK_REDIRECT_URI"
        echo ""
        echo "   ✅ Using HTTPS (required by Slack)"
    else
        SLACK_REDIRECT_URI="${API_BASE_URL:-http://localhost:3030}/api/integrations/slack/oauth/callback"
        echo "   → $SLACK_REDIRECT_URI"
        echo ""
        echo "   ⚠️  Slack requires HTTPS for redirect URIs!"
        echo ""
        echo "   📋 Options for local development:"
        echo ""
        echo "   Option 1: Use ngrok (Recommended for local dev):"
        echo "   1. Install ngrok: https://ngrok.com/download"
        echo "   2. Run: ngrok http 3030"
        echo "   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
        echo "   4. Set in .env: API_BASE_URL=https://abc123.ngrok.io"
        echo "   5. Restart backend server"
        echo "   6. Use the HTTPS URL in Slack redirect URI"
        echo ""
        echo "   Option 2: Use production URL (if available):"
        echo "   1. Set in .env: API_BASE_URL=https://easyflow-backend-ad8e.onrender.com"
        echo "   2. Restart backend server"
        echo "   3. Use production URL in Slack redirect URI"
        echo ""
    fi
    echo ""
    echo "🔧 Slack Action Required:"
    echo ""
    echo "1. Go to: https://api.slack.com/apps"
    echo "2. Find your Slack App (Client ID: $SLACK_CLIENT_ID)"
    echo "3. Go to 'OAuth & Permissions' in the sidebar"
    echo "4. Scroll to 'Redirect URLs' section"
    echo "5. Click 'Add New Redirect URL'"
    if [[ "${API_BASE_URL}" == https://* ]]; then
        echo "6. Add: $SLACK_REDIRECT_URI"
    else
        echo "6. Add your HTTPS redirect URI (from ngrok or production)"
        echo "   Example: https://abc123.ngrok.io/api/integrations/slack/oauth/callback"
    fi
    echo "7. Click 'Save URLs'"
    echo "8. Verify required Bot Token Scopes are added:"
    echo "   - chat:write"
    echo "   - channels:read"
    echo "   - channels:history"
    echo "   - files:write"
    echo ""
fi

