#!/bin/bash

# Kafka-based Microservices Deployment Script
set -e

echo "🚀 Starting Kafka-based automation microservices deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if Docker and Docker Compose are installed
print_status "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Prerequisites check passed"

# Stop existing containers if any
print_status "Stopping any existing containers..."
docker-compose -f docker-compose.kafka.yml down --remove-orphans 2>/dev/null || true

# Clean up old images if requested
if [[ "$1" == "--clean" ]]; then
    print_status "Cleaning up old images..."
    docker system prune -f
    docker volume prune -f
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p downloads
mkdir -p logs
mkdir -p nginx/ssl

# Build images
print_status "Building Docker images..."
docker-compose -f docker-compose.kafka.yml build --parallel

# Start infrastructure services first (Zookeeper, Kafka)
print_status "Starting infrastructure services..."
docker-compose -f docker-compose.kafka.yml up -d zookeeper kafka

# Wait for Kafka to be ready
print_status "Waiting for Kafka to be ready..."
sleep 30

# Check Kafka health
print_status "Checking Kafka health..."
for i in {1..30}; do
    if docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 &> /dev/null; then
        print_success "Kafka is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Kafka failed to start after 5 minutes"
        exit 1
    fi
    echo -n "."
    sleep 10
done

# Create Kafka topics
print_status "Creating Kafka topics..."
docker exec kafka kafka-topics --create --topic automation-tasks --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1 --if-not-exists
docker exec kafka kafka-topics --create --topic automation-results --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1 --if-not-exists

print_success "Kafka topics created"

# Start Kafka UI
print_status "Starting Kafka UI..."
docker-compose -f docker-compose.kafka.yml up -d kafka-ui

# Start automation workers
print_status "Starting automation workers..."
docker-compose -f docker-compose.kafka.yml up -d automation-worker-1 automation-worker-2 automation-worker-3

# Wait for workers to be ready
print_status "Waiting for automation workers to be ready..."
sleep 20

# Start backend service
print_status "Starting backend service..."
docker-compose -f docker-compose.kafka.yml up -d backend

# Start Nginx load balancer
print_status "Starting Nginx load balancer..."
cp nginx.kafka.conf nginx/nginx.conf
docker-compose -f docker-compose.kafka.yml up -d nginx

# Final health checks
print_status "Performing final health checks..."
sleep 10

# Check service health
services=("kafka-ui:8080" "automation-worker-1:5000" "automation-worker-2:5000" "automation-worker-3:5000" "nginx:80")

for service in "${services[@]}"; do
    container_name=$(echo $service | cut -d':' -f1)
    port=$(echo $service | cut -d':' -f2)
    
    if docker exec $container_name wget -q --spider http://localhost:$port/health 2>/dev/null; then
        print_success "$container_name health check passed"
    else
        print_warning "$container_name health check failed (this may be normal during startup)"
    fi
done

# Display service URLs
echo ""
echo "=========================="
echo "🎉 Deployment Complete!"
echo "=========================="
echo ""
echo "Service URLs:"
echo "• Kafka UI (Monitoring):     http://localhost:8080"
echo "• Load Balancer (Nginx):     http://localhost"
echo "• Backend API:               http://localhost/api"
echo "• Worker 1 Health:           http://localhost/worker-1/health"
echo "• Worker 2 Health:           http://localhost/worker-2/health"
echo "• Worker 3 Health:           http://localhost/worker-3/health"
echo "• Downloaded Files:          http://localhost/downloads"
echo ""
echo "Kafka Configuration:"
echo "• Bootstrap Servers:         localhost:9092"
echo "• Task Topic:                automation-tasks"
echo "• Result Topic:              automation-results"
echo "• Consumer Group:            automation-workers"
echo ""
echo "Management Commands:"
echo "• View logs:                 docker-compose -f docker-compose.kafka.yml logs -f"
echo "• Scale workers:             docker-compose -f docker-compose.kafka.yml up -d --scale automation-worker=5"
echo "• Stop all:                  docker-compose -f docker-compose.kafka.yml down"
echo "• Restart:                   ./deploy-kafka.sh"
echo ""
print_success "Kafka-based automation microservices are now running!"
