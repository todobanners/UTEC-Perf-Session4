const fs = require('fs');
const path = require('path');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Generate user data
function generateUsers() {
  const users = [];
  const roles = ['standard', 'premium', 'admin'];
  const roleDistribution = [0.7, 0.25, 0.05]; // 70% standard, 25% premium, 5% admin
  
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eva', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'];
  const regions = ['US', 'EU', 'APAC'];
  const regionDistribution = [0.6, 0.25, 0.15]; // 60% US, 25% EU, 15% APAC

  for (let i = 1; i <= 10000; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    
    // Determine role based on distribution
    let role = 'standard';
    const roleRand = Math.random();
    if (roleRand < roleDistribution[2]) role = 'admin';
    else if (roleRand < roleDistribution[1] + roleDistribution[2]) role = 'premium';
    
    // Determine region based on distribution
    let region = 'US';
    const regionRand = Math.random();
    if (regionRand < regionDistribution[2]) region = 'APAC';
    else if (regionRand < regionDistribution[1] + regionDistribution[2]) region = 'EU';
    
    users.push({
      username,
      password: 'test123',
      email,
      userType: role,
      region
    });
  }
  
  // Write CSV file
  const csvHeader = 'username,password,email,userType,region\n';
  const csvContent = users.map(u => `${u.username},${u.password},${u.email},${u.userType},${u.region}`).join('\n');
  
  fs.writeFileSync(path.join(dataDir, 'users.csv'), csvHeader + csvContent);
  console.log(`Generated ${users.length} users in users.csv`);
}

// Generate product data
function generateProducts() {
  const products = [];
  const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive'];
  
  const productNames = {
    'Electronics': ['Smartphone', 'Laptop', 'Tablet', 'Headphones', 'Smart Watch', 'Camera', 'Monitor', 'Keyboard'],
    'Clothing': ['T-Shirt', 'Jeans', 'Dress', 'Hoodie', 'Jacket', 'Pants', 'Shirt', 'Skirt'],
    'Books': ['Novel', 'Cookbook', 'Biography', 'Textbook', 'Comic', 'Poetry', 'History', 'Science'],
    'Home & Garden': ['Lamp', 'Coffee Maker', 'Garden Tools', 'Furniture', 'Decoration', 'Kitchen Set', 'Bedding', 'Plant'],
    'Sports': ['Basketball', 'Tennis Racket', 'Yoga Mat', 'Running Shoes', 'Golf Clubs', 'Baseball Glove', 'Soccer Ball', 'Volleyball'],
    'Beauty': ['Face Cream', 'Shampoo', 'Lipstick', 'Foundation', 'Mascara', 'Moisturizer', 'Perfume', 'Nail Polish'],
    'Toys': ['Action Figure', 'Doll', 'LEGO Set', 'Puzzle', 'Board Game', 'Remote Car', 'Building Blocks', 'Toy Train'],
    'Automotive': ['Car Part', 'Tire', 'Oil', 'Battery', 'Brake Pad', 'Filter', 'Tool Set', 'Car Cover']
  };

  for (let i = 1; i <= 50000; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const nameOptions = productNames[category];
    const baseName = nameOptions[Math.floor(Math.random() * nameOptions.length)];
    const name = `${baseName} Model ${i}`;
    const price = Math.round((Math.random() * 500 + 10) * 100) / 100;
    
    products.push({
      product_id: `prod_${i.toString().padStart(6, '0')}`,
      name,
      category,
      price
    });
  }
  
  // Write CSV file
  const csvHeader = 'product_id,name,category,price\n';
  const csvContent = products.map(p => `${p.product_id},${p.name},${p.category},${p.price}`).join('\n');
  
  fs.writeFileSync(path.join(dataDir, 'products.csv'), csvHeader + csvContent);
  console.log(`Generated ${products.length} products in products.csv`);
}

// Generate region data
function generateRegions() {
  const regions = [
    { region_code: 'US', region_name: 'United States', currency: 'USD', language: 'en' },
    { region_code: 'EU', region_name: 'Europe', currency: 'EUR', language: 'en' },
    { region_code: 'APAC', region_name: 'Asia Pacific', currency: 'SGD', language: 'en' }
  ];
  
  // Write CSV file
  const csvHeader = 'region_code,region_name,currency,language\n';
  const csvContent = regions.map(r => `${r.region_code},${r.region_name},${r.currency},${r.language}`).join('\n');
  
  fs.writeFileSync(path.join(dataDir, 'regions.csv'), csvHeader + csvContent);
  console.log(`Generated ${regions.length} regions in regions.csv`);
}

// Generate payment methods
function generatePaymentMethods() {
  const paymentMethods = [];
  const cardTypes = ['visa', 'mastercard', 'amex'];
  
  for (let i = 1; i <= 1000; i++) {
    const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    paymentMethods.push({
      payment_method_id: `pm_${i.toString().padStart(6, '0')}`,
      type: 'credit_card',
      card_type: cardType,
      card_token: `secure_token_${i}`,
      last_four: Math.floor(Math.random() * 9000 + 1000).toString()
    });
  }
  
  // Write CSV file
  const csvHeader = 'payment_method_id,type,card_type,card_token,last_four\n';
  const csvContent = paymentMethods.map(pm => `${pm.payment_method_id},${pm.type},${pm.card_type},${pm.card_token},${pm.last_four}`).join('\n');
  
  fs.writeFileSync(path.join(dataDir, 'payment_methods.csv'), csvHeader + csvContent);
  console.log(`Generated ${paymentMethods.length} payment methods in payment_methods.csv`);
}

// Generate all test data
console.log('Generating test data...');
generateUsers();
generateProducts();
generateRegions();
generatePaymentMethods();
console.log('Test data generation complete!');