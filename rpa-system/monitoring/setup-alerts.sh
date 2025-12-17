#!/bin/bash

# Alertmanager Configuration Setup Script
# This script generates alertmanager.yml from environment variables

set -e

CONFIG_FILE="alertmanager.yml"
TEMPLATE_FILE="alertmanager.yml.template"

# Check if template exists, if not create from current config
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Creating template from current alertmanager.yml..."
  cp "$CONFIG_FILE" "$TEMPLATE_FILE"
fi

# Read environment variables with defaults
SMTP_HOST=${ALERTMANAGER_SMTP_HOST:-smtp.gmail.com:587}
SMTP_FROM=${ALERTMANAGER_SMTP_FROM:-kyjahntsmith@gmail.com}
SMTP_USER=${ALERTMANAGER_SMTP_USER:-kyjahntsmith@gmail.com}
SMTP_PASS=${ALERTMANAGER_SMTP_PASS:-}
EMAIL_TO=${ALERTMANAGER_EMAIL_TO:-kyjahntsmith@gmail.com}
SMS_NUMBER=${ALERTMANAGER_SMS_NUMBER:-2034494970}

# Check if required variables are set
if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
  echo "⚠️  Warning: ALERTMANAGER_SMTP_USER or ALERTMANAGER_SMTP_PASS not set"
  echo "   Alerts will be configured but emails may not work"
  echo ""
  echo "To set up email alerts, create a .env file with:"
  echo "  ALERTMANAGER_SMTP_HOST=smtp.gmail.com:587"
  echo "  ALERTMANAGER_SMTP_FROM=your-email@gmail.com"
  echo "  ALERTMANAGER_SMTP_USER=your-email@gmail.com"
  echo "  ALERTMANAGER_SMTP_PASS=your-app-password"
  echo "  ALERTMANAGER_EMAIL_TO=your-email@gmail.com"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Generate config file using envsubst
export SMTP_HOST SMTP_FROM SMTP_USER SMTP_PASS EMAIL_TO SMS_NUMBER

envsubst < "$TEMPLATE_FILE" > "$CONFIG_FILE"

echo "✅ Alertmanager configuration generated!"
echo "   SMTP Host: $SMTP_HOST"
echo "   SMTP From: $SMTP_FROM"
echo "   Email To: $EMAIL_TO"
echo "   SMS Number: $SMS_NUMBER (sending to Verizon, T-Mobile, AT&T gateways)"
echo ""
echo "⚠️  IMPORTANT: Update smtp_auth_password in alertmanager.yml with your Gmail app password"
echo "   Get it from: https://myaccount.google.com/apppasswords"
echo ""
echo "To apply changes, restart Alertmanager:"
echo "  docker-compose -f docker-compose.monitoring.yml restart alertmanager"

