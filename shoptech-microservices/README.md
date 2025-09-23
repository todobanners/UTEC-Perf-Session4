# ShopTech Microservices - Performance Testing Lab

A complete e-commerce microservices system for JMeter performance testing education. Ready to use in under 5 minutes!

## 🚀 Quick Setup

### Prerequisites
- **Docker Desktop** ([Download here](https://www.docker.com/products/docker-desktop))
- **8GB+ RAM** for Docker
- **Ports 80, 3000, 8081-8086, 9090** available

### Installation

#### Option 1: Automated Setup (Recommended)

**Windows:**
```powershell
git clone <your-repo-url>
cd shoptech-microservices
scripts\setup.bat
```

**macOS/Linux:**
```bash
git clone <your-repo-url>
cd shoptech-microservices
./scripts/setup.sh
```

#### Option 2: Manual Setup

```bash
# 1. Clone and navigate
git clone <your-repo-url>
cd shoptech-microservices

# 2. Start all services
docker-compose up -d

# 3. Wait for services to start (30 seconds)
# 4. Test the system
./scripts/test-system.sh
```

### Verification

After setup, all services should respond:
```bash
# Core Microservices
curl http://localhost:8081/health  # Auth Service
curl http://localhost:8082/health  # User Service
curl http://localhost:8083/health  # Product Service
curl http://localhost:8084/health  # Cart Service
curl http://localhost:8085/health  # Order Service
curl http://localhost:8086/health  # Payment Service

# Infrastructure Services
curl http://localhost:80/health     # Nginx Load Balancer
curl http://localhost:9090/-/healthy # Prometheus Monitoring
curl http://localhost:3000/api/health # Grafana Dashboard
```

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Mobile App    │    │     JMeter      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │        Nginx Load Balancer         │
              │            Port 80                 │
              └──────────────────┬──────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐    ┌───────────▼───────────┐    ┌───────▼───────┐
│ Authentication │    │    User Profile      │    │ Product Catalog│
│   Port 8081    │    │     Port 8082        │    │   Port 8083    │
└───────┬───────┘    └───────────┬───────────┘    └───────┬───────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐    ┌───────────▼───────────┐    ┌───────▼───────┐
│ Shopping Cart  │    │  Order Processing    │    │   Payment     │
│   Port 8084    │    │     Port 8085        │    │   Port 8086   │
└────────────────┘    └──────────────────────┘    └───────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
    ┌─────────────────────────────▼─────────────────────────────┐
    │                Monitoring & Observability                 │
    │  ┌─────────────────────┐    ┌─────────────────────────┐   │
    │  │     Prometheus      │    │       Grafana           │   │
    │  │    Port 9090        │    │      Port 3000          │   │
    │  │   (Metrics Store)   │    │   (Dashboards)          │   │
    │  └─────────────────────┘    └─────────────────────────┘   │
    └───────────────────────────────────────────────────────────┘
```

## 🧪 Testing the System

### Quick API Test
```bash
# Option 1: Direct Service Access
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"password123"}'

# Option 2: Via Load Balancer (Recommended for testing)
curl -X POST http://localhost:80/auth/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","password":"password123"}'

# Browse products via load balancer
curl "http://localhost:80/products/api/v1/products?limit=5"

# Run full test suite
./scripts/test-system.sh
```

### Test Credentials
```
Username: john_doe    | Password: password123 | Role: standard
Username: jane_smith  | Password: password123 | Role: premium  
Username: admin_user  | Password: admin123   | Role: admin
```

## 📊 JMeter Performance Testing

### 1. Download JMeter
- Go to https://jmeter.apache.org/download_jmeter.cgi
- Download and extract Apache JMeter 5.5+

### 2. Load Test Template
1. Open JMeter: `bin/jmeter` (Unix) or `bin\jmeter.bat` (Windows)
2. File → Open → `jmeter-templates/basic-user-journey.jmx`
3. Click **Start** (green play button)

### 3. Configure Your Test
- **Thread Group**: Set number of users (threads)
- **Ramp-up Period**: How long to reach full load
- **Loop Count**: How many times each user repeats the journey
- **CSV Data Config**: Uses generated test data automatically

### 4. View Results
- **View Results Tree**: Individual request details
- **Summary Report**: Performance statistics
- **Response Times Over Time**: Performance trends

## 📈 Performance Targets

| Service | Response Time (P95) | Error Rate | Throughput |
|---------|-------------------|------------|------------|
| Auth | < 200ms | < 0.1% | 1000 RPS |
| User | < 150ms | < 0.2% | 800 RPS |
| Product | < 300ms | < 0.1% | 2000 RPS |
| Cart | < 200ms | < 0.2% | 1500 RPS |
| Order | < 500ms | < 0.1% | 500 RPS |
| Payment | < 1000ms | < 0.05% | 200 RPS |

## 🎯 Challenge Objectives

This system helps you learn:

### **Beginner Level**
- Basic load testing with JMeter
- HTTP request configuration
- Response validation and assertions
- CSV data parameterization

### **Intermediate Level**
- **Advanced Controllers**: If/Loop/Module/Switch
- **Data Correlation**: Extract and reuse values between requests
- **Error Handling**: Retry logic and failure scenarios
- **Realistic Load Patterns**: User behavior simulation

### **Advanced Level**
- **Distributed Testing**: Multi-node execution
- **Professional Reporting**: Business-focused analysis
- **Capacity Planning**: SLA validation and bottleneck identification
- **CI/CD Integration**: Automated performance testing

## 📚 API Documentation

### Authentication Service (Port 8081)
```bash
POST /api/v1/auth/login           # User login
GET  /api/v1/auth/validate        # Token validation
POST /api/v1/auth/register        # User registration (testing)
```

### User Profile Service (Port 8082)
```bash
GET  /api/v1/users/{id}/profile   # Get user profile
PUT  /api/v1/users/{id}/profile   # Update profile
PUT  /api/v1/users/{id}/preferences # Update preferences
```

### Product Catalog Service (Port 8083)
```bash
GET  /api/v1/products             # List products (paginated)
GET  /api/v1/products/{id}        # Get product details
GET  /api/v1/products/categories  # Get categories
GET  /api/v1/products/featured    # Get featured products
```

### Shopping Cart Service (Port 8084)
```bash
POST /api/v1/cart                 # Create cart
POST /api/v1/cart/{id}/items      # Add item to cart
GET  /api/v1/cart/{id}            # Get cart contents
PUT  /api/v1/cart/{id}/items/{item_id} # Update cart item
DELETE /api/v1/cart/{id}/items/{item_id} # Remove item
```

### Order Processing Service (Port 8085)
```bash
POST /api/v1/orders               # Create order
GET  /api/v1/orders/{id}          # Get order details
GET  /api/v1/orders/{id}/status   # Get order status
```

### Payment Service (Port 8086)
```bash
POST /api/v1/payments             # Process payment
GET  /api/v1/payments/{id}        # Get payment details
GET  /api/v1/payments/{id}/status # Get payment status
```

## 📊 Test Data

The system includes realistic test data:
- **10,000 users** (70% standard, 25% premium, 5% admin)
- **50,000 products** across 8 categories
- **Geographic distribution** (60% US, 25% EU, 15% APAC)
- **Payment methods** for transaction testing

Regenerate data anytime:
```bash
node scripts/generate-test-data.js
```

## 🔧 System Management

### View Service Logs
```bash
docker-compose logs -f              # All services
docker-compose logs -f auth-service # Specific service
```

### Restart Services
```bash
docker-compose restart              # All services
docker-compose restart auth-service # Specific service
```

### Scale Services
```bash
docker-compose up -d --scale product-service=3
```

### Stop Everything
```bash
docker-compose down
```

### Monitor Resources
```bash
docker stats
```

## 🛠️ Troubleshooting

### Services Won't Start
```bash
# Check port conflicts
netstat -tulpn | grep :808  # Linux/macOS
netstat -an | findstr :808  # Windows

# Check Docker resources
docker stats

# View detailed logs
docker-compose logs [service-name]
```

### Authentication Issues
- Verify test credentials: `john_doe` / `password123`
- Check JWT token extraction in JMeter
- Ensure Authorization header format: `Bearer {token}`

### Performance Issues
- Increase Docker memory to 4GB+
- Monitor system resources during tests
- Check JMeter heap size settings

### Common Fixes
```bash
# Reset everything
docker-compose down
docker system prune -f
docker-compose up -d

# Restart specific service
docker-compose restart [service-name]

# Check service health
curl http://localhost:808X/health
```

## 🎓 Learning Resources

### JMeter Examples
- **Basic User Journey**: Login → Browse → Add to Cart
- **Advanced Scenarios**: Multiple user types, error handling
- **Load Patterns**: Ramp-up, steady state, spike testing
- **Distributed Testing**: Multi-node execution

### Best Practices
- Start with small load, increase gradually
- Use correlation for dynamic values
- Implement proper error handling
- Monitor both client and server metrics
- Document your test scenarios

### Advanced Topics
- Custom JMeter plugins
- Performance monitoring integration
- CI/CD pipeline integration
- Capacity planning methodologies

## 📊 Monitoring & Observability

### Grafana Dashboard (Port 3000)
```bash
# Access Grafana
URL: http://localhost:3000
Username: admin
Password: admin123
```

**Features:**
- Real-time metrics visualization
- Pre-configured dashboards for microservices
- Performance monitoring and alerting
- Historical data analysis

**Available Dashboards:**
- **ShopTech Microservices Overview** - System-wide performance metrics
- **ShopTech Business Metrics** - Authentication, operations, product analytics
- **HTTP Request Metrics** - Request rates, response times, error rates
- **Node.js Runtime** - CPU, memory, garbage collection metrics

**Usage:**
1. Open http://localhost:3000 in your browser
2. Login with admin/admin123
3. Navigate to Dashboards → Browse → ShopTech folder
4. View pre-configured performance dashboards

**Pre-configured Dashboard Features:**
- **Real-time service health status** (up/down indicators)
- **Request rate distribution** by service (pie chart + time series)
- **Response time percentiles** (95th and 50th percentile tracking)
- **Error rate monitoring** (percentage of 5xx responses)
- **Authentication metrics** (login success/failure rates)
- **Business KPIs** (product views, user operations)
- **Memory usage tracking** (Node.js heap size by service)
- **Auto-refresh every 5 seconds** for live monitoring

**Key Metrics Available:**
- `http_requests_total` - Total HTTP requests by service
- `http_request_duration_seconds` - Request latency percentiles
- `auth_login_attempts_total` - Authentication success/failure rates
- `nodejs_process_cpu_user_seconds_total` - CPU usage by service

### Prometheus Monitoring (Port 9090)
```bash
# Access Prometheus
URL: http://localhost:9090

# Check targets status
http://localhost:9090/targets

# Query metrics example
up{job="auth-service"}
```

**Features:**
- Metrics collection from all microservices
- PromQL query language for custom metrics
- Service discovery and health monitoring
- Data retention and storage

**Common Queries:**
```promql
# Service uptime
up{job="auth-service"}

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Nginx Load Balancer (Port 80)
```bash
# Health check
curl http://localhost:80/health

# Access services via load balancer
curl http://localhost:80/auth/api/v1/auth/login
curl http://localhost:80/products/api/v1/products
curl http://localhost:80/users/api/v1/users/profile
```

**Features:**
- Load balancing across microservices
- Centralized access point for testing
- Request logging and monitoring
- SSL termination ready

**Route Configuration:**
- `/auth/*` → Auth Service (8081)
- `/users/*` → User Service (8082)
- `/products/*` → Product Service (8083)
- `/cart/*` → Cart Service (8084)
- `/orders/*` → Order Service (8085)
- `/payments/*` → Payment Service (8086)

### Log Management
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service
docker-compose logs -f nginx
docker-compose logs -f prometheus
docker-compose logs -f grafana

# Access log files
tail -f logs/nginx/access.log
tail -f logs/nginx/error.log
```

**Log Locations:**
- Application logs: `./logs/` (mounted from containers)
- Nginx logs: `./logs/nginx/`
- Container logs: `docker-compose logs`

## 🎯 Performance Testing with Monitoring

### JMeter + Monitoring Integration
```bash
# 1. Start monitoring before testing
# Grafana: http://localhost:3000 (admin/admin123)
# Prometheus: http://localhost:9090

# 2. Configure JMeter to use load balancer
# Server: localhost
# Port: 80
# Protocol: http
# Path: /auth/api/v1/auth/login

# 3. Open Grafana dashboards before testing
# Navigate to: Dashboards → Browse → ShopTech folder
# - "ShopTech Microservices Overview" for system metrics
# - "ShopTech Business Metrics" for application KPIs

# 4. Run load test and monitor in real-time
# Watch metrics in Grafana during test execution
```

### Real-time Performance Monitoring
During JMeter load testing, monitor these key indicators in Grafana:

**System Health:**
- Service uptime status (should remain green/1)
- Request rate per service (should scale with load)
- Response time percentiles (95th should stay under targets)
- Error rate percentage (should remain under 1%)

**Business Impact:**
- Authentication success rates
- Product view rates
- API endpoint utilization
- Memory consumption trends

**Alert Thresholds to Watch:**
- Response time 95th percentile > 1000ms
- Error rate > 5%
- Memory usage > 80% of available
- Service health status = 0 (down)

### Monitoring Best Practices
1. **Baseline Metrics**: Record system performance before testing
2. **Real-time Monitoring**: Watch dashboards during test execution
3. **Resource Monitoring**: Track CPU, memory, network usage
4. **Service Health**: Monitor response times and error rates
5. **Load Balancer Metrics**: Check distribution and performance

### Performance Analysis Workflow
1. **Pre-test**: Check all services are healthy
2. **During test**: Monitor real-time metrics in Grafana
3. **Post-test**: Analyze historical data and trends
4. **Reporting**: Export charts and create performance reports

## 📈 Metrics Implementation

### Available Metrics

All microservices now expose comprehensive metrics at `/metrics` endpoints:

#### **HTTP Request Metrics**
```promql
# Total requests by service
http_requests_total{service="auth_service"}

# Request duration percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate by service
rate(http_requests_total{status_code=~"5.."}[5m])
```

#### **Business Metrics**
```promql
# Authentication metrics
auth_login_attempts_total{status="success"}
auth_login_attempts_total{status="failure"}
auth_token_validations_total{status="valid"}

# Service-specific operations
user_service_operations_total{operation="profile_update"}
product_service_operations_total{operation="search"}
```

#### **Node.js Runtime Metrics**
```promql
# CPU usage
nodejs_process_cpu_user_seconds_total

# Memory usage
nodejs_heap_size_used_bytes

# Garbage collection
nodejs_gc_duration_seconds
```

### Metrics Endpoints
```bash
# Direct service access
curl http://localhost:8081/metrics  # Auth Service
curl http://localhost:8082/metrics  # User Service
curl http://localhost:8083/metrics  # Product Service
curl http://localhost:8084/metrics  # Cart Service
curl http://localhost:8085/metrics  # Order Service
curl http://localhost:8086/metrics  # Payment Service

# Via load balancer
curl http://localhost:80/auth/metrics
curl http://localhost:80/products/metrics
```

### Service Health in Prometheus
```bash
# Check all services status
curl "http://localhost:9090/api/v1/query?query=up"

# Services should show value="1" for healthy
# auth-service:8081, user-service:8082, product-service:8083,
# cart-service:8084, order-service:8085, payment-service:8086
```

## 🤝 Support

### Quick Help
1. **Check system status**: `./scripts/test-system.sh`
2. **View service logs**: `docker-compose logs -f`
3. **Restart services**: `docker-compose restart`
4. **Reset everything**: `docker-compose down && docker-compose up -d`
5. **Access monitoring**: Grafana (http://localhost:3000) | Prometheus (http://localhost:9090)
6. **Load balancer health**: `curl http://localhost:80/health`

### Getting Help
- Review the troubleshooting section above
- Check service logs for error messages
- Verify Docker has sufficient resources
- Ensure all ports are available

---

## 🚀 Ready to Start Performance Testing!

1. **Setup Complete?** ✅ Run `./scripts/test-system.sh`
2. **Monitoring Active?** ✅ Check Grafana (http://localhost:3000) & Prometheus (http://localhost:9090)
3. **Load Balancer Working?** ✅ Test `curl http://localhost:80/health`
4. **JMeter Installed?** ✅ Download from https://jmeter.apache.org/
5. **Template Loaded?** ✅ Open `jmeter-templates/basic-user-journey.jmx`
6. **Start Testing!** 🎯 Configure JMeter to use load balancer (localhost:80) and monitor in real-time

**Happy Performance Testing! 🚀**

## 📋 Complete Service Checklist

**Infrastructure Services:**
- ✅ Nginx Load Balancer (Port 80)
- ✅ Prometheus Monitoring (Port 9090)
- ✅ Grafana Dashboard (Port 3000)

**Microservices:**
- ✅ Auth Service (Port 8081)
- ✅ User Service (Port 8082)
- ✅ Product Service (Port 8083)
- ✅ Cart Service (Port 8084)
- ✅ Order Service (Port 8085)
- ✅ Payment Service (Port 8086)

**Observability:**
- ✅ Centralized logging
- ✅ Real-time metrics (Prometheus)
- ✅ Performance dashboards (Grafana)
- ✅ Load balancer monitoring
- ✅ Business metrics tracking
- ✅ HTTP request monitoring
- ✅ Node.js runtime metrics

## 🎉 Complete Metrics Implementation

### ✅ What's Been Added

**Prometheus Metrics Integration:**
- All 6 microservices now expose `/metrics` endpoints
- Comprehensive HTTP request tracking (rate, duration, errors)
- Business-specific metrics (auth attempts, operations)
- Node.js runtime metrics (CPU, memory, GC)

**Grafana Dashboards:**
- **ShopTech Microservices Overview** - Complete system monitoring
- **ShopTech Business Metrics** - Application-level KPIs
- Auto-refresh every 5 seconds for real-time monitoring
- Service health indicators with color-coded status

**Enhanced Monitoring Stack:**
- Prometheus (Port 9090) - Metrics collection and storage
- Grafana (Port 3000) - Visualization and dashboards
- Nginx (Port 80) - Load balancer with centralized access
- All services instrumented with prom-client library

### 🚀 Ready for Performance Testing

Your system now provides complete observability for JMeter load testing:

1. **Pre-test Setup**: All services healthy and metrics flowing
2. **Live Monitoring**: Real-time dashboards during load tests
3. **Performance Analysis**: Historical data and trend analysis
4. **Business Impact**: Track authentication, API usage, and operations

**Next Steps:**
1. Open Grafana: http://localhost:3000 (admin/admin123)
2. Navigate to ShopTech dashboards
3. Run your JMeter tests with real-time monitoring
4. Analyze performance bottlenecks with precise metrics