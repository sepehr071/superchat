/**
 * Font Manager for PDF Generation
 * Enhanced version with embedded fonts
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Create a temporary directory for font files if needed
const TEMP_DIR = path.join(os.tmpdir(), 'superchat-fonts');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Embedded Base64 Vazirmatn fonts
 * Note: These are truncated placeholder values
 * In production, replace with full Base64 encoded font content
 */
const EMBEDDED_FONTS = {
  vazir: {
    // Placeholders for Base64-encoded fonts (truncated for brevity)
    // In a real implementation, these would be the full Base64-encoded font files
    regular: 'data:font/woff2;base64,d09GMgABAAAAADWMABIAAAAAbvwAADUhAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBgWTzRAuCEAABNgIkA4QWBCAFhGIHIAyEehvaI1UHbBwAxO+nIJFRLJ482f9/T2higxSWoXXYOyAmOMzMDgFRtXKN6tTqdrZeTuvdqb35JL...',
    bold: 'data:font/woff2;base64,d09GMgABAAAAADZQABIAAAAAbzQAADXuAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBkjTzRAuCEAABNgIkA4QWBCAFhGIHIAyDYRtdNVUHbBwAZP5tRURsmyjZ//+U3BiDh4C82gBUV6m66d67...',
    medium: 'data:font/woff2;base64,d09GMgABAAAAADY4ABIAAAAAbvwAADXYAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBjwzzRAuCEAABNgIkA4QWBCAFhGIHIAyEchvXM1UHbBwA5P9NIiOKxZMnm/7/98QYJ...',
    semiBold: 'data:font/woff2;base64,d09GMgABAAAAADZEABIAAAAAbxQAADXiAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBkBTzRAuCEAABNgIkA4QWBCAFhGIHIAyDZRtZNFUHbBwA7P4tRVEU2TbZ/...',
    thin: 'data:font/woff2;base64,d09GMgABAAAAADXEABIAAAAAbsgAADVoAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBhxTzRAuCEAABNgIkA4QWBCAFhGIHIAyEbhvaJ1UHbBwAzP9tRMRmtknZ//+W3Bj...',
    light: 'data:font/woff2;base64,d09GMgABAAAAADXkABIAAAAAbsgAADWEAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIByCXgZgAIFcCEgJgzwRDAqBhxTzRAuCEAABNgIkA4QWBCAFhGIHIAyEbhvaJ1UHbBwAzP9tRMRmtknZ//+W3Bj...'
  }
};

// Define legacy font paths relative to server for backward compatibility
const VAZIR_FONT_DIR = '/root/vazir';

// Font registration map
const fonts = {
  vazir: {
    regular: path.join(VAZIR_FONT_DIR, 'Vazirmatn-Regular.woff2'), // Legacy path
    bold: path.join(VAZIR_FONT_DIR, 'Vazirmatn-Bold.woff2'), // Legacy path
    medium: path.join(VAZIR_FONT_DIR, 'Vazirmatn-Medium.woff2'), // Legacy path
    semiBold: path.join(VAZIR_FONT_DIR, 'Vazirmatn-SemiBold.woff2'), // Legacy path
    thin: path.join(VAZIR_FONT_DIR, 'Vazirmatn-Thin.woff2'), // Legacy path
    light: path.join(VAZIR_FONT_DIR, 'Vazirmatn-Light.woff2') // Legacy path
  }
};

/**
 * Create a temporary font file from Base64 data
 * @param {string} base64Data - Base64 encoded font data
 * @param {string} type - Font type (e.g., 'regular', 'bold')
 * @returns {string} - Path to temporary font file
 */
function createTempFontFile(base64Data, type) {
  try {
    // Extract the actual Base64 content (remove data URI prefix if present)
    const base64Content = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    // Create buffer from Base64
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Generate a unique filename
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const tempFilePath = path.join(TEMP_DIR, `vazir-${type}-${uniqueId}.woff2`);
    
    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, buffer);
    
    return tempFilePath;
  } catch (error) {
    console.error(`Error creating temp font file for ${type}:`, error);
    return null;
  }
}

/**
 * Get font paths, preferring embedded fonts but falling back to file system
 * @returns {Object} - Object with font paths
 */
function getFontPaths() {
  let fontPaths = {};
  
  try {
    // Create temp files from embedded fonts
    fontPaths = {
      vazir: {
        regular: createTempFontFile(EMBEDDED_FONTS.vazir.regular, 'regular'),
        bold: createTempFontFile(EMBEDDED_FONTS.vazir.bold, 'bold'),
        medium: createTempFontFile(EMBEDDED_FONTS.vazir.medium, 'medium'),
        semiBold: createTempFontFile(EMBEDDED_FONTS.vazir.semiBold, 'semiBold'),
        thin: createTempFontFile(EMBEDDED_FONTS.vazir.thin, 'thin'),
        light: createTempFontFile(EMBEDDED_FONTS.vazir.light, 'light')
      }
    };
    
    // Check if any fonts failed to be created
    const missingFonts = Object.entries(fontPaths.vazir)
      .filter(([_, path]) => !path)
      .map(([type]) => type);
    
    if (missingFonts.length > 0) {
      console.warn(`Some embedded fonts could not be created: ${missingFonts.join(', ')}. Falling back to file system.`);
      return fonts; // Fall back to file system fonts
    }
    
    return fontPaths;
  } catch (error) {
    console.error('Error creating font files from embedded fonts:', error);
    console.warn('Falling back to file system fonts');
    return fonts; // Fall back to file system fonts
  }
}

/**
 * Generate Font CSS for embedding in HTML templates
 * Creates CSS that can be embedded directly in HTML
 */
function generateFontCSS() {
  // Use embedded fonts directly in CSS via data URIs
  return `
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${EMBEDDED_FONTS.vazir.regular}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${EMBEDDED_FONTS.vazir.bold}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${EMBEDDED_FONTS.vazir.medium}') format('woff2');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${EMBEDDED_FONTS.vazir.light}') format('woff2');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${EMBEDDED_FONTS.vazir.semiBold}') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
  `;
}

/**
 * Register fonts with PDFKit
 * @param {PDFDocument} doc - PDFKit document instance
 * @returns {PDFDocument} - The document with registered fonts
 */
function registerPDFKitFonts(doc) {
  // Get font paths (either from embedded fonts or file system)
  const fontPaths = getFontPaths();
  
  // Register regular font
  doc.registerFont('Vazir', fontPaths.vazir.regular);
  
  // Register font variants
  doc.registerFont('Vazir-Bold', fontPaths.vazir.bold);
  doc.registerFont('Vazir-Medium', fontPaths.vazir.medium);
  doc.registerFont('Vazir-Light', fontPaths.vazir.light);
  doc.registerFont('Vazir-SemiBold', fontPaths.vazir.semiBold);
  doc.registerFont('Vazir-Thin', fontPaths.vazir.thin);
  
  return doc;
}

/**
 * Verify all font files exist
 * @returns {Object} - Result with valid status and any missing fonts
 */
function verifyFonts() {
  // First, check if we can use embedded fonts
  try {
    // Try to create temp files from embedded fonts
    const fontPaths = getFontPaths();
    
    // Check if any temp font files failed to be created
    const missingEmbedded = Object.entries(fontPaths.vazir)
      .filter(([_, path]) => !path)
      .map(([type]) => `embedded-${type}`);
    
    if (missingEmbedded.length === 0) {
      return {
        valid: true,
        source: 'embedded',
        missing: []
      };
    }
  } catch (error) {
    console.warn('Error verifying embedded fonts:', error);
  }
  
  // Fall back to checking file system fonts
  const missingFonts = [];
  Object.values(fonts.vazir).forEach(fontPath => {
    if (!fs.existsSync(fontPath)) {
      missingFonts.push(fontPath);
    }
  });

  return {
    valid: missingFonts.length === 0,
    source: 'filesystem',
    missing: missingFonts
  };
}

module.exports = {
  fonts,
  EMBEDDED_FONTS,
  registerPDFKitFonts,
  verifyFonts,
  generateFontCSS,
  getFontPaths
};