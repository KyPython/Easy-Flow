#!/bin/bash

# EasyFlow Mobile - Build Script
# Usage: ./build.sh [development|preview|production]

set -e

ENV=${1:-development}

echo "🚀 Starting EasyFlow Mobile Build"
echo "📦 Environment: $ENV"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check environment variables
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Copy .env.example to .env and configure."
    echo "   cp .env.example .env"
fi

# Build based on environment
case $ENV in
    development)
        echo "🔧 Building development version..."
        npx expo export --platform ios --dev-client
        ;;
    preview)
        echo "📱 Building preview version for internal testing..."
        npx eas build --profile preview --platform all
        ;;
    production)
        echo "🏭 Building production version for app store..."
        npx eas build --profile production --platform all
        ;;
    *)
        echo "❌ Unknown environment: $ENV"
        echo "Usage: ./build.sh [development|preview|production]"
        exit 1
        ;;
esac

echo "✅ Build completed successfully!"
echo ""
echo "Next steps:"
echo "- For preview: Upload to TestFlight (iOS) or Internal Testing (Android)"
echo "- For production: Submit to App Store / Play Store"
