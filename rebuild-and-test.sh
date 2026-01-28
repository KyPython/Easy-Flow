#!/bin/bash
# Rebuild Docker containers with automatic local Supabase fallback
# If remote Supabase is unavailable, starts local Supabase automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track if we started local Supabase
LOCAL_SUPABASE_STARTED=false
SUPABASE_CONTAINER_NAME="supabase-local-easyflow"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 EASYFLOW DOCKER REBUILD WITH SUPABASE AUTO-START"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check if Supabase is accessible
check_supabase_accessible() {
    local url="${1:-}"
    local key="${2:-}"
    
    if [ -z "$url" ] || [ -z "$key" ]; then
        return 1
    fi
    
    # Try to ping Supabase REST API
    if command -v curl >/dev/null 2>&1; then
        if curl -s -f -o /dev/null --max-time 5 "$url/rest/v1/" -H "apikey: $key" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to check if local Supabase is running
is_local_supabase_running() {
    if command -v docker >/dev/null 2>&1; then
        if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^${SUPABASE_CONTAINER_NAME}$"; then
            return 0
        fi
    fi
    return 1
}

# Function to start local Supabase
start_local_supabase() {
    echo "${YELLOW}Starting local Supabase...${NC}"
    
    # Check if Docker is available
    if ! command -v docker >/dev/null 2>&1; then
        echo "${RED}Docker is not installed. Cannot start local Supabase.${NC}"
        echo "${YELLOW}Please install Docker or configure remote Supabase credentials.${NC}"
        return 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo "${RED}Docker daemon is not running. Please start Docker.${NC}"
        return 1
    fi
    
    # Check if Supabase CLI is available
    if command -v supabase >/dev/null 2>&1; then
        echo "Using Supabase CLI to start local instance..."
        supabase start
        LOCAL_SUPABASE_STARTED=true
        return 0
    fi
    
    # Fallback: Run Supabase via Docker directly
    echo "Starting minimal Supabase container via Docker..."
    
    # Stop any existing container with same name
    docker stop "$SUPABASE_CONTAINER_NAME" 2>/dev/null || true
    docker rm "$SUPABASE_CONTAINER_NAME" 2>/dev/null || true
    
    # Start Supabase Studio and Postgres
    docker run -d --name "$SUPABASE_CONTAINER_NAME" \
        -e POSTGRES_PASSWORD=postgres \
        -e ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhc3ktZmxvdyIsInJvbGUiOiJhbm9uIiwic3ViIjoiZTl4Z3I3aSJ9 \
        -e SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhc3ktZmxvdyIsInJvbGUiOiJzZXJ2aWNlIiwic3ViIjoiZTl4Z3I3aSJ9 \
        -p 54321:5432 \
        -p 8000:8000 \
        supabase/postgres:latest 2>/dev/null
        
    if [ $? -eq 0 ]; then
        LOCAL_SUPABASE_STARTED=true
        echo "${GREEN}Local Supabase container started.${NC}"
        echo "${YELLOW}Note: This is a minimal Postgres instance. For full Supabase, use 'supabase start'.${NC}"
        return 0
    fi
    
    echo "${RED}Failed to start local Supabase.${NC}"
    return 1
}

# Get Supabase configuration from environment
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-${SUPABASE_ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE="${SUPABASE_SERVICE_ROLE:-}"

# Check if we should use local Supabase
USE_LOCAL_SUPABASE="${USE_LOCAL_SUPABASE:-false}"

# Check if remote Supabase is accessible
echo "${BLUE}Checking Supabase availability...${NC}"
if [ "$USE_LOCAL_SUPABASE" = "true" ]; then
    echo "${YELLOW}USE_LOCAL_SUPABASE is set - will use local Supabase${NC}"
elif [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "${YELLOW}Supabase credentials not configured - starting local Supabase${NC}"
    USE_LOCAL_SUPABASE=true
else
    if check_supabase_accessible "$SUPABASE_URL" "$SUPABASE_KEY"; then
        echo "${GREEN}✓ Remote Supabase is accessible${NC}"
    else
        echo "${YELLOW}○ Remote Supabase is not accessible - starting local Supabase${NC}"
        USE_LOCAL_SUPABASE=true
    fi
fi

# Start local Supabase if needed
if [ "$USE_LOCAL_SUPABASE" = "true" ]; then
    if is_local_supabase_running; then
        echo "${GREEN}✓ Local Supabase is already running${NC}"
    else
        start_local_supabase
        
        # If we started local Supabase, update environment
        if [ "$LOCAL_SUPABASE_STARTED" = "true" ]; then
            echo "Configuring local Supabase credentials..."
            export SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
            export SUPABASE_KEY="${SUPABASE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhc3ktZmxvdyIsInJvbGUiOiJhbm9uIiwic3ViIjoiZTl4Z3I3aSJ9}"
            export SUPABASE_SERVICE_ROLE="${SUPABASE_SERVICE_ROLE:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhc3ktZmxvdyIsInJvbGUiOiJzZXJ2aWNlIiwic3ViIjoiZTl4Z3I3aSJ9}"
            export SUPABASE_DB_URL="postgresql://postgres:postgres@localhost:54321/postgres"
            
            # Update backend .env file with local Supabase credentials
            if [ -f "rpa-system/backend/.env" ]; then
                # Backup original
                cp rpa-system/backend/.env rpa-system/backend/.env.backup
                # Update or add Supabase credentials
                grep -v "^SUPABASE" rpa-system/backend/.env > rpa-system/backend/.env.tmp || true
                cat >> rpa-system/backend/.env.tmp << EOF

# Local Supabase (auto-generated)
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_KEY
SUPABASE_SERVICE_ROLE=$SUPABASE_SERVICE_ROLE
SUPABASE_DB_URL=$SUPABASE_DB_URL
EOF
                mv rpa-system/backend/.env.tmp rpa-system/backend/.env
                echo "${GREEN}✓ Updated rpa-system/backend/.env with local Supabase credentials${NC}"
            fi
        fi
    fi
fi

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

# Also stop local Supabase if we started it
if [ "$LOCAL_SUPABASE_STARTED" = "true" ]; then
    echo "Stopping local Supabase..."
    docker stop "$SUPABASE_CONTAINER_NAME" 2>/dev/null || true
    docker rm "$SUPABASE_CONTAINER_NAME" 2>/dev/null || true
    
    # Restore original .env if backup exists
    if [ -f "rpa-system/backend/.env.backup" ]; then
        mv rpa-system/backend/.env.backup rpa-system/backend/.env
        echo "Restored original rpa-system/backend/.env"
    fi
fi
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

# Show Supabase status
if [ "$LOCAL_SUPABASE_STARTED" = "true" ]; then
    echo "${YELLOW}📦 Local Supabase is running:${NC}"
    echo "   - Postgres: localhost:54321"
    echo "   - API: localhost:8000"
    echo ""
fi

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
