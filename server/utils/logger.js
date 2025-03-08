/**
 * Logger Utility
 * Provides centralized logging functionality with different log levels
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Get current log level from environment or default to INFO
const currentLogLevel = () => {
  const level = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
  return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
};

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {Array} args - Log arguments
 * @returns {Array} - Formatted log arguments
 */
function formatLogMessage(level, args) {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level}]`, ...args];
}

/**
 * Create log function for specific level
 * @param {string} level - Log level name
 * @param {number} levelValue - Log level value
 * @returns {Function} - Logging function
 */
function createLogFunction(level, levelValue) {
  return (...args) => {
    if (currentLogLevel() >= levelValue) {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
        ...formatLogMessage(level, args)
      );
    }
  };
}

// Export logger methods
module.exports = {
  error: createLogFunction('ERROR', LOG_LEVELS.ERROR),
  warn: createLogFunction('WARN', LOG_LEVELS.WARN),
  info: createLogFunction('INFO', LOG_LEVELS.INFO),
  debug: createLogFunction('DEBUG', LOG_LEVELS.DEBUG),
  
  /**
   * Log significant events that should always appear, regardless of log level
   * @param  {...any} args - Log arguments
   */
  important: (...args) => {
    console.log(...formatLogMessage('IMPORTANT', args));
  },
  
  /**
   * Get current log level name
   * @returns {string} - Current log level name
   */
  getLogLevel: () => {
    const level = currentLogLevel();
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'INFO';
  }
};