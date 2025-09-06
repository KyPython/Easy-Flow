#!/bin/bash

# EasyFlow Staging Deployment Script
# This script deploys the staging environment with monitoring and testing capabilities

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
PROJECT_NAME="easyflow-staging"

echo -e "${BLUE}🚀 EasyFlow Staging Deployment${NC}"
echo "================================"

# Function to check if required files exist
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    required_files=(
        ".env"
        "docker-compose.yml" 
        "docker-compose.staging.yml"
        "Dockerfile.backend"
        "Dockerfile.email_worker"
        "automation/Dockerfile"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            echo -e "${RED}❌ Required file missing: $file${NC}"
            exit 1
        fi
    done
    
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to check environment variables
check_environment() {
    echo -e "${BLUE}🔧 Checking environment configuration...${NC}"
    
    required_env_vars=(
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE"
        "SUPABASE_ANON_KEY"
    )
    
    # Load .env file
    if [[ -f ".env" ]]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo -e "${RED}❌ Required environment variable missing: $var${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✅ Environment configuration check passed${NC}"
}

# Function to stop existing services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping existing services...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}✅ Existing services stopped${NC}"
}

# Function to build and start services
deploy_services() {
    echo -e "${BLUE}🏗️  Building and deploying services...${NC}"
    
    # Build images
    echo -e "${YELLOW}Building images...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" build --no-cache
    
    # Start core services first
    echo -e "${YELLOW}Starting core services...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" up -d \
        backend automation email_worker hooks_probe nginx
    
    # Wait for core services to be healthy
    echo -e "${YELLOW}Waiting for core services to be healthy...${NC}"
    sleep 30
    
    # Start monitoring services
    echo -e "${YELLOW}Starting monitoring services...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" up -d \
        prometheus grafana redis node-exporter
    
    echo -e "${GREEN}✅ Services deployed successfully${NC}"
}

# Function to verify deployment
verify_deployment() {
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"
    
    # Check service health
    services=(
        "http://localhost:3030/health:Backend"
        "http://localhost:7001/health:Automation" 
        "http://localhost:9090/-/healthy:Prometheus"
        "http://localhost:3001/api/health:Grafana"
    )
    
    for service in "${services[@]}"; do
        url="${service%%:*}"
        name="${service##*:}"
        
        echo -e "${YELLOW}Checking $name...${NC}"
        
        max_attempts=30
        attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if curl -f -s "$url" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $name is healthy${NC}"
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                echo -e "${RED}❌ $name health check failed after $max_attempts attempts${NC}"
                return 1
            fi
            
            echo -e "${YELLOW}  Attempt $attempt/$max_attempts failed, retrying in 5s...${NC}"
            sleep 5
            ((attempt++))
        done
    done
    
    echo -e "${GREEN}✅ All services are healthy${NC}"
}

# Function to run initial tests
run_initial_tests() {
    echo -e "${BLUE}🧪 Running initial tests...${NC}"
    
    # Run basic load test
    echo -e "${YELLOW}Running basic load test...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" run --rm \
        --profile testing k6-load-tester run \
        --vus 5 --duration 30s /scripts/basic-load-test.js
    
    echo -e "${GREEN}✅ Initial load test completed${NC}"
}

# Function to display deployment summary
show_summary() {
    echo -e "\n${GREEN}🎉 Staging Deployment Completed!${NC}"
    echo "=================================="
    echo
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo "  • Backend API:     http://localhost:3030"
    echo "  • Automation:      http://localhost:7001" 
    echo "  • Prometheus:      http://localhost:9090"
    echo "  • Grafana:         http://localhost:3001 (admin/staging_admin_2024)"
    echo "  • Hooks Probe:     http://localhost:4001"
    echo
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "  • View logs:       docker-compose $COMPOSE_FILES -p $PROJECT_NAME logs -f [service]"
    echo "  • Stop services:   docker-compose $COMPOSE_FILES -p $PROJECT_NAME down"
    echo "  • Restart service: docker-compose $COMPOSE_FILES -p $PROJECT_NAME restart [service]"
    echo
    echo -e "${BLUE}🧪 Testing Commands:${NC}"
    echo "  • Load test:       ./run-load-tests.sh"
    echo "  • Security test:   ./run-security-tests.sh"
    echo "  • Health check:    curl http://localhost:3030/health"
    echo
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "  1. Check Grafana dashboards at http://localhost:3001"
    echo "  2. Monitor logs: docker-compose $COMPOSE_FILES -p $PROJECT_NAME logs -f"
    echo "  3. Run comprehensive tests: ./run-tests.sh"
}

# Main execution flow
main() {
    echo -e "${BLUE}Starting deployment at $(date)${NC}\n"
    
    check_prerequisites
    check_environment
    stop_services
    deploy_services
    verify_deployment
    run_initial_tests
    show_summary
    
    echo -e "\n${GREEN}✅ Deployment completed successfully at $(date)${NC}"
}

# Handle script interruption
cleanup() {
    echo -e "\n${RED}🛑 Deployment interrupted${NC}"
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
    exit 1
}

trap cleanup INT TERM

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        deploy_services
        verify_deployment
        ;;
    "logs")
        docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" logs -f "${2:-}"
        ;;
    "status")
        docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" ps
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|logs [service]|status}"
        exit 1
        ;;
esac