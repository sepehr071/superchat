/**
 * Time Utilities
 * Common utilities for time operations
 */

/**
 * Get current ISO timestamp with timezone
 * @returns {string} - Current time in ISO format
 */
function getCurrentISOTimestamp() {
  return new Date().toISOString();
}

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @param {string} locale - Locale to use for formatting (default: 'en-US')
 * @returns {string} - Formatted date string
 */
function formatDate(date, locale = 'en-US') {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate time elapsed since a given date
 * @param {string|Date} date - Start date
 * @returns {string} - Human-readable elapsed time
 */
function getElapsedTime(date) {
  const start = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const diffMs = now - start;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 0) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  }
  
  if (diffHour > 0) {
    return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  }
  
  if (diffMin > 0) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  }
  
  return 'Just now';
}

module.exports = {
  getCurrentISOTimestamp,
  formatDate,
  getElapsedTime
};