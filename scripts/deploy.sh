#!/bin/bash

# EasyFlow Deployment Script for Render.com + Vercel
# This script automates the deployment process

set -e

echo "🚀 Starting EasyFlow deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="easyflow"
RENDER_SERVICE_NAME="easyflow-backend"
VERCEL_PROJECT_NAME="easyflow-dashboard"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if required commands exist
    if ! command -v git &> /dev/null; then
        print_error "git is required but not installed"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "node is required but not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "render.yaml" || ! -f "vercel.json" ]]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build and test the project
build_and_test() {
    print_status "Building and testing the project..."
    
    # Install dependencies
    cd rpa-system
    npm install
    
    # Test backend
    print_status "Testing backend..."
    cd backend
    npm test -- --passWithNoTests
    cd ..
    
    # Build and test frontend
    print_status "Building frontend..."
    cd rpa-dashboard
    npm install
    npm run build
    
    # Check if build was successful
    if [[ ! -d "build" ]]; then
        print_error "Frontend build failed"
        exit 1
    fi
    
    cd ../..
    print_success "Build and test completed"
}

# Deploy to Render.com
deploy_backend() {
    print_status "Deploying backend to Render.com..."
    
    # Check if render.yaml exists and is valid
    if [[ ! -f "render.yaml" ]]; then
        print_error "render.yaml not found"
        exit 1
    fi
    
    # Commit latest changes
    if [[ -n $(git status --porcelain) ]]; then
        git add .
        git commit -m "🚀 Deploy: $(date +"%Y-%m-%d %H:%M:%S")"
    fi
    
    # Push to trigger Render deployment
    git push origin main
    
    print_success "Backend deployment triggered"
    print_warning "Monitor deployment at: https://dashboard.render.com"
}

# Deploy to Vercel
deploy_frontend() {
    print_status "Deploying frontend to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod --yes
    
    print_success "Frontend deployed to Vercel"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if database URL is set
    if [[ -z "$DATABASE_URL" ]]; then
        print_warning "DATABASE_URL not set. Skipping migrations."
        print_warning "Run migrations manually after deployment."
        return
    fi
    
    # Run migrations
    cd rpa-system/backend
    for migration in migrations/*.sql; do
        print_status "Running migration: $(basename $migration)"
        psql "$DATABASE_URL" -f "$migration"
    done
    cd ../..
    
    print_success "Database migrations completed"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Wait a bit for services to start
    sleep 30
    
    # Check backend health
    BACKEND_URL="https://${RENDER_SERVICE_NAME}.onrender.com"
    if curl -f "$BACKEND_URL/health" &> /dev/null; then
        print_success "Backend health check passed: $BACKEND_URL"
    else
        print_error "Backend health check failed: $BACKEND_URL"
    fi
    
    # Check frontend
    FRONTEND_URL="https://${VERCEL_PROJECT_NAME}.vercel.app"
    if curl -f "$FRONTEND_URL" &> /dev/null; then
        print_success "Frontend accessibility check passed: $FRONTEND_URL"
    else
        print_error "Frontend accessibility check failed: $FRONTEND_URL"
    fi
}

# Main deployment function
main() {
    echo "======================================"
    echo "🚀 EasyFlow Deployment Script"
    echo "======================================"
    
    check_prerequisites
    build_and_test
    run_migrations
    deploy_backend
    deploy_frontend
    verify_deployment
    
    echo "======================================"
    print_success "Deployment completed successfully!"
    echo "======================================"
    echo ""
    echo "📋 Deployment Summary:"
    echo "• Backend: https://${RENDER_SERVICE_NAME}.onrender.com"
    echo "• Frontend: https://${VERCEL_PROJECT_NAME}.vercel.app"
    echo "• Health Check: https://${RENDER_SERVICE_NAME}.onrender.com/health"
    echo "• Database Health: https://${RENDER_SERVICE_NAME}.onrender.com/api/health/databases"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Update DNS records if using custom domain"
    echo "2. Configure environment variables in Render/Vercel dashboards"
    echo "3. Set up monitoring and alerts"
    echo "4. Configure backup strategy"
}

# Run the main function
main "$@"
