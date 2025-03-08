/**
 * SuperChat Server - Legacy Entry Point
 * 
 * This file exists to maintain backward compatibility with the existing client code.
 * It simply loads the modular server implementation.
 */

// Print a notice that we're using the legacy entry point
console.log('⚠️ Using legacy entry point (index.js). The application has been refactored to use server.js as the main entry point.');

// Import and run the modular server implementation
require('./server');
