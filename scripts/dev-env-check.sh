#!/bin/sh
# EasyFlow Development Environment Check
# Adapted from shell-games toolkit: https://github.com/KyPython/shell-games
# Verifies that all required development tools are installed for EasyFlow

# Don't use set -e here - we want to continue checking even if some checks fail
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
INSTALLED=0
MISSING=0
OPTIONAL_INSTALLED=0
OPTIONAL_MISSING=0

echo "${BLUE}=== EasyFlow Development Environment Check ===${NC}\n"

# Core Tools (Required)
echo "${BLUE}Core Tools (Required):${NC}"

# Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "${GREEN}✓ Node.js:${NC}        $NODE_VERSION"
    INSTALLED=$((INSTALLED + 1))
    
    # Check version (need >= 20.0.0)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "  ${YELLOW}⚠ Warning: EasyFlow requires Node.js >= 20.0.0${NC}"
    fi
else
    echo "${RED}✗ Node.js:${NC}        not installed (required >= 20.0.0)"
    MISSING=$((MISSING + 1))
fi

# npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "${GREEN}✓ npm:${NC}             $NPM_VERSION"
    INSTALLED=$((INSTALLED + 1))
else
    echo "${RED}✗ npm:${NC}             not installed"
    MISSING=$((MISSING + 1))
fi

# Python 3
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo "${GREEN}✓ Python 3:${NC}        $PYTHON_VERSION"
    INSTALLED=$((INSTALLED + 1))
    
    # Check version (need >= 3.9)
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
        echo "  ${YELLOW}⚠ Warning: EasyFlow requires Python >= 3.9${NC}"
    fi
else
    echo "${RED}✗ Python 3:${NC}        not installed (required >= 3.9)"
    MISSING=$((MISSING + 1))
fi

# Git
if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    echo "${GREEN}✓ Git:${NC}             $GIT_VERSION"
    INSTALLED=$((INSTALLED + 1))
else
    echo "${RED}✗ Git:${NC}              not installed"
    MISSING=$((MISSING + 1))
fi

echo ""

# Optional Tools (Recommended)
echo "${BLUE}Optional Tools (Recommended):${NC}"

# Docker
if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo "${GREEN}✓ Docker:${NC}          $DOCKER_VERSION"
    OPTIONAL_INSTALLED=$((OPTIONAL_INSTALLED + 1))
else
    echo "${YELLOW}○ Docker:${NC}          not installed (recommended for Kafka)"
    OPTIONAL_MISSING=$((OPTIONAL_MISSING + 1))
fi

# Docker Compose
if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
    else
        COMPOSE_VERSION=$(docker compose version | awk '{print $4}')
    fi
    echo "${GREEN}✓ Docker Compose:${NC}   $COMPOSE_VERSION"
    OPTIONAL_INSTALLED=$((OPTIONAL_INSTALLED + 1))
else
    echo "${YELLOW}○ Docker Compose:${NC}  not installed (recommended)"
    OPTIONAL_MISSING=$((OPTIONAL_MISSING + 1))
fi

# PM2
if command -v pm2 >/dev/null 2>&1; then
    PM2_VERSION=$(pm2 --version)
    echo "${GREEN}✓ PM2:${NC}             $PM2_VERSION"
    OPTIONAL_INSTALLED=$((OPTIONAL_INSTALLED + 1))
else
    echo "${YELLOW}○ PM2:${NC}             not installed (recommended for process management)"
    OPTIONAL_MISSING=$((OPTIONAL_MISSING + 1))
fi

# Kafka (check if running or available)
if command -v kafka-topics >/dev/null 2>&1 || docker ps | grep -q kafka; then
    echo "${GREEN}✓ Kafka:${NC}           available"
    OPTIONAL_INSTALLED=$((OPTIONAL_INSTALLED + 1))
else
    echo "${YELLOW}○ Kafka:${NC}           not detected (can use Docker Compose)"
    OPTIONAL_MISSING=$((OPTIONAL_MISSING + 1))
fi

# Python pip
if command -v pip3 >/dev/null 2>&1 || command -v pip >/dev/null 2>&1; then
    if command -v pip3 >/dev/null 2>&1; then
        PIP_VERSION=$(pip3 --version | awk '{print $2}')
    else
        PIP_VERSION=$(pip --version | awk '{print $2}')
    fi
    echo "${GREEN}✓ pip:${NC}             $PIP_VERSION"
    OPTIONAL_INSTALLED=$((OPTIONAL_INSTALLED + 1))
else
    echo "${YELLOW}○ pip:${NC}             not installed (needed for Python dependencies)"
    OPTIONAL_MISSING=$((OPTIONAL_MISSING + 1))
fi

echo ""

# Infrastructure Checks (Optional but Recommended)
echo "${BLUE}Infrastructure Connections:${NC}"

INFRA_OK=0
INFRA_WARN=0

# Supabase Connection Check
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-${SUPABASE_ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE="${SUPABASE_SERVICE_ROLE:-}"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
    echo "  Checking Supabase connection..."
    # Try to ping Supabase REST API
    if command -v curl >/dev/null 2>&1; then
        # Check if Supabase URL is accessible
        if curl -s -f -o /dev/null --max-time 5 "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_KEY}" 2>/dev/null; then
            echo "  ${GREEN}✓ Supabase:${NC}         connected (${SUPABASE_URL})"
            INFRA_OK=$((INFRA_OK + 1))
        else
            echo "  ${YELLOW}○ Supabase:${NC}         configured but connection failed (check URL/key)"
            INFRA_WARN=$((INFRA_WARN + 1))
        fi
    else
        echo "  ${YELLOW}○ Supabase:${NC}         configured (curl not available for connection test)"
        INFRA_WARN=$((INFRA_WARN + 1))
    fi
else
    echo "  ${YELLOW}○ Supabase:${NC}         not configured (set SUPABASE_URL and SUPABASE_KEY)"
    INFRA_WARN=$((INFRA_WARN + 1))
fi

# Kafka Topics Check
KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-${KAFKA_BROKERS:-localhost:9092}}"
KAFKA_CONTAINER=""

# Check if Kafka is running in Docker
if command -v docker >/dev/null 2>&1; then
    KAFKA_CONTAINER=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -i kafka | head -n1 || true)
fi

if [ -n "$KAFKA_CONTAINER" ]; then
    echo "  Checking Kafka topics..."
    # Check for required topics
    REQUIRED_TOPICS="automation-tasks automation-results workflow-events step-results"
    TOPICS_FOUND=0
    TOPICS_TOTAL=0
    
    for topic in $REQUIRED_TOPICS; do
        TOPICS_TOTAL=$((TOPICS_TOTAL + 1))
        if docker exec "$KAFKA_CONTAINER" kafka-topics --bootstrap-server "$KAFKA_BOOTSTRAP" --list 2>/dev/null | grep -q "^${topic}$"; then
            TOPICS_FOUND=$((TOPICS_FOUND + 1))
        fi
    done
    
    TOPICS_MISSING=$((TOPICS_TOTAL - TOPICS_FOUND))
    
    if [ $TOPICS_MISSING -eq 0 ]; then
        echo "  ${GREEN}✓ Kafka Topics:${NC}     all required topics exist ($TOPICS_FOUND/$TOPICS_TOTAL)"
        INFRA_OK=$((INFRA_OK + 1))
    else
        echo "  ${YELLOW}○ Kafka Topics:${NC}     $TOPICS_MISSING missing (found $TOPICS_FOUND/$TOPICS_TOTAL)"
        echo "    Run: ./scripts/init-kafka-topics.sh"
        INFRA_WARN=$((INFRA_WARN + 1))
    fi
elif command -v kafka-topics >/dev/null 2>&1; then
    # Kafka installed locally (not Docker)
    echo "  ${GREEN}✓ Kafka:${NC}             installed locally"
    INFRA_OK=$((INFRA_OK + 1))
else
    echo "  ${YELLOW}○ Kafka:${NC}             not running (start with: docker compose up -d kafka)"
    INFRA_WARN=$((INFRA_WARN + 1))
fi

# Backend Health Check (if running)
if command -v curl >/dev/null 2>&1; then
    if curl -s -f -o /dev/null --max-time 2 "http://localhost:3030/health" 2>/dev/null; then
        echo "  ${GREEN}✓ Backend API:${NC}      running (http://localhost:3030)"
        INFRA_OK=$((INFRA_OK + 1))
    else
        echo "  ${YELLOW}○ Backend API:${NC}      not running (start with: ./start-dev.sh)"
        INFRA_WARN=$((INFRA_WARN + 1))
    fi
fi

# Automation Worker Health Check (if running)
if command -v curl >/dev/null 2>&1; then
    if curl -s -f -o /dev/null --max-time 2 "http://localhost:7070/health" 2>/dev/null; then
        echo "  ${GREEN}✓ Automation Worker:${NC} running (http://localhost:7070)"
        INFRA_OK=$((INFRA_OK + 1))
    else
        echo "  ${YELLOW}○ Automation Worker:${NC} not running"
        INFRA_WARN=$((INFRA_WARN + 1))
    fi
fi

echo ""

# Summary
echo "${BLUE}=== Summary ===${NC}"
echo "Core Tools Installed: ${GREEN}$INSTALLED${NC}"
if [ $MISSING -gt 0 ]; then
    echo "Core Tools Missing: ${RED}$MISSING${NC}"
fi
echo "Optional Tools Installed: ${GREEN}$OPTIONAL_INSTALLED${NC}"
if [ $OPTIONAL_MISSING -gt 0 ]; then
    echo "Optional Tools Missing: ${YELLOW}$OPTIONAL_MISSING${NC}"
fi
if [ $INFRA_OK -gt 0 ] || [ $INFRA_WARN -gt 0 ]; then
    echo "Infrastructure Connected: ${GREEN}$INFRA_OK${NC}"
    if [ $INFRA_WARN -gt 0 ]; then
        echo "Infrastructure Warnings: ${YELLOW}$INFRA_WARN${NC}"
    fi
fi

echo ""

# Exit code
if [ $MISSING -gt 0 ]; then
    echo "${RED}❌ Some required tools are missing. Please install them before continuing.${NC}"
    exit 1
else
    echo "${GREEN}✅ All required tools are installed!${NC}"
    if [ $OPTIONAL_MISSING -gt 0 ] || [ $INFRA_WARN -gt 0 ]; then
        echo "${YELLOW}ℹ️  Some optional tools/infrastructure are missing but not required.${NC}"
    fi
    exit 0
fi

