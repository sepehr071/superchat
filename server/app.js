/**
 * SuperChat Application
 * Express app configuration and middleware setup
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Configure middleware
function setupMiddleware(app) {
  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:5000',
    credentials: true
  }));
  
  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  
  // Serve static files from the client directory
  app.use(express.static(path.join(__dirname, '../client')));
  
  // Basic request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Register API routes
function setupRoutes(app) {
  // Import routers
  const { router: authRouter } = require('./auth');
  const conversationRouter = require('./routes/conversation-router');
  const uploadRouter = require('./routes/upload-router');
  const chatRouter = require('./routes/chat-router');
  const exportRouter = require('./routes/export-router');
  const { router: adminRouter } = require('./admin');
  
  // Register routes
  app.use('/api/auth', authRouter);
  app.use('/api/conversations', conversationRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/admin', adminRouter);
  
  // Legacy endpoint to support existing client code
  app.post('/api/export-table', (req, res) => {
    logger.info('Legacy export-table endpoint called, forwarding to new endpoint');
    // Forward to the new endpoint format
    req.url = '/table';
    exportRouter(req, res);
  });
  
  // Catch-all route to serve the main HTML file
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Setup health check endpoint
function setupHealthCheck(app) {
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
}

// Configure error handling
function setupErrorHandling(app) {
  // Generic error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'An unexpected error occurred',
      message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
    });
  });
}

// Initialize the application
function initializeApp() {
  // Configure middleware
  setupMiddleware(app);
  
  // Register health check endpoint
  setupHealthCheck(app);
  
  // Register API routes
  setupRoutes(app);
  
  // Configure error handling (must be last)
  setupErrorHandling(app);
  
  return app;
}

module.exports = {
  app,
  initializeApp
};