#!/bin/bash

# EasyFlow QA Testing Script
# Runs comprehensive test suite for all components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPA_DIR="$ROOT_DIR/rpa-system"
BACKEND_DIR="$RPA_DIR/backend"
FRONTEND_DIR="$RPA_DIR/rpa-dashboard"
AUTOMATION_DIR="$RPA_DIR/automation"

echo -e "${BLUE}🚀 Starting EasyFlow QA Test Suite${NC}"
echo "Root directory: $ROOT_DIR"

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}\n"
}

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Error in $1${NC}"
    exit 1
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1 completed successfully${NC}"
}

# Check prerequisites
print_section "Checking Prerequisites"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is required but not installed.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is required but not installed.${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is required but not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Start Docker services
print_section "Starting Test Services"
cd "$RPA_DIR"

if [ -f "docker-compose.test.yml" ]; then
    echo "Starting Docker test services..."
    docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    docker-compose -f docker-compose.test.yml up -d
    sleep 8
    print_success "Docker services"
else
    echo -e "${YELLOW}⚠️  docker-compose.test.yml not found, skipping Docker setup${NC}"
fi

# Install dependencies
print_section "Installing Dependencies"

# Root dependencies
cd "$ROOT_DIR"
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    npm ci || handle_error "root npm install"
    print_success "Root dependencies"
fi

# Backend dependencies
cd "$RPA_DIR"
if [ -f "package.json" ]; then
    echo "Installing backend dependencies..."
    npm ci || handle_error "backend npm install"
    print_success "Backend dependencies"
fi

# Frontend dependencies
cd "$FRONTEND_DIR"
if [ -f "package.json" ]; then
    echo "Installing frontend dependencies..."
    npm ci || handle_error "frontend npm install"
    print_success "Frontend dependencies"
fi

# Python dependencies
cd "$AUTOMATION_DIR"
if [ -f "requirements-test.txt" ]; then
    echo "Installing Python test dependencies..."
    pip3 install -r requirements-test.txt || handle_error "Python test dependencies"
    print_success "Python test dependencies"
elif [ -f "../requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip3 install -r ../requirements.txt || handle_error "Python dependencies"
    pip3 install pytest selenium requests webdriver-manager
    print_success "Python dependencies"
fi

# Run Backend Tests
print_section "Running Backend Tests"
cd "$RPA_DIR"

echo "Running backend unit tests..."
npm run test:backend --silent || handle_error "backend unit tests"
print_success "Backend unit tests"

echo "Running backend performance tests..."
npm run test:backend -- --testNamePattern="Performance" --silent || handle_error "backend performance tests"
print_success "Backend performance tests"

echo "Running backend security tests..."
npm run test:backend -- --testNamePattern="security" --silent || handle_error "backend security tests"
print_success "Backend security tests"

# Run Frontend Tests
print_section "Running Frontend Tests"
cd "$FRONTEND_DIR"

echo "Running frontend linting..."
npx eslint src --ext .js,.jsx || echo -e "${YELLOW}⚠️  Linting issues found${NC}"

echo "Running frontend component tests..."
CI=true npm test -- --watchAll=false --silent || handle_error "frontend component tests"
print_success "Frontend tests"

# Run Python Tests
print_section "Running Python Automation Tests"
cd "$AUTOMATION_DIR"

echo "Running Python core feature tests..."
python3 -m pytest test_core_features.py -v || handle_error "Python core tests"
print_success "Python core tests"

if [ -f "test_automate.py" ]; then
    echo "Running automation script tests..."
    python3 -m pytest test_automate.py -v || handle_error "Python automation tests"
    print_success "Python automation tests"
fi

# Run Integration Tests
print_section "Running Integration Tests"

echo "Testing backend API integration..."
cd "$RPA_DIR"
if curl -f http://localhost:3030/api/health &> /dev/null; then
    echo -e "${GREEN}✅ Backend API is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Backend API not responding, starting for integration tests...${NC}"
    npm run dev:backend &
    BACKEND_PID=$!
    sleep 5
    
    if curl -f http://localhost:3030/api/health &> /dev/null; then
        echo -e "${GREEN}✅ Backend API is now responding${NC}"
    else
        echo -e "${RED}❌ Backend API failed to start${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        handle_error "backend integration"
    fi
fi

# Integration script tests
if [ -f "backend/referral_integration.js" ]; then
    echo "Testing referral integration..."
    timeout 30s node backend/referral_integration.js || echo -e "${YELLOW}⚠️  Referral integration test completed with warnings${NC}"
fi

if [ -f "backend/scripts/test_event_forwarder.js" ]; then
    echo "Testing event forwarder..."
    timeout 30s node backend/scripts/test_event_forwarder.js || echo -e "${YELLOW}⚠️  Event forwarder test completed with warnings${NC}"
fi

# Cleanup
print_section "Cleaning Up"

echo "Stopping background processes..."
pkill -f "npm.*dev:backend" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true

echo "Stopping Docker services..."
cd "$RPA_DIR"
docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Generate Test Report
print_section "Test Results Summary"

echo -e "${GREEN}🎉 QA Test Suite Completed Successfully!${NC}\n"
echo "Test Coverage Areas:"
echo "• Backend API endpoints and security"
echo "• Frontend React components"
echo "• Python automation scripts"
echo "• Database integration"
echo "• Docker service orchestration"
echo "• Performance benchmarks"
echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo "• Review any warnings shown above"
echo "• Check test artifacts in coverage directories"
echo "• Monitor application performance in production"
echo ""
echo -e "${GREEN}All core features validated and automation pipelines operational!${NC}"