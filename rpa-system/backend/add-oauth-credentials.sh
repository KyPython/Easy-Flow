#!/usr/bin/env bash
# Helper script to add OAuth credentials to backend .env file

set -e

ENV_FILE="/Users/ky/Easy-Flow/rpa-system/backend/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 OAuth Credentials Setup${NC}"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating it...${NC}"
    touch "$ENV_FILE"
    echo "# Backend Environment Variables" >> "$ENV_FILE"
    echo "# Generated on $(date)" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
fi

# Function to add or update env variable
add_env_var() {
    local key=$1
    local value=$2
    local comment=$3
    
    # Check if variable already exists
    if grep -q "^${key}=" "$ENV_FILE"; then
        echo -e "${YELLOW}⚠️  ${key} already exists in .env${NC}"
        echo -e "${YELLOW}   Current value: $(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2-)${NC}"
        read -p "   Do you want to update it? (y/n): " update
        if [ "$update" = "y" ] || [ "$update" = "Y" ]; then
            # Remove old line
            sed -i.bak "/^${key}=/d" "$ENV_FILE"
            # Add new line
            if [ -n "$comment" ]; then
                echo "# ${comment}" >> "$ENV_FILE"
            fi
            echo "${key}=${value}" >> "$ENV_FILE"
            echo -e "${GREEN}✅ Updated ${key}${NC}"
        else
            echo -e "${YELLOW}   Skipping ${key}${NC}"
        fi
    else
        # Add new variable
        if [ -n "$comment" ]; then
            echo "" >> "$ENV_FILE"
            echo "# ${comment}" >> "$ENV_FILE"
        fi
        echo "${key}=${value}" >> "$ENV_FILE"
        echo -e "${GREEN}✅ Added ${key}${NC}"
    fi
}

echo -e "${BLUE}Google OAuth Configuration${NC}"
echo "----------------------------"
echo "Get credentials from: https://console.cloud.google.com/apis/credentials"
echo ""
read -p "Enter GOOGLE_CLIENT_ID (or press Enter to skip): " google_client_id
if [ -n "$google_client_id" ]; then
    add_env_var "GOOGLE_CLIENT_ID" "$google_client_id" "Google OAuth Client ID (from Google Cloud Console)"
fi

read -p "Enter GOOGLE_CLIENT_SECRET (or press Enter to skip): " google_client_secret
if [ -n "$google_client_secret" ]; then
    add_env_var "GOOGLE_CLIENT_SECRET" "$google_client_secret" "Google OAuth Client Secret"
fi

echo ""
echo -e "${BLUE}Slack OAuth Configuration${NC}"
echo "---------------------------"
echo "Get credentials from: https://api.slack.com/apps"
echo ""
read -p "Enter SLACK_CLIENT_ID (or press Enter to skip): " slack_client_id
if [ -n "$slack_client_id" ]; then
    add_env_var "SLACK_CLIENT_ID" "$slack_client_id" "Slack OAuth Client ID (from Slack API Apps)"
fi

read -p "Enter SLACK_CLIENT_SECRET (or press Enter to skip): " slack_client_secret
if [ -n "$slack_client_secret" ]; then
    add_env_var "SLACK_CLIENT_SECRET" "$slack_client_secret" "Slack OAuth Client Secret"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ OAuth credentials setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify your .env file at: $ENV_FILE"
echo "2. Restart your backend server"
echo "3. Test OAuth flows at: /api/integrations/gmail/oauth/start"
echo ""
echo -e "${BLUE}For detailed setup instructions, see:${NC}"
echo "   rpa-system/backend/BACKEND_ENV_SETUP.md"
echo ""

