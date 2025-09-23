const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8082;
const JWT_SECRET = process.env.JWT_SECRET || 'shoptech-secret-key-for-testing';

// Initialize metrics
const { register, metricsMiddleware, recordOperation } = createMetrics('user_service');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'user-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const userLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 800, // limit each IP to 800 requests per windowMs
  message: 'Too many user service requests from this IP'
});

app.use('/api/v1/users', userLimiter);

// Mock user profiles database
const userProfiles = new Map();

// Initialize with test user profiles - note: these IDs should match the auth service
const testProfiles = [
  {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'john_doe',
    email: 'john@example.com',
    profile: {
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1-555-0123',
      preferences: {
        language: 'en',
        currency: 'USD',
        notifications: true,
        newsletter: false
      }
    }
  },
  {
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    username: 'jane_smith',
    email: 'jane@example.com',
    profile: {
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+1-555-0124',
      preferences: {
        language: 'en',
        currency: 'USD',
        notifications: true,
        newsletter: true
      }
    }
  },
  {
    user_id: '123e4567-e89b-12d3-a456-426614174002',
    username: 'admin_user',
    email: 'admin@shoptech.com',
    profile: {
      first_name: 'Admin',
      last_name: 'User',
      phone: '+1-555-0100',
      preferences: {
        language: 'en',
        currency: 'USD',
        notifications: false,
        newsletter: false
      }
    }
  }
];

// Store test profiles
testProfiles.forEach(profile => {
  userProfiles.set(profile.user_id, profile);
});

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
  res.json({ status: 'healthy', service: 'user-service', timestamp: new Date().toISOString() });
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

// Get user profile
app.get('/api/v1/users/:user_id/profile', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id } = req.params;
    
    // Check if user is accessing their own profile or is admin
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    let profile = userProfiles.get(user_id);
    if (!profile) {
      // Create a default profile for any authenticated user
      profile = {
        user_id: user_id,
        username: req.user.username,
        email: `${req.user.username}@example.com`,
        profile: {
          first_name: req.user.username.split('_')[0] || 'User',
          last_name: req.user.username.split('_')[1] || 'Name',
          phone: '+1-555-0000',
          preferences: {
            language: 'en',
            currency: 'USD',
            notifications: true,
            newsletter: false
          }
        }
      };
      userProfiles.set(user_id, profile);
    }

    // Simulate some processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_profile_success',
        user_id: user_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email,
        profile: profile.profile
      });
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'get_profile_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Update user preferences
app.put('/api/v1/users/:user_id/preferences', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id } = req.params;
    const { language, currency, notifications } = req.body;
    
    // Check if user is updating their own preferences or is admin
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    const profile = userProfiles.get(user_id);
    if (!profile) {
      return res.status(404).json({ 
        error: 'User profile not found',
        correlationId: req.correlationId 
      });
    }

    // Update preferences
    if (language) profile.profile.preferences.language = language;
    if (currency) profile.profile.preferences.currency = currency;
    if (typeof notifications === 'boolean') profile.profile.preferences.notifications = notifications;

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'update_preferences_success',
        user_id: user_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        user_id: profile.user_id,
        preferences: profile.profile.preferences,
        updated_at: new Date().toISOString()
      });
    }, Math.random() * 100 + 50); // Random delay 50-150ms

  } catch (error) {
    logger.error({
      action: 'update_preferences_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Update user profile
app.put('/api/v1/users/:user_id/profile', authenticateToken, (req, res) => {
  const startTime = Date.now();
  
  try {
    const { user_id } = req.params;
    const { first_name, last_name, phone } = req.body;
    
    // Check if user is updating their own profile or is admin
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        correlationId: req.correlationId 
      });
    }

    const profile = userProfiles.get(user_id);
    if (!profile) {
      return res.status(404).json({ 
        error: 'User profile not found',
        correlationId: req.correlationId 
      });
    }

    // Update profile fields
    if (first_name) profile.profile.first_name = first_name;
    if (last_name) profile.profile.last_name = last_name;
    if (phone) profile.profile.phone = phone;

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'update_profile_success',
        user_id: user_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email,
        profile: profile.profile,
        updated_at: new Date().toISOString()
      });
    }, Math.random() * 150 + 100); // Random delay 100-250ms

  } catch (error) {
    logger.error({
      action: 'update_profile_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get user by username (for admin use)
app.get('/api/v1/users/search/:username', authenticateToken, (req, res) => {
  try {
    const { username } = req.params;
    
    // Only admins can search for users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied - admin required',
        correlationId: req.correlationId 
      });
    }

    const profile = Array.from(userProfiles.values()).find(p => p.username === username);
    if (!profile) {
      return res.status(404).json({ 
        error: 'User not found',
        correlationId: req.correlationId 
      });
    }

    res.json({
      user_id: profile.user_id,
      username: profile.username,
      email: profile.email,
      profile: profile.profile
    });

  } catch (error) {
    logger.error({
      action: 'search_user_error',
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
  logger.info(`User Service running on port ${PORT}`);
  console.log(`User Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});