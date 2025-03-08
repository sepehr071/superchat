/**
 * SuperChat Server
 * Main entry point for the application
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables from .env.new (explicitly pointing to the new file)
dotenv.config({ path: path.resolve(__dirname, '.env.new') });

// Enhanced Debug: Show more details about the API key
console.log('API Key loaded from .env:', process.env.ANTHROPIC_API_KEY ?
  `${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...${process.env.ANTHROPIC_API_KEY.substring(process.env.ANTHROPIC_API_KEY.length - 20)}` : 'Not found');
console.log('API Key length:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0);

// Import custom modules
const { router: authRouter } = require('./auth');
require('./admin-migration'); // Run admin migrations on startup

// Import routers
const conversationRouter = require('./routes/conversation-router');
const uploadRouter = require('./routes/upload-router');
const chatRouter = require('./routes/chat-router');
const exportRouter = require('./routes/export-router');
const { router: adminRouter } = require('./admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:5000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/chat', chatRouter);
app.use('/api/export', exportRouter);

// Legacy endpoint to support existing client code
app.post('/api/export-table', (req, res) => {
  console.log('Legacy export-table endpoint called, forwarding to new endpoint');
  // Forward to the new endpoint format
  req.url = '/table';
  exportRouter(req, res);
});

app.use('/api/admin', adminRouter);

// Catch-all route to serve the main HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and bound to all interfaces`);
});