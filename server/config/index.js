const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.new (explicitly pointing to the new file)
dotenv.config({ path: path.resolve(__dirname, '../.env.new') });

module.exports = {
  server: {
    port: process.env.PORT || 5000
  },
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:5050',
    credentials: true
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    jwtExpiry: '2d',
    cookieMaxAge: 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-7-sonnet-20250219',
    maxTokens: 64000,
    defaultHeaders: {
      'anthropic-beta': 'output-128k-2025-02-19'
    }
  },
  paths: {
    uploadDir: path.join(__dirname, '../uploads'),
    clientDir: path.join(__dirname, '../../client'),
    indexHtml: path.join(__dirname, '../../client/new-dashboard.html')
  }
};