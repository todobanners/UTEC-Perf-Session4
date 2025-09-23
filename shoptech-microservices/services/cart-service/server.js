const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8084;
const JWT_SECRET = process.env.JWT_SECRET || 'shoptech-secret-key-for-testing';

// Initialize metrics
const serviceName = "cart_service";
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
    new winston.transports.File({ filename: 'cart-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const cartLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many cart requests from this IP'
});

app.use('/api/v1/cart', cartLimiter);

// Mock cart database
const carts = new Map();

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
  res.json({ status: 'healthy', service: 'cart-service', timestamp: new Date().toISOString() });
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

// Create cart
app.post('/api/v1/cart', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id, session_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required',
        correlationId: req.correlationId 
      });
    }

    const cartId = uuidv4();
    const cart = {
      cart_id: cartId,
      user_id: user_id,
      session_id: session_id || uuidv4(),
      items: [],
      total: 0.00,
      created_at: new Date().toISOString()
    };

    carts.set(cartId, cart);

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'create_cart_success',
        cart_id: cartId,
        user_id: user_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.status(201).json(cart);
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'create_cart_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Add item to cart
app.post('/api/v1/cart/:cart_id/items', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cart_id } = req.params;
    const { product_id, quantity, price_per_item } = req.body;
    
    if (!product_id || !quantity || !price_per_item) {
      return res.status(400).json({ 
        error: 'product_id, quantity, and price_per_item are required',
        correlationId: req.correlationId 
      });
    }

    const cart = carts.get(cart_id);
    if (!cart) {
      return res.status(404).json({ 
        error: 'Cart not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this cart
    if (cart.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    const itemId = uuidv4();
    const subtotal = quantity * price_per_item;
    
    const cartItem = {
      item_id: itemId,
      cart_id: cart_id,
      product_id: product_id,
      quantity: parseInt(quantity),
      price_per_item: parseFloat(price_per_item),
      subtotal: subtotal
    };

    cart.items.push(cartItem);
    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'add_cart_item_success',
        cart_id: cart_id,
        item_id: itemId,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.status(201).json(cartItem);
    }, Math.random() * 100 + 50); // Random delay 50-150ms

  } catch (error) {
    logger.error({
      action: 'add_cart_item_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get cart contents
app.get('/api/v1/cart/:cart_id', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cart_id } = req.params;
    
    const cart = carts.get(cart_id);
    if (!cart) {
      return res.status(404).json({ 
        error: 'Cart not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this cart
    if (cart.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    // Add product names to items (mock data)
    const itemsWithDetails = cart.items.map(item => ({
      ...item,
      product_name: `Product ${item.product_id}`,
    }));

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_cart_success',
        cart_id: cart_id,
        item_count: cart.items.length,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        cart_id: cart.cart_id,
        user_id: cart.user_id,
        items: itemsWithDetails,
        total: cart.total,
        item_count: cart.items.length
      });
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'get_cart_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Update cart item
app.put('/api/v1/cart/:cart_id/items/:item_id', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cart_id, item_id } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ 
        error: 'Valid quantity is required',
        correlationId: req.correlationId 
      });
    }

    const cart = carts.get(cart_id);
    if (!cart) {
      return res.status(404).json({ 
        error: 'Cart not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this cart
    if (cart.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    const itemIndex = cart.items.findIndex(item => item.item_id === item_id);
    if (itemIndex === -1) {
      return res.status(404).json({ 
        error: 'Item not found in cart',
        correlationId: req.correlationId 
      });
    }

    // Update item
    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.items[itemIndex].subtotal = cart.items[itemIndex].quantity * cart.items[itemIndex].price_per_item;

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'update_cart_item_success',
        cart_id: cart_id,
        item_id: item_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json(cart.items[itemIndex]);
    }, Math.random() * 75 + 25); // Random delay 25-100ms

  } catch (error) {
    logger.error({
      action: 'update_cart_item_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Remove item from cart
app.delete('/api/v1/cart/:cart_id/items/:item_id', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cart_id, item_id } = req.params;
    
    const cart = carts.get(cart_id);
    if (!cart) {
      return res.status(404).json({ 
        error: 'Cart not found',
        correlationId: req.correlationId 
      });
    }

    // Check if user owns this cart
    if (cart.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    const itemIndex = cart.items.findIndex(item => item.item_id === item_id);
    if (itemIndex === -1) {
      return res.status(404).json({ 
        error: 'Item not found in cart',
        correlationId: req.correlationId 
      });
    }

    // Remove item
    cart.items.splice(itemIndex, 1);

    // Recalculate total
    cart.total = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'remove_cart_item_success',
        cart_id: cart_id,
        item_id: item_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.status(204).send();
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'remove_cart_item_error',
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
  logger.info(`Cart Service running on port ${PORT}`);
  console.log(`Cart Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});