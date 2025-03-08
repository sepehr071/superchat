/**
 * Enhanced PDF Service for generating PDF exports from tables
 * This version focuses exclusively on PDFKit for robust, standalone operation
 * without relying on fallback mechanisms.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

// Import custom modules
const htmlParser = require('./table-parser');

// Constants for PDF generation
const PDF_TEMP_DIR = path.join(__dirname, '../../temp');
const DEFAULT_FILENAME = 'table-export';

/**
 * Process HTML table data with enhanced RTL support
 * @param {Object} tableData - Parsed table data
 * @returns {Object} - Processed table data ready for PDFKit
 */
function processTableDataWithRTL(tableData) {
  const result = {
    headers: [],
    rows: []
  };

  // Process headers with RTL and bidirectional support
  if (tableData.headers && tableData.headers.length > 0) {
    result.headers = tableData.headers.map(header => {
      // Apply RTL enhancements
      return enhanceRTLText(header);
    });
  }

  // Process rows with RTL and bidirectional support
  if (tableData.rows && tableData.rows.length > 0) {
    result.rows = tableData.rows.map(row => {
      return row.map(cell => {
        // Apply RTL enhancements
        return enhanceRTLText(cell);
      });
    });
  }

  return result;
}

/**
 * Enhance RTL text handling for table cells
 * @param {string} text - Input text
 * @returns {string} - RTL-enhanced text
 */
function enhanceRTLText(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    // Apply specific RTL text transformations for Persian
    
    // Fix numbers followed by Persian text - e.g., "730 گل" to "گل 730"
    text = text.replace(/(\d+)\s+(قهرمانی|گل|پاس|سانتی‌متر)/g, '$2 $1');
    
    // Fix "بیش از" patterns with numbers - e.g., "730 از بیش" to "بیش از 730"
    text = text.replace(/(\d+)\s+از\s+بیش/g, 'بیش از $1');
    
    // Fix parentheses position - e.g., "(CR7) کریستیانو رونالدو" to "کریستیانو رونالدو (CR7)"
    text = text.replace(/\(([^)]+)\)\s*([^<]+)/g, '$2 ($1)');
    
    // Apply bidirectional algorithm for mixed text
    const processed = applyBidiAlgorithm(text);
    return processed;
  } catch (error) {
    console.warn(`RTL text enhancement error: ${error.message}`);
    return text; // Return original text if processing fails
  }
}

/**
 * Apply the bidirectional algorithm to text
 * @param {string} text - Text to process
 * @returns {string} - Processed text
 */
function applyBidiAlgorithm(text) {
  try {
    // Simple implementation - in a real application, you would use a proper bidi algorithm library
    // For now, just ensure RTL markers are added for Persian text
    const containsPersian = /[\u0600-\u06FF]/.test(text);
    if (containsPersian) {
      // Add RTL marker if text contains Persian characters
      return `\u202B${text}\u202C`;
    }
    return text;
  } catch (error) {
    console.warn(`Bidi processing error: ${error.message}`);
    return text;
  }
}

/**
 * Enhanced PDF generation with PDFKit
 * This version uses standard fonts to avoid embedding issues
 * @param {string} tableHtml - HTML table to convert
 * @param {string} filename - Base filename for output
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Path to generated PDF
 */
async function generateEnhancedPDF(tableHtml, filename = DEFAULT_FILENAME, options = {}) {
  // Set default options
  const defaultOptions = {
    orientation: 'landscape',
    format: 'A4',
    margins: { top: 50, bottom: 50, left: 40, right: 40 },
    headerColor: '#333340',
    oddRowColor: '#28282f',
    evenRowColor: '#222228',
    textColor: 'white',
    fontSize: 10,
    headerFontSize: 12,
    cellPadding: 10
  };
  
  // Merge with user options
  const opts = { ...defaultOptions, ...options };
  
  return new Promise(async (resolve, reject) => {
    try {
      // Create a unique ID for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomId = crypto.randomBytes(4).toString('hex');
      const uniqueFilename = `${filename}-${timestamp}-${randomId}`;
      
      // Ensure the temp directory exists
      if (!fs.existsSync(PDF_TEMP_DIR)) {
        fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
      }
      
      const tempFilePath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.pdf`);
      
      console.log(`Starting enhanced PDF generation for ${filename} to ${tempFilePath}...`);
      
      // Step 1: Parse HTML table data
      const tableData = htmlParser.parseHtmlTable(tableHtml);
      if (!tableData || !tableData.headers || tableData.headers.length === 0) {
        throw new Error('Failed to parse table data or table is empty');
      }
      
      // Step 2: Process table data with enhanced RTL support
      const processedData = processTableDataWithRTL(tableData);
      
      // Step 3: Extract any custom styles from the table HTML
      const tableStyles = htmlParser.extractTableStyles(tableHtml);
      
      // Step 4: Create a new PDF document
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: opts.format,
        layout: opts.orientation,
        margins: opts.margins,
        info: {
          Title: filename,
          Author: 'SuperChat PDF Export',
          Creator: 'Enhanced PDFKit'
        },
        bufferPages: true
      });
      
      // Step 5: Use standard fonts to avoid embedding issues
      try {
        // Use standard Helvetica font to avoid font embedding issues
        doc.font('Helvetica');
        console.log('Using standard Helvetica font for PDF generation');
      } catch (fontError) {
        console.warn(`Font error: ${fontError.message}`);
        // Already using Helvetica, but kept for error handling completeness
      }
      
      // Step 6: Create output stream
      const stream = fs.createWriteStream(tempFilePath);
      stream.on('error', err => {
        console.error('Stream error:', err);
        reject(new Error(`Failed to create PDF stream: ${err.message}`));
      });
      
      // Pipe the PDF to the file
      doc.pipe(stream);
      
      // Step 7: Add a new page
      doc.addPage();
      
      // Step 8: Set RTL as the default direction
      doc.text('', { direction: 'rtl', align: 'right' });
      
      // Step 9: Manually draw table
      const margin = opts.margins;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const tableWidth = pageWidth - margin.left - margin.right;
      
      // Calculate column widths (equal for simplicity)
      const colCount = processedData.headers.length;
      const colWidth = tableWidth / colCount;
      
      // Setup starting position
      let y = margin.top;
      
      // Draw header row
      doc.fillColor(tableStyles.headerBackgroundColor || opts.headerColor);
      doc.rect(margin.left, y, tableWidth, opts.headerFontSize + opts.cellPadding * 2).fill();
      
      // Draw header text
      doc.fillColor(opts.textColor);
      doc.font('Helvetica-Bold').fontSize(opts.headerFontSize);
      
      processedData.headers.forEach((header, i) => {
        const x = margin.left + i * colWidth;
        doc.text(header, x, y + opts.cellPadding, { 
          width: colWidth,
          align: 'center',
          direction: 'rtl'
        });
      });
      
      // Update y position after header
      y += opts.headerFontSize + opts.cellPadding * 2;
      
      // Draw rows
      doc.font('Helvetica').fontSize(opts.fontSize);
      
      processedData.rows.forEach((row, rowIndex) => {
        // Row background
        const rowColor = rowIndex % 2 === 0 ? opts.evenRowColor : opts.oddRowColor;
        const rowHeight = opts.fontSize + opts.cellPadding * 2;
        
        doc.fillColor(rowColor);
        doc.rect(margin.left, y, tableWidth, rowHeight).fill();
        
        // Draw cell text
        doc.fillColor(opts.textColor);
        
        row.forEach((cell, i) => {
          const x = margin.left + i * colWidth;
          doc.text(cell, x, y + opts.cellPadding, {
            width: colWidth,
            align: 'center',
            direction: 'rtl'
          });
        });
        
        // Update y position after row
        y += rowHeight;
        
        // Check if we need a new page
        if (y > pageHeight - margin.bottom - rowHeight) {
          doc.addPage();
          y = margin.top;
        }
      });
      
      // Step 10: Add page numbers
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const pageHeight = doc.page.height;
        doc.font('Helvetica')
          .fontSize(8)
          .text(
            `${i + 1} / ${totalPages}`,
            margin.left,
            pageHeight - 20,
            { align: 'center', width: tableWidth }
          );
      }
      
      // Step 11: Finalize PDF and close
      doc.end();
      console.log('PDF document completed successfully');
      
      // When the stream is finished, resolve with the file path
      stream.on('finish', () => {
        console.log(`PDF saved to ${tempFilePath}`);
        resolve(tempFilePath);
      });
    } catch (error) {
      console.error('Error in enhanced PDF generation:', error);
      reject(error);
    }
  });
}

/**
 * Test the enhanced PDF generation
 * @returns {Promise<string>} - Path to generated test PDF
 */
async function testEnhancedPDF() {
  // Sample test table
  const testTable = `
    <table>
      <tr>
        <th>دسته‌بندی</th>
        <th>کریستیانو رونالدو (CR7)</th>
        <th>لیونل مسی</th>
      </tr>
      <tr>
        <td>تاریخ تولد</td>
        <td>5 فوریه 1985 (پرتغال)</td>
        <td>24 ژوئن 1987 (آرژانتین)</td>
      </tr>
      <tr>
        <td>قد</td>
        <td>سانتی‌متر 187</td>
        <td>سانتی‌متر 170</td>
      </tr>
      <tr>
        <td>گل‌های باشگاهی</td>
        <td>بیش از 730</td>
        <td>بیش از 700</td>
      </tr>
      <tr>
        <td>گل‌های ملی</td>
        <td>بیش از 120</td>
        <td>بیش از 100</td>
      </tr>
    </table>
  `;
  
  return generateEnhancedPDF(testTable, 'enhanced-test-table');
}

/**
 * Generate PDF with custom options
 * @param {string} tableHtml - HTML table content
 * @param {string} filename - Output filename
 * @param {Object} customOptions - User-specified options
 * @returns {Promise<string>} - Path to generated PDF
 */
async function generatePDFWithOptions(tableHtml, filename = DEFAULT_FILENAME, customOptions = {}) {
  return generateEnhancedPDF(tableHtml, filename, customOptions);
}

module.exports = {
  generatePDF: generateEnhancedPDF,
  generatePDFWithOptions,
  testPDF: testEnhancedPDF
};