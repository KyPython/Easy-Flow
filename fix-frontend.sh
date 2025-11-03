#!/bin/bash
# Quick fix script for the ajv dependency issue

echo "🔧 Fixing ajv dependency issue..."

cd /Users/ky/Desktop/GitHub/VS_Code/EasyFlow/Easy-Flow-clean/rpa-system/rpa-dashboard

# Install compatible ajv version
npm install ajv@^8.12.0 --save-dev

# Alternative: Force resolution in package.json
echo "Adding resolution to package.json..."
npm pkg set "overrides.ajv"="^8.12.0"

echo "✅ Fix complete. Try: npm start"