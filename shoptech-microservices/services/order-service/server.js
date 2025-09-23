const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8085;
const JWT_SECRET = process.env.JWT_SECRET || 'shoptech-secret-key-for-testing';

// Initialize metrics
const serviceName = "order_service";
const { register, metricsMiddleware, recordOperation } = createMetrics(serviceName);

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'order-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 orders per minute
  message: 'Too many order requests from this IP'
});

app.use('/api/v1/orders', orderLimiter);

// Mock order database
const orders = new Map();

// Order status progression
const orderStatuses = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

// Middleware to add correlation ID
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Middleware to log requests
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
  next();
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'No valid token provided',
      correlationId: req.correlationId 
    });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid token',
      correlationId: req.correlationId 
    });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Create order
app.post('/api/v1/orders', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cart_id, shipping_address, payment_method_id } = req.body;
    
    if (!cart_id || !shipping_address || !payment_method_id) {
      return res.status(400).json({ 
        error: 'cart_id, shipping_address, and payment_method_id are required',
        correlationId: req.correlationId 
      });
    }

    // Validate shipping address
    if (!shipping_address.street || !shipping_address.city || !shipping_address.zip) {
      return res.status(400).json({ 
        error: 'Complete shipping address is required',
        correlationId: req.correlationId 
      });
    }

    const orderId = uuidv4();
    
    // Mock cart items (in real system, would fetch from cart service)
    const mockItems = [
      {
        item_id: uuidv4(),
        product_id: uuidv4(),
        product_name: "Sample Product",
        quantity: 2,
        price_per_item: 29.99,
        subtotal: 59.98
      }
    ];
    
    const total = mockItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    const order = {
      order_id: orderId,
      user_id: req.user.user_id,
      cart_id: cart_id,
      status: 'pending_payment',
      total: total,
      shipping_address: shipping_address,
      payment_method_id: payment_method_id,
      items: mockItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    orders.set(orderId, order);

    // Simulate processing delay (order creation is complex)
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'create_order_success',
        order_id: orderId,
        user_id: req.user.user_id,
        total: total,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.status(201).json({
        order_id: order.order_id,
        user_id: order.user_id,
        status: order.status,
        total: order.total,
        items: order.items,
        created_at: order.created_at
      });
    }, Math.random() * 200 + 200); // Random delay 200-400ms

  } catch (error) {
    logger.error({
      action: 'create_order_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get order status
app.get('/api/v1/orders/:order_id/status', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { order_id } = req.params;
    
    const order = orders.get(order_id);
    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this order
    if (order.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    // Simulate tracking number for shipped orders
    let trackingNumber = null;
    let estimatedDelivery = null;
    
    if (order.status === 'shipped' || order.status === 'delivered') {
      trackingNumber = `TRK${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
    }

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_order_status_success',
        order_id: order_id,
        status: order.status,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        order_id: order.order_id,
        status: order.status,
        tracking_number: trackingNumber,
        estimated_delivery: estimatedDelivery
      });
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'get_order_status_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get order details
app.get('/api/v1/orders/:order_id', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { order_id } = req.params;
    
    const order = orders.get(order_id);
    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this order
    if (order.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_order_details_success',
        order_id: order_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json(order);
    }, Math.random() * 75); // Random delay 0-75ms

  } catch (error) {
    logger.error({
      action: 'get_order_details_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Update order status (admin only)
app.put('/api/v1/orders/:order_id/status', authenticateToken, (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;
    
    // Only admins can update order status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required',
        correlationId: req.correlationId 
      });
    }

    if (!status || !orderStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid statuses: ${orderStatuses.join(', ')}`,
        correlationId: req.correlationId 
      });
    }

    const order = orders.get(order_id);
    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found',
        correlationId: req.correlationId 
      });
    }

    order.status = status;
    order.updated_at = new Date().toISOString();

    logger.info({
      action: 'update_order_status_success',
      order_id: order_id,
      new_status: status,
      correlationId: req.correlationId
    });

    res.json({
      order_id: order.order_id,
      status: order.status,
      updated_at: order.updated_at
    });

  } catch (error) {
    logger.error({
      action: 'update_order_status_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId
  });
  res.status(500).json({ 
    error: 'Internal server error',
    correlationId: req.correlationId 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    correlationId: req.correlationId 
  });
});

app.listen(PORT, () => {
  logger.info(`Order Service running on port ${PORT}`);
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});