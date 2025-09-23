#!/bin/bash

# Services to update (excluding auth-service and user-service which are already done)
SERVICES=("product-service" "cart-service" "order-service" "payment-service")

for service in "${SERVICES[@]}"; do
    echo "Adding metrics to $service..."

    SERVICE_DIR="services/$service"
    SERVER_FILE="$SERVICE_DIR/server.js"

    # Skip if server.js doesn't exist
    if [ ! -f "$SERVER_FILE" ]; then
        echo "  Skipping $service - server.js not found"
        continue
    fi

    # Add metrics import
    sed -i '' '/const winston = require/a\
const { createMetrics } = require('\''./metrics'\'');
' "$SERVER_FILE"

    # Add metrics initialization (after JWT_SECRET line)
    sed -i '' '/const JWT_SECRET = /a\
\
// Initialize metrics\
const serviceName = "'${service//-/_}'";\
const { register, metricsMiddleware, recordOperation } = createMetrics(serviceName);
' "$SERVER_FILE"

    # Add metrics middleware (after express.json())
    sed -i '' '/app\.use(express\.json/a\
app.use(metricsMiddleware);
' "$SERVER_FILE"

    # Add metrics endpoint (after health endpoint)
    sed -i '' '/app\.get.*\/health.*{/,/});/a\
\
// Metrics endpoint\
app.get('\''/metrics'\'', async (req, res) => {\
  try {\
    res.set('\''Content-Type'\'', register.contentType);\
    res.end(await register.metrics());\
  } catch (ex) {\
    res.status(500).end(ex);\
  }\
});
' "$SERVER_FILE"

    echo "  ✅ Updated $service"
done

echo "🎉 All services updated with metrics!"