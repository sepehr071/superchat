/**
 * File Utilities
 * Common utilities for file operations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 * @returns {boolean} - True if directory exists or was created successfully
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Generate a unique filename with timestamp and random string
 * @param {string} baseFilename - Base name for the file
 * @param {string} extension - File extension (without dot)
 * @returns {string} - Unique filename
 */
function generateUniqueFilename(baseFilename, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomString = crypto.randomBytes(4).toString('hex');
  return `${baseFilename}-${timestamp}-${randomString}.${extension}`;
}

/**
 * Read file as base64 data
 * @param {string} filePath - Path to the file
 * @returns {string} - Base64 encoded file data
 */
function readFileAsBase64(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer.toString('base64');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get file extension from filename or path
 * @param {string} filename - Filename or path
 * @returns {string} - Extension without dot
 */
function getFileExtension(filename) {
  return path.extname(filename).slice(1).toLowerCase();
}

/**
 * Clean up temporary files
 * @param {string|Array<string>} filePaths - Path(s) to file(s) to remove
 * @returns {Promise<void>}
 */
async function cleanupTempFiles(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error(`Error removing temporary file ${filePath}:`, error);
    }
  }
}

module.exports = {
  ensureDirectoryExists,
  generateUniqueFilename,
  readFileAsBase64,
  getFileExtension,
  cleanupTempFiles
};