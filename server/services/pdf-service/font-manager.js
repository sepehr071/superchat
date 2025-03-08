/**
 * Font Manager Module
 * Handles font registration and verification for PDF generation
 */

const fs = require('fs-extra');
const path = require('path');

// Define font directory paths
const FONT_DIR = path.join(__dirname, '../../fonts');
const VAZIR_REGULAR = path.join(FONT_DIR, 'Vazir-Regular.ttf');
const VAZIR_BOLD = path.join(FONT_DIR, 'Vazir-Bold.ttf');

/**
 * Verify that font files exist
 * @returns {boolean} - Whether all required fonts are available
 */
function verifyFonts() {
  try {
    // Create fonts directory if it doesn't exist
    if (!fs.existsSync(FONT_DIR)) {
      fs.mkdirSync(FONT_DIR, { recursive: true });
      console.log('Created fonts directory');
    }

    // Check if font files exist
    const vazirRegularExists = fs.existsSync(VAZIR_REGULAR);
    const vazirBoldExists = fs.existsSync(VAZIR_BOLD);

    if (vazirRegularExists && vazirBoldExists) {
      console.log('All local font files found in the fonts directory');
      return true;
    }

    console.log(`Missing fonts: ${!vazirRegularExists ? 'Vazir-Regular.ttf ' : ''}${!vazirBoldExists ? 'Vazir-Bold.ttf' : ''}`);
    return false;
  } catch (error) {
    console.error('Error verifying fonts:', error);
    return false;
  }
}

/**
 * Register fonts with PDFKit document
 * @param {Object} doc - PDFKit document instance
 */
function registerPDFKitFonts(doc) {
  try {
    if (verifyFonts()) {
      // Register fonts with PDFKit
      doc.registerFont('Vazir', VAZIR_REGULAR);
      doc.registerFont('Vazir-Bold', VAZIR_BOLD);
    } else {
      // Use standard fonts if custom fonts not available
      console.log('Using standard fonts instead');
    }
  } catch (error) {
    console.error('Error registering fonts with PDFKit:', error);
    throw new Error(`Font registration failed: ${error.message}`);
  }
}

/**
 * Generate CSS for embedding fonts in HTML
 * @returns {string} - CSS for embedding fonts
 */
function generateFontCSS() {
  return `
    /* Vazir font */
    @font-face {
      font-family: 'Vazirmatn';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Vazirmatn';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2') format('woff2');
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }
  `;
}

module.exports = {
  verifyFonts,
  registerPDFKitFonts,
  generateFontCSS
};