const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
// Initialize metrics
const { createMetrics } = require('./metrics');
const { register, metricsMiddleware, recordOperation } = createMetrics('auth_service');

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'shoptech-secret-key-for-testing';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'auth-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 100 requests per windowMs
  message: 'Too many authentication requests from this IP'
});

app.use('/api/v1/auth', authLimiter);

// Mock user database (in production this would be a real database)
const users = new Map();

// Function to parse CSV data
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j];
    }
    result.push(obj);
  }
  
  return result;
}

// Load users from CSV file
async function loadUsersFromCSV() {
  try {
    // Path to the CSV file (mounted as volume in Docker)
    const csvPath = path.join(__dirname, 'data/users.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const csvUsers = parseCSV(csvData);
    
    logger.info(`Loading ${csvUsers.length} users from CSV file`);
    
    // Hash passwords and store users
    for (const user of csvUsers) {
      if (user.username && user.password && user.email && user.userType) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const userId = uuidv4();
        users.set(user.username, {
          user_id: userId,
          username: user.username,
          password: hashedPassword,
          email: user.email,
          role: user.userType, // CSV uses 'userType' field
          region: user.region,
          created_at: new Date().toISOString()
        });
      }
    }
    
    logger.info(`Successfully loaded ${users.size} users from CSV`);
  } catch (error) {
    logger.error('Failed to load users from CSV:', error.message);
    
    // Fallback to test users if CSV loading fails
    const testUsers = [
      { username: 'john_doe', password: 'password123', email: 'john@example.com', role: 'standard' },
      { username: 'jane_smith', password: 'password123', email: 'jane@example.com', role: 'premium' },
      { username: 'admin_user', password: 'admin123', email: 'admin@shoptech.com', role: 'admin' },
      { username: 'test_user1', password: 'test123', email: 'test1@example.com', role: 'standard' },
      { username: 'test_user2', password: 'test123', email: 'test2@example.com', role: 'premium' }
    ];
    
    for (const user of testUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const userId = uuidv4();
      users.set(user.username, {
        user_id: userId,
        username: user.username,
        password: hashedPassword,
        email: user.email,
        role: user.role,
        created_at: new Date().toISOString()
      });
    }
    
    logger.warn('Loaded fallback test users due to CSV loading failure');
  }
}

// Initialize users
loadUsersFromCSV();

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
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

// Authentication endpoints
app.post('/api/v1/auth/login', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required',
        correlationId: req.correlationId 
      });
    }

    const user = users.get(username);
    if (!user) {
      // Simulate processing time even for invalid users (security best practice)
      await new Promise(resolve => setTimeout(resolve, 100));
      recordOperation('login', false);
      return res.status(401).json({
        error: 'Invalid credentials',
        correlationId: req.correlationId
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordOperation('login', false);
      return res.status(401).json({
        error: 'Invalid credentials',
        correlationId: req.correlationId
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const responseTime = Date.now() - startTime;
    logger.info({
      action: 'login_success',
      username: username,
      responseTime: responseTime,
      correlationId: req.correlationId,
      user_id: user.user_id
    });

    recordOperation('login', true);

    res.json({
      token: token,
      expires: 7200, // 2 hours in seconds
      user_id: user.user_id,
      role: user.role
    });

  } catch (error) {
    logger.error({
      action: 'login_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

app.get('/api/v1/auth/validate', (req, res) => {
  const startTime = Date.now();
  
  try {
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
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      
      if (expiresIn <= 0) {
        recordOperation('token_validation', false);
        return res.status(401).json({
          error: 'Token expired',
          correlationId: req.correlationId
        });
      }

      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'validate_success',
        user_id: decoded.user_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      recordOperation('token_validation', true);

      res.json({
        valid: true,
        user_id: decoded.user_id,
        expires_in: expiresIn
      });

    } catch (jwtError) {
      recordOperation('token_validation', false);
      return res.status(401).json({
        error: 'Invalid token',
        correlationId: req.correlationId
      });
    }

  } catch (error) {
    logger.error({
      action: 'validate_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Register endpoint (for testing purposes)
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { username, password, email, role = 'standard' } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ 
        error: 'Username, password, and email are required',
        correlationId: req.correlationId 
      });
    }

    if (users.has(username)) {
      return res.status(409).json({ 
        error: 'Username already exists',
        correlationId: req.correlationId 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    users.set(username, {
      user_id: userId,
      username: username,
      password: hashedPassword,
      email: email,
      role: role,
      created_at: new Date().toISOString()
    });

    logger.info({
      action: 'register_success',
      username: username,
      correlationId: req.correlationId
    });

    res.status(201).json({
      user_id: userId,
      username: username,
      email: email,
      role: role
    });

  } catch (error) {
    logger.error({
      action: 'register_error',
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
  logger.info(`Auth Service running on port ${PORT}`);
  console.log(`Auth Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});