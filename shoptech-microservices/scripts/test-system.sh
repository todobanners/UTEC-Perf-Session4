#!/bin/bash

echo "🧪 Testing ShopTech Microservices System"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.txt "$url")
    http_code="${response: -3}"
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        return 1
    fi
}

# Function to test authenticated endpoint
test_auth_endpoint() {
    local url=$1
    local description=$2
    local token=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.txt \
        -H "Authorization: Bearer $token" \
        "$url")
    http_code="${response: -3}"
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        return 1
    fi
}

echo -e "${YELLOW}1. Health Checks${NC}"
test_endpoint "http://localhost:8081/health" "Auth Service Health"
test_endpoint "http://localhost:8082/health" "User Service Health"
test_endpoint "http://localhost:8083/health" "Product Service Health"
test_endpoint "http://localhost:8084/health" "Cart Service Health"
test_endpoint "http://localhost:8085/health" "Order Service Health"
test_endpoint "http://localhost:8086/health" "Payment Service Health"

echo -e "\n${YELLOW}2. Authentication Flow${NC}"

# Test login
echo -n "Testing user login... "
response=$(curl -s -X POST http://localhost:8081/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"john_doe","password":"password123"}')

if echo "$response" | grep -q "token"; then
    echo -e "${GREEN}✓ PASS${NC}"
    # Extract token
    token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    user_id=$(echo "$response" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)
    echo "  Token extracted: ${token:0:50}..."
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $response"
    exit 1
fi

# Test token validation
test_auth_endpoint "http://localhost:8081/api/v1/auth/validate" "Token Validation" "$token"

echo -e "\n${YELLOW}3. Service Integration${NC}"

# Test user profile
test_auth_endpoint "http://localhost:8082/api/v1/users/$user_id/profile" "User Profile" "$token"

# Test product listing
test_endpoint "http://localhost:8083/api/v1/products?limit=5" "Product Listing"

# Test product details (get first product ID)
echo -n "Getting product ID... "
product_response=$(curl -s "http://localhost:8083/api/v1/products?limit=1")
product_id=$(echo "$product_response" | grep -o '"product_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$product_id" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    test_endpoint "http://localhost:8083/api/v1/products/$product_id" "Product Details"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo -e "\n${YELLOW}4. Complete User Journey${NC}"

# Create cart
echo -n "Creating shopping cart... "
cart_response=$(curl -s -X POST http://localhost:8084/api/v1/cart \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "{\"user_id\":\"$user_id\"}")

if echo "$cart_response" | grep -q "cart_id"; then
    echo -e "${GREEN}✓ PASS${NC}"
    cart_id=$(echo "$cart_response" | grep -o '"cart_id":"[^"]*"' | cut -d'"' -f4)
    echo "  Cart ID: $cart_id"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $cart_response"
fi

# Add item to cart
if [ -n "$cart_id" ] && [ -n "$product_id" ]; then
    echo -n "Adding item to cart... "
    add_item_response=$(curl -s -X POST "http://localhost:8084/api/v1/cart/$cart_id/items" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"product_id\":\"$product_id\",\"quantity\":2,\"price_per_item\":29.99}")

    if echo "$add_item_response" | grep -q "item_id"; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $add_item_response"
    fi

    # Get cart contents
    test_auth_endpoint "http://localhost:8084/api/v1/cart/$cart_id" "Cart Contents" "$token"
fi

echo -e "\n${YELLOW}5. Performance Indicators${NC}"

# Test response times
echo "Measuring response times..."
for service in "8081/health" "8082/health" "8083/health" "8084/health" "8085/health" "8086/health"; do
    port=$(echo $service | cut -d'/' -f1)
    service_name="Service $port"
    
    # Measure response time
    start_time=$(date +%s%N)
    curl -s "http://localhost:$service" > /dev/null
    end_time=$(date +%s%N)
    
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 200 ]; then
        echo -e "  $service_name: ${GREEN}${response_time}ms ✓${NC}"
    elif [ $response_time -lt 500 ]; then
        echo -e "  $service_name: ${YELLOW}${response_time}ms ⚠${NC}"
    else
        echo -e "  $service_name: ${RED}${response_time}ms ✗${NC}"
    fi
done

echo -e "\n${GREEN}🎉 System Test Complete!${NC}"
echo ""
echo "📊 Next Steps:"
echo "  1. Open JMeter and load: jmeter-templates/basic-user-journey.jmx"
echo "  2. Configure test parameters (threads, duration, etc.)"
echo "  3. Run your performance tests!"
echo ""
echo "🔗 Service URLs:"
echo "  Auth Service:     http://localhost:8081"
echo "  User Service:     http://localhost:8082" 
echo "  Product Service:  http://localhost:8083"
echo "  Cart Service:     http://localhost:8084"
echo "  Order Service:    http://localhost:8085"
echo "  Payment Service:  http://localhost:8086"
echo ""
echo "📚 Documentation: ./README.md"
echo "🚀 Quick Start: ./GETTING_STARTED.md"