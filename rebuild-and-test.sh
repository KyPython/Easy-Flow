#!/bin/bash
# Rebuild Docker containers and provide testing instructions

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 REBUILDING DOCKER CONTAINERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true
echo ""

# Rebuild and start
echo "🔨 Rebuilding containers with new configuration..."
echo "   This will:"
echo "   - Rebuild backend with updated .env"
echo "   - Rebuild frontend with updated .env.local"
echo "   - Include firebase-config.js in frontend build"
echo ""

docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ REBUILD COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 TESTING INSTRUCTIONS:"
echo ""
echo "1. Open a NEW Incognito/Private browser window"
echo "   - This ensures clean session, no cached service workers"
echo ""
echo "2. Navigate to: http://localhost:3000"
echo ""
echo "3. Check browser console (F12) for:"
echo "   ✅ Should see: 'Firebase initialized successfully'"
echo "   ✅ Should see: 'Supabase client initialized'"
echo "   ❌ Should NOT see: 401 or 400 errors"
echo ""
echo "4. Check backend logs:"
echo "   docker-compose logs backend | tail -50"
echo ""
echo "5. Check frontend logs:"
echo "   docker-compose logs rpa-dashboard | tail -50"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANT: Backend still needs Firebase credentials"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Before backend will work fully, add Firebase credentials to:"
echo "  rpa-system/backend/.env"
echo ""
echo "See: rpa-system/backend/BACKEND_ENV_SETUP.md"
echo ""
