#!/bin/bash

# ShopTech Microservices Setup Script
# Compatible with macOS and Linux

set -e  # Exit on any error

echo "🚀 Setting up ShopTech Microservices for Performance Testing"
echo "============================================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker is running
docker_running() {
    docker info >/dev/null 2>&1
}

echo "📋 Checking prerequisites..."

# Check for Docker
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker Desktop:"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check for Docker Compose
if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker is running
if ! docker_running; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Check for Node.js (optional, for local development)
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js $NODE_VERSION detected (for local development)"
else
    echo "ℹ️  Node.js not found (optional for Docker-only setup)"
fi

echo ""
echo "🔧 Setting up the environment..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data
mkdir -p monitoring
mkdir -p nginx

# Generate test data
echo "📊 Generating test data..."
if command_exists node; then
    node scripts/generate-test-data.js
else
    echo "⚠️  Skipping test data generation (Node.js required)"
    echo "   Test data will be generated when services start"
fi

# Build and start services
echo "🐳 Building and starting Docker containers..."
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose build
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Checking service health..."
services=("auth-service:8081" "user-service:8082" "product-service:8083")
all_healthy=true

for service in "${services[@]}"; do
    service_name=${service%%:*}
    port=${service##*:}
    
    if curl -f -s "http://localhost:$port/health" >/dev/null; then
        echo "✅ $service_name is healthy"
    else
        echo "❌ $service_name is not responding"
        all_healthy=false
    fi
done

echo ""
if [ "$all_healthy" = true ]; then
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📍 Service URLs:"
    echo "   Auth Service:     http://localhost:8081"
    echo "   User Service:     http://localhost:8082"
    echo "   Product Service:  http://localhost:8083"
    echo "   Cart Service:     http://localhost:8084"
    echo "   Order Service:    http://localhost:8085"
    echo "   Payment Service:  http://localhost:8086"
    echo ""
    echo "📊 Monitoring:"
    echo "   Grafana:     http://localhost:3000 (admin/admin123)"
    echo "   Prometheus:  http://localhost:9090"
    echo ""
    echo "🧪 Test with:"
    echo "   curl http://localhost:8081/health"
    echo ""
    echo "📚 Next steps:"
    echo "   1. Open JMeter: Download from https://jmeter.apache.org/"
    echo "   2. Load test template: jmeter-templates/basic-user-journey.jmx"
    echo "   3. Configure test parameters in JMeter"
    echo "   4. Start your performance testing!"
else
    echo "⚠️  Some services are not healthy. Check logs with:"
    echo "   docker-compose logs [service-name]"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Check if ports are available: netstat -tulpn | grep :808"
    echo "   2. Check Docker resources: docker stats"
    echo "   3. Check service logs: docker-compose logs -f"
    exit 1
fi