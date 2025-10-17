@echo off
REM ShopTech Microservices Setup Script for Windows

echo 🚀 Setting up ShopTech Microservices for Performance Testing
echo ============================================================

echo 📋 Checking prerequisites...

REM Check for Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop:
    echo    https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check for Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install Docker Desktop:
    echo    https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo ✅ Docker and Docker Compose are available

REM Check for Node.js (optional)
node --version >nul 2>&1
if errorlevel 1 (
    echo ℹ️  Node.js not found (optional for Docker-only setup)
) else (
    echo ✅ Node.js detected (for local development)
)

echo.
echo 🔧 Setting up the environment...

REM Create necessary directories
echo 📁 Creating directories...
if not exist "logs" mkdir logs
if not exist "data" mkdir data
if not exist "monitoring" mkdir monitoring
if not exist "nginx" mkdir nginx

REM Generate test data
echo 📊 Generating test data...
node --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Skipping test data generation (Node.js required)
    echo    Test data will be generated when services start
) else (
    node generate-test-data.js
)

REM Build and start services
echo 🐳 Building and starting Docker containers...
docker-compose down --remove-orphans >nul 2>&1
docker-compose build
docker-compose up -d

echo ⏳ Waiting for services to start...
timeout /t 30 /nobreak >nul

REM Health check
echo 🏥 Checking service health...
set "all_healthy=true"

curl -f -s "http://localhost:8081/health" >nul 2>&1
if errorlevel 1 (
    echo ❌ auth-service is not responding
    set "all_healthy=false"
) else (
    echo ✅ auth-service is healthy
)

curl -f -s "http://localhost:8082/health" >nul 2>&1
if errorlevel 1 (
    echo ❌ user-service is not responding
    set "all_healthy=false"
) else (
    echo ✅ user-service is healthy
)

curl -f -s "http://localhost:8083/health" >nul 2>&1
if errorlevel 1 (
    echo ❌ product-service is not responding
    set "all_healthy=false"
) else (
    echo ✅ product-service is healthy
)

echo.
if "%all_healthy%"=="true" (
    echo 🎉 Setup completed successfully!
    echo.
    echo 📍 Service URLs:
    echo    Auth Service:     http://localhost:8081
    echo    User Service:     http://localhost:8082
    echo    Product Service:  http://localhost:8083
    echo    Cart Service:     http://localhost:8084
    echo    Order Service:    http://localhost:8085
    echo    Payment Service:  http://localhost:8086
    echo.
    echo 📊 Monitoring:
    echo    Grafana:     http://localhost:3000 (admin/admin123)
    echo    Prometheus:  http://localhost:9090
    echo.
    echo 🧪 Test with:
    echo    curl http://localhost:8081/health
    echo.
    echo 📚 Next steps:
    echo    1. Open JMeter: Download from https://jmeter.apache.org/
    echo    2. Load test template: jmeter-templates/basic-user-journey.jmx
    echo    3. Configure test parameters in JMeter
    echo    4. Start your performance testing!
) else (
    echo ⚠️  Some services are not healthy. Check logs with:
    echo    docker-compose logs [service-name]
    echo.
    echo 🔧 Troubleshooting:
    echo    1. Check if ports are available: netstat -an | findstr :808
    echo    2. Check Docker resources: docker stats
    echo    3. Check service logs: docker-compose logs -f
)

echo.
echo Press any key to continue...
pause >nul
