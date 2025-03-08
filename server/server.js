/**
 * SuperChat Server - Main Entry Point
 * 
 * This file initializes and starts the SuperChat server application,
 * handling database setup and server configuration.
 */

// Import configurations
const config = require('./config');

// Initialize database first to ensure all tables are created
require('./config/database');

// Run any pending migrations
console.log('Running pending database migrations...');
require('./migrations/add_auto_generated_title').runMigration();

// Import the Express app
const app = require('./app');

// Log that we're in the new modular structure but maintaining compatibility
console.log('SuperChat server starting with modular architecture (maintaining backward compatibility)');

// Start the server
app.listen(config.server.port, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                 SuperChat Server Started                ║
  ╠════════════════════════════════════════════════════════╣
  ║                                                        ║
  ║  Server running on port: ${config.server.port.toString().padEnd(26, ' ')} ║
  ║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(42, ' ')} ║
  ║                                                        ║
  ║  API Endpoints:                                        ║
  ║    - /api/auth                                         ║
  ║    - /api/conversations                                ║
  ║    - /api/files                                        ║
  ║    - /api/chat                                         ║
  ║    - /api/admin                                        ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);
});