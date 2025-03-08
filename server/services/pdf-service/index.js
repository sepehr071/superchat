/**
 * PDF Service Index Module
 * Exports all PDF generation related services
 */

const enhancedPdfService = require('./enhanced-pdf-service');
const fontManager = require('./font-manager');
const tableParser = require('./table-parser');
const puppeteerPdfService = require('./puppeteer-pdf-service');

// Determine which PDF service to use as default
// Prefer Puppeteer for better RTL support if available
const defaultPdfService = puppeteerPdfService;

// Export the PDF services
module.exports = {
  // Main PDF generation functions - use Puppeteer as default
  generatePDF: defaultPdfService.generatePDF,
  generatePDFWithOptions: defaultPdfService.generatePDFWithOptions,
  testPDF: defaultPdfService.testPDF,
  
  // Legacy PDF service (PDFKit based)
  enhancedPdfService,
  
  // Puppeteer-based PDF service (better RTL support)
  puppeteerPdfService,
  
  // Font management functions
  registerPDFKitFonts: fontManager.registerPDFKitFonts,
  generateFontCSS: fontManager.generateFontCSS,
  verifyFonts: fontManager.verifyFonts,
  
  // Table parsing functions
  parseHtmlTable: tableParser.parseHtmlTable,
  processTableData: tableParser.processTableData,
  processTableDataWithRTL: tableParser.processTableDataWithRTL,
  extractTableStyles: tableParser.extractTableStyles
};