const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { createMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 8083;

// Initialize metrics
const serviceName = "product_service";
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
    new winston.transports.File({ filename: 'product-service.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const productLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 2000, // limit each IP to 2000 requests per windowMs
  message: 'Too many product service requests from this IP'
});

app.use('/api/v1/products', productLimiter);

// Mock product database
const products = new Map();
const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive'];

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

// Load products from CSV file
async function loadProductsFromCSV() {
  try {
    // Path to the CSV file (mounted as volume in Docker)
    const csvPath = path.join(__dirname, 'data/products.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const csvProducts = parseCSV(csvData);
    
    logger.info(`Loading ${csvProducts.length} products from CSV file`);
    
    // Process and store products
    for (const csvProduct of csvProducts) {
      if (csvProduct.product_id && csvProduct.name && csvProduct.category && csvProduct.price) {
        const inventory = Math.floor(Math.random() * 1000) + 1;
        const reviewCount = Math.floor(Math.random() * 500) + 1;
        const averageRating = Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0 - 5.0
        
        const product = {
          product_id: csvProduct.product_id,
          name: csvProduct.name,
          description: `High-quality ${csvProduct.name.toLowerCase()} perfect for everyday use. Features premium materials and excellent craftsmanship.`,
          price: parseFloat(csvProduct.price),
          category: csvProduct.category,
          inventory_count: inventory,
          images: [
            `https://images.shoptech.com/products/${csvProduct.product_id}/image1.jpg`,
            `https://images.shoptech.com/products/${csvProduct.product_id}/image2.jpg`
          ],
          reviews: {
            average_rating: averageRating,
            review_count: reviewCount
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        products.set(csvProduct.product_id, product);
      }
    }
    
    logger.info(`Successfully loaded ${products.size} products from CSV`);
  } catch (error) {
    logger.error('Failed to load products from CSV:', error.message);
    
    // Fallback to generate test products if CSV loading fails
    generateTestProducts();
    logger.warn('Loaded fallback test products due to CSV loading failure');
  }
}

// Fallback function to generate test products
function generateTestProducts() {
  const productNames = [
    'Wireless Headphones', 'Smart Watch', 'Laptop Computer', 'Cotton T-Shirt', 'Running Shoes',
    'Mystery Novel', 'Desk Lamp', 'Coffee Maker', 'Yoga Mat', 'Smartphone Case',
    'Backpack', 'Sunglasses', 'Water Bottle', 'Board Game', 'Bluetooth Speaker',
    'Tablet', 'Hoodie', 'Sneakers', 'Cookbook', 'Garden Tools',
    'Fitness Tracker', 'Jeans', 'Basketball', 'Face Cream', 'Action Figure',
    'Camera', 'Dress', 'Tennis Racket', 'Shampoo', 'LEGO Set',
    'Monitor', 'Jacket', 'Golf Clubs', 'Moisturizer', 'Puzzle',
    'Keyboard', 'Pants', 'Baseball Glove', 'Lipstick', 'Doll',
    'Mouse', 'Shirt', 'Soccer Ball', 'Foundation', 'Remote Car',
    'Webcam', 'Skirt', 'Volleyball', 'Mascara', 'Building Blocks'
  ];

  for (let i = 0; i < 100; i++) {
    const productId = uuidv4();
    const category = categories[Math.floor(Math.random() * categories.length)];
    const name = productNames[i % productNames.length];
    const price = Math.round((Math.random() * 500 + 10) * 100) / 100;
    const inventory = Math.floor(Math.random() * 1000) + 1;
    
    const product = {
      product_id: productId,
      name: `${name} ${i + 1}`,
      description: `High-quality ${name.toLowerCase()} perfect for everyday use. Features premium materials and excellent craftsmanship.`,
      price: price,
      category: category,
      inventory_count: inventory,
      images: [
        `https://images.shoptech.com/products/${productId}/image1.jpg`,
        `https://images.shoptech.com/products/${productId}/image2.jpg`
      ],
      reviews: {
        average_rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 - 5.0
        review_count: Math.floor(Math.random() * 500) + 1
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    products.set(productId, product);
  }
}

// Initialize products
loadProductsFromCSV();

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
  res.json({ status: 'healthy', service: 'product-service', timestamp: new Date().toISOString() });
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

// Get products with pagination and search
app.get('/api/v1/products', (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      category,
      search,
      page = 1,
      limit = 20,
      sort = 'name',
      order = 'asc'
    } = req.query;

    let productList = Array.from(products.values());

    // Filter by category
    if (category) {
      productList = productList.filter(p => 
        p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Filter by search term
    if (search) {
      const searchTerm = search.toLowerCase();
      productList = productList.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm)
      );
    }

    // Sort products
    productList.sort((a, b) => {
      let comparison = 0;
      if (sort === 'price') {
        comparison = a.price - b.price;
      } else if (sort === 'rating') {
        comparison = a.reviews.average_rating - b.reviews.average_rating;
      } else {
        comparison = a.name.localeCompare(b.name);
      }
      return order === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedProducts = productList.slice(startIndex, endIndex);
    const total = productList.length;
    const hasNext = endIndex < total;

    // Simulate processing delay based on complexity
    const baseDelay = Math.random() * 100; // 0-100ms
    const searchDelay = search ? Math.random() * 100 : 0; // Additional delay for search
    
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_products_success',
        resultCount: paginatedProducts.length,
        totalCount: total,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        products: paginatedProducts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          has_next: hasNext,
          total_pages: Math.ceil(total / limitNum)
        }
      });
    }, baseDelay + searchDelay);

  } catch (error) {
    logger.error({
      action: 'get_products_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get single product by ID
app.get('/api/v1/products/:product_id', (req, res) => {
  const startTime = Date.now();
  
  try {
    const { product_id } = req.params;
    
    const product = products.get(product_id);
    if (!product) {
      return res.status(404).json({ 
        error: 'Product not found',
        correlationId: req.correlationId 
      });
    }

    // Simulate processing delay
    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_product_success',
        product_id: product_id,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json(product);
    }, Math.random() * 50); // Random delay 0-50ms

  } catch (error) {
    logger.error({
      action: 'get_product_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get product categories
app.get('/api/v1/products/categories', (req, res) => {
  try {
    // Count products per category
    const categoryCounts = {};
    Array.from(products.values()).forEach(product => {
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    });

    const categoryList = categories.map(category => ({
      name: category,
      count: categoryCounts[category] || 0
    }));

    logger.info({
      action: 'get_categories_success',
      correlationId: req.correlationId
    });

    res.json({
      categories: categoryList,
      total_categories: categories.length
    });

  } catch (error) {
    logger.error({
      action: 'get_categories_error',
      error: error.message,
      correlationId: req.correlationId
    });
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.correlationId 
    });
  }
});

// Get featured products (top-rated)
app.get('/api/v1/products/featured', (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    // Get top-rated products
    const featuredProducts = Array.from(products.values())
      .sort((a, b) => b.reviews.average_rating - a.reviews.average_rating)
      .slice(0, limitNum);

    setTimeout(() => {
      const responseTime = Date.now() - startTime;
      logger.info({
        action: 'get_featured_success',
        resultCount: featuredProducts.length,
        responseTime: responseTime,
        correlationId: req.correlationId
      });

      res.json({
        featured_products: featuredProducts,
        count: featuredProducts.length
      });
    }, Math.random() * 75); // Random delay 0-75ms

  } catch (error) {
    logger.error({
      action: 'get_featured_error',
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
  logger.info(`Product Service running on port ${PORT}`);
  console.log(`Product Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Generated ${products.size} test products`);
});