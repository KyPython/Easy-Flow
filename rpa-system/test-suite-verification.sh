#!/bin/bash

# EasyFlow Test Suite Verification Script
# Verifies that load and security testing scripts are properly configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

echo "🧪 EasyFlow Test Suite Verification"
echo "=================================="
echo ""

# Check if scripts exist and are executable
print_info "Checking test scripts..."

if [[ -x "run-load-tests.sh" ]]; then
    print_success "Load test script found and executable"
else
    print_error "Load test script missing or not executable"
    exit 1
fi

if [[ -x "run-security-tests.sh" ]]; then
    print_success "Security test script found and executable"
else
    print_error "Security test script missing or not executable"
    exit 1
fi

echo ""

# Check test directories and files
print_info "Checking test structure..."

if [[ -d "tests/load" ]]; then
    print_success "Load test directory exists"
    if [[ -f "tests/load/basic-load-test.k6.js" ]]; then
        print_success "K6 load test script found"
    else
        print_warning "K6 load test script not found"
    fi
else
    print_warning "Load test directory not found"
fi

if [[ -d "tests/security" ]]; then
    print_success "Security test directory exists" 
    if [[ -f "tests/security/basic-security-scan.py" ]]; then
        print_success "Python security scan script found"
    else
        print_warning "Python security scan script not found"
    fi
else
    print_warning "Security test directory not found"
fi

echo ""

# Check dependencies
print_info "Checking dependencies..."

if command -v curl &> /dev/null; then
    print_success "curl available"
else
    print_error "curl not available"
fi

if command -v docker &> /dev/null; then
    print_success "Docker available"
else
    print_warning "Docker not available (required for staging tests)"
fi

if command -v docker-compose &> /dev/null; then
    print_success "Docker Compose available"
else
    print_warning "Docker Compose not available (required for staging tests)"
fi

echo ""

# Test basic functionality
print_info "Testing basic functionality..."

# Test load test script help
if ./run-load-tests.sh --help >/dev/null 2>&1; then
    print_success "Load test script help works"
else
    print_warning "Load test script help may have issues"
fi

# Test security test script help
if ./run-security-tests.sh --help >/dev/null 2>&1; then
    print_success "Security test script help works"
else
    print_warning "Security test script help may have issues"
fi

echo ""

# Check if staging environment is available
print_info "Checking staging environment availability..."

if [[ -f "docker-compose.staging.yml" ]]; then
    print_success "Staging docker-compose file found"
    
    # Check if staging is running
    if docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps | grep -q "Up"; then
        print_success "Staging environment is running"
    else
        print_warning "Staging environment is not running (use ./deploy-staging.sh to start)"
    fi
else
    print_warning "Staging docker-compose file not found"
fi

echo ""

# Quick connectivity test
print_info "Testing connectivity..."

if curl -f -s --max-time 5 "http://localhost:3030/health" >/dev/null 2>&1; then
    print_success "Backend health endpoint reachable at localhost:3030"
elif curl -f -s --max-time 5 "http://localhost:3000" >/dev/null 2>&1; then
    print_success "Some service reachable at localhost:3000"
else
    print_warning "No services detected on standard ports (this is okay if not running)"
fi

echo ""

# Provide recommendations
print_info "Recommendations:"
echo "📋 Test Suite Usage:"
echo "  • Load tests:     ./run-load-tests.sh --url http://localhost:3030"
echo "  • Security tests: ./run-security-tests.sh --url http://localhost:3030"
echo "  • Staging tests:  ./deploy-staging.sh && ./run-load-tests.sh"
echo ""

echo "🔧 Optional Enhancements:"
if ! command -v k6 &> /dev/null; then
    echo "  • Install K6 for advanced load testing: https://k6.io/docs/getting-started/installation/"
fi

if ! command -v python3 &> /dev/null; then
    echo "  • Install Python3 for security testing"
fi

if ! command -v zap.sh &> /dev/null && ! command -v zap &> /dev/null; then
    echo "  • Install OWASP ZAP for comprehensive security scans: https://owasp.org/www-project-zap/"
fi

echo ""
print_success "Test suite verification completed! 🎉"
print_info "You're ready to run load and security tests."