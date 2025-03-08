/**
 * PDF Generator Service
 * Uses PDFKit to generate PDF exports from tables
 */

const PDFDocument = require('pdfkit');
const { Table } = require('pdfkit-table');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Import custom modules
const fontManager = require('./font-manager');
const tableParser = require('./table-parser');

// Constants for PDF generation
const PDF_TEMP_DIR = '/tmp';
const DEFAULT_FILENAME = 'table-export';

/**
 * Calculate optimal column widths based on content
 * @param {Object} tableData - Processed table data
 * @param {number} pageWidth - Available page width
 * @returns {Array} - Array of column widths
 */
function calculateColumnWidths(tableData, pageWidth) {
  const availableWidth = pageWidth - 80; // Account for margins
  const minColWidth = 50; // Minimum column width
  const colCount = tableData.headers.length;
  
  // Default to equal distribution if no special handling needed
  if (colCount <= 1) {
    return [availableWidth];
  }
  
  // Calculate content lengths for each column
  const colLengths = new Array(colCount).fill(0);
  
  // Process headers
  tableData.headers.forEach((header, i) => {
    const len = typeof header === 'string' ? header.length : 0;
    colLengths[i] = Math.max(colLengths[i], len);
  });
  
  // Process rows
  tableData.rows.forEach(row => {
    row.forEach((cell, i) => {
      if (i < colCount) {
        const len = typeof cell === 'string' ? cell.length : 0;
        colLengths[i] = Math.max(colLengths[i], len);
      }
    });
  });
  
  // Convert lengths to proportions
  const totalLength = colLengths.reduce((sum, len) => sum + len, 0);
  const proportions = colLengths.map(len => Math.max(len / totalLength, 0.1));
  
  // Special weighting for first column in Persian tables (usually categories)
  if (colCount > 1) {
    proportions[0] *= 1.2; // Give the first column extra width
  }
  
  // Normalize proportions
  const totalProportion = proportions.reduce((sum, prop) => sum + prop, 0);
  const normalizedProps = proportions.map(prop => prop / totalProportion);
  
  // Calculate column widths
  const columnWidths = normalizedProps.map(prop => Math.max(prop * availableWidth, minColWidth));
  
  return columnWidths;
}

/**
 * Generate PDF from HTML table using PDFKit
 * 
 * @param {string} tableHtml - HTML table to convert
 * @param {string} filename - Base filename for the output
 * @param {Object} options - Additional options for PDF generation
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDF(tableHtml, filename = DEFAULT_FILENAME, options = {}) {
  // Set default options
  const defaultOptions = {
    orientation: 'landscape',
    format: 'A4',
    margins: { top: 50, bottom: 50, left: 40, right: 40 },
    headerColor: '#333340',
    oddRowColor: '#28282f',
    evenRowColor: '#222228',
    textColor: 'white',
    fontName: 'Vazir',
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
      const tempFilePath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.pdf`);
      
      // Make sure the temp directory exists
      if (!fs.existsSync(PDF_TEMP_DIR)) {
        fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
      }
      
      console.log(`Starting PDF generation for ${filename}...`);
      
      // Step 1: Parse HTML table data
      const tableData = tableParser.parseHtmlTable(tableHtml);
      if (!tableData || !tableData.headers || tableData.headers.length === 0) {
        throw new Error('Failed to parse table data or table is empty');
      }
      
      // Step 2: Process table data with enhanced RTL support
      const processedData = tableParser.processTableData(tableData);
      
      // Step 3: Extract any custom styles from the table HTML
      const tableStyles = tableParser.extractTableStyles(tableHtml);
      
      // Step 4: Create a new PDF document
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: opts.format,
        layout: opts.orientation,
        margins: opts.margins,
        info: {
          Title: filename,
          Author: 'SuperChat PDF Export',
          Creator: 'PDFKit'
        },
        bufferPages: true
      });
      
      // Step 5: Register fonts
      try {
        fontManager.registerPDFKitFonts(doc);
        doc.font(opts.fontName);
        console.log('Registered fonts successfully');
      } catch (fontError) {
        console.warn(`Font registration error: ${fontError.message}`);
        doc.font('Helvetica'); // Fallback to system font
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
      
      // Step 9: Calculate optimal column widths
      const columnWidths = calculateColumnWidths(processedData, doc.page.width);
      
      // Step 10: Create the enhanced table configuration
      const table = {
        title: '',
        subtitle: '',
        headers: processedData.headers,
        rows: processedData.rows,
        // Define specific styling for the table
        options: {
          width: doc.page.width - opts.margins.left - opts.margins.right,
          padding: opts.cellPadding,
          hideHeader: false,
          align: 'center',
          columnSpacing: 5,
          columnWidths: columnWidths,
          prepareHeader: () => {
            doc.font(opts.fontName + '-Bold' || 'Helvetica-Bold')
               .fontSize(opts.headerFontSize);
            // Set RTL for headers
            doc.text('', { direction: 'rtl', continued: false });
          },
          prepareRow: (row, indexColumn, indexRow, rectRow) => {
            doc.font(opts.fontName || 'Helvetica')
               .fontSize(opts.fontSize);
            
            // Create alternating row backgrounds
            const rowBg = indexRow % 2 ? opts.oddRowColor : opts.evenRowColor;
            if (rowBg) {
              doc.fillColor(rowBg)
                 .rect(rectRow.x, rectRow.y, rectRow.width, rectRow.height)
                 .fill();
            }
            
            // Set text color and RTL for the row
            doc.fillColor(opts.textColor)
               .text('', { direction: 'rtl', continued: false });
          }
        },
        // Style settings
        headerColor: tableStyles.headerBackgroundColor || opts.headerColor,
        headerOpacity: 1,
        headerFont: opts.fontName + '-Bold' || 'Helvetica-Bold',
        rowFlexGrow: 1,
        cellsPadding: opts.cellPadding,
        cellsFont: opts.fontName || 'Helvetica',
        // Advanced options for better text rendering
        textOptions: {
          direction: 'rtl',
          align: 'center',
          width: doc.page.width - opts.margins.left - opts.margins.right
        }
      };
      
      // Step 11: Add table to document
      try {
        console.log('Rendering table with enhanced settings...');
        await doc.table(table, {
          width: doc.page.width - opts.margins.left - opts.margins.right,
          x: opts.margins.left,
          y: opts.margins.top
        });
        
        // Step 12: Add page numbers
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          const pageHeight = doc.page.height;
          doc.font(opts.fontName || 'Helvetica')
             .fontSize(8)
             .text(
               `${i + 1} / ${totalPages}`,
               opts.margins.left,
               pageHeight - 20,
               { align: 'center' }
             );
        }
        
        // Step 13: Finalize PDF and close
        doc.end();
        console.log('PDF document completed successfully');
        
        // When the stream is finished, resolve with the file path
        stream.on('finish', () => {
          console.log(`PDF saved to ${tempFilePath}`);
          resolve(tempFilePath);
        });
      } catch (tableError) {
        console.error('Error generating table:', tableError);
        // Close the document to prevent hanging
        doc.end();
        reject(new Error(`Table generation failed: ${tableError.message}`));
      }
    } catch (error) {
      console.error('Error in PDF generation:', error);
      reject(error);
    }
  });
}

/**
 * Generate PDF with custom options
 * @param {string} tableHtml - HTML table content
 * @param {string} filename - Output filename
 * @param {Object} customOptions - User-specified options
 * @returns {Promise<string>} - Path to generated PDF
 */
async function generatePDFWithOptions(tableHtml, filename = DEFAULT_FILENAME, customOptions = {}) {
  return generatePDF(tableHtml, filename, customOptions);
}

/**
 * Test the PDF generation with a sample table
 * @returns {Promise<string>} - Path to generated test PDF
 */
async function testPDF() {
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
  
  return generatePDF(testTable, 'test-table');
}

module.exports = {
  generatePDF,
  generatePDFWithOptions,
  testPDF
};