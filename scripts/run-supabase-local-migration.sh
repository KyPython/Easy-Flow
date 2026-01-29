#!/bin/bash
# Run Supabase Migrations Locally
# This script allows you to run migrations without connecting to the remote Supabase instance
# Useful when the remote instance is paused or unavailable

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Supabase Local Migration Runner ===${NC}\n"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠ Supabase CLI not found${NC}"
    echo "Installing Supabase CLI..."
    npm install -g @supabase/cli
fi

# Check if Docker is running (required for local Supabase)
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again."
    exit 1
fi

# Function to run a single migration file
run_migration() {
    local migration_file="$1"
    
    if [ ! -f "$migration_file" ]; then
        echo -e "${RED}✗ Migration file not found: $migration_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Running migration: $migration_file${NC}"
    
    # Option 1: If using Supabase CLI with local instance
    if command -v supabase &> /dev/null; then
        supabase db push --local --file "$migration_file" 2>/dev/null || {
            echo -e "${YELLOW}⚠ Direct push failed, trying alternative method...${NC}"
            # Option 2: Use psql directly if available
            if command -v psql &> /dev/null; then
                echo "Using psql to run migration..."
                # You'll need to set up local PostgreSQL connection
                psql -U postgres -d postgres -f "$migration_file" 2>/dev/null || {
                    echo -e "${RED}✗ Failed to run migration with psql${NC}"
                    return 1
                }
            else
                echo -e "${YELLOW}⚠ Neither supabase CLI nor psql available${NC}"
                echo "Please run the migration manually or start a local Supabase instance."
                return 1
            }
        }
    else
        echo -e "${RED}✗ Supabase CLI not available${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Migration completed: $migration_file${NC}"
    return 0
}

# Check for migration file argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <migration_file.sql>${NC}"
    echo ""
    echo "Available migrations in supabase/migrations/:"
    ls -la supabase/migrations/ 2>/dev/null || echo "  No migrations found"
    echo ""
    echo "Example:"
    echo "  $0 supabase/migrations/20240129000000_add_learning_system.sql"
    exit 1
fi

# Run the specified migration
run_migration "$1"

echo ""
echo -e "${BLUE}=== Migration Complete ===${NC}"
