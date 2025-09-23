const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8086;
const JWT_SECRET = process.env.JWT_SECRET || 'shoptech-secret-key-for-testing';

// Initialize metrics
const serviceName = "payment_service";
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
    new winston.transports.File({ filename: 'payment-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting (stricter for payment service)
const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 payment requests per minute
  message: 'Too many payment requests from this IP'
});

app.use('/api/v1/payments', paymentLimiter);

// Mock payment database
const payments = new Map();

// Payment status options
const paymentStatuses = ['pending', 'completed', 'failed', 'refunded'];

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
  res.json({ status: 'healthy', service: 'payment-service', timestamp: new Date().toISOString() });
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

// Process payment
app.post('/api/v1/payments', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { order_id, amount, currency, payment_method } = req.body;
    
    if (!order_id || !amount || !currency || !payment_method) {
      return res.status(400).json({ 
        error: 'order_id, amount, currency, and payment_method are required',
        correlationId: req.correlationId 
      });
    }

    // Validate payment method
    if (!payment_method.type || !payment_method.card_token) {
      return res.status(400).json({ 
        error: 'Valid payment method with card_token is required',
        correlationId: req.correlationId 
      });
    }

    // Validate amount
    if (amount <= 0 || amount > 10000) {
      return res.status(400).json({ 
        error: 'Invalid amount (must be between 0.01 and 10000)',
        correlationId: req.correlationId 
      });
    }

    const paymentId = uuidv4();
    const transactionId = `txn_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate payment processing with random success/failure
    const isSuccessful = Math.random() > 0.05; // 95% success rate
    const status = isSuccessful ? 'completed' : 'failed';
    const failureReason = isSuccessful ? null : 'Insufficient funds';
    
    const payment = {
      payment_id: paymentId,
      order_id: order_id,
      status: status,
      amount: parseFloat(amount),
      currency: currency,
      payment_method: {
        type: payment_method.type,
        card_type: payment_method.card_type || 'visa',
        last_four: payment_method.card_token.slice(-4)
      },
      processed_at: new Date().toISOString(),
      transaction_id: transactionId,
      failure_reason: failureReason
    };

    payments.set(paymentId, payment);

    // Simulate payment processing delay (critical service)
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'process_payment_result',
        payment_id: paymentId,
        order_id: order_id,
        status: status,
        amount: amount,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      if (isSuccessful) {
        res.status(201).json({
          payment_id: payment.payment_id,
          order_id: payment.order_id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          processed_at: payment.processed_at,
          transaction_id: payment.transaction_id
        });
      } else {
        res.status(402).json({
          payment_id: payment.payment_id,
          order_id: payment.order_id,
          status: payment.status,
          failure_reason: payment.failure_reason,
          processed_at: payment.processed_at
        });
      }
    }, Math.random() * 500 + 500); // Random delay 500-1000ms (payment processing takes time)

  } catch (error) {
    logger.error({
      action: 'process_payment_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Payment processing error',
      correlationId: req.correlationId 
    });
  }
});

// Get payment status
app.get('/api/v1/payments/:payment_id/status', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { payment_id } = req.params;
    
    const payment = payments.get(payment_id);
    if (!payment) {
      return res.status(404).json({ 
        error: 'Payment not found',
        correlationId: req.correlationId 
      });
    }

    // In a real system, you'd verify the user can access this payment
    // For simplicity, we'll allow access if they're authenticated

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_payment_status_success',
        payment_id: payment_id,
        status: payment.status,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        payment_id: payment.payment_id,
        status: payment.status,
        failure_reason: payment.failure_reason || undefined
      });
    }, Math.random() * 75); // Random delay 0-75ms

  } catch (error) {
    logger.error({
      action: 'get_payment_status_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get payment details
app.get('/api/v1/payments/:payment_id', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { payment_id } = req.params;
    
    const payment = payments.get(payment_id);
    if (!payment) {
      return res.status(404).json({ 
        error: 'Payment not found',
        correlationId: req.correlationId 
      });
    }

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_payment_details_success',
        payment_id: payment_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json(payment);
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'get_payment_details_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Refund payment (admin only)
app.post('/api/v1/payments/:payment_id/refund', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { payment_id } = req.params;
    const { reason } = req.body;
    
    // Only admins can process refunds
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required',
        correlationId: req.correlationId 
      });
    }

    const payment = payments.get(payment_id);
    if (!payment) {
      return res.status(404).json({ 
        error: 'Payment not found',
        correlationId: req.correlationId 
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Can only refund completed payments',
        correlationId: req.correlationId 
      });
    }

    // Process refund
    payment.status = 'refunded';
    payment.refund_reason = reason || 'Refund requested';
    payment.refunded_at = new Date().toISOString();

    // Simulate refund processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'refund_payment_success',
        payment_id: payment_id,
        amount: payment.amount,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        payment_id: payment.payment_id,
        status: payment.status,
        refund_reason: payment.refund_reason,
        refunded_at: payment.refunded_at
      });
    }, Math.random() * 300 + 200); // Random delay 200-500ms

  } catch (error) {
    logger.error({
      action: 'refund_payment_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Refund processing error',
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
    error: 'Payment service error',
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
  logger.info(`Payment Service running on port ${PORT}`);
  console.log(`Payment Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});