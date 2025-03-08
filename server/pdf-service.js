/**
 * PDF Service for generating PDF exports from tables
 * Provides multiple approaches for PDF generation:
 * 1. PDFKit direct generation (primary method)
 * 2. Puppeteer-based generation (fallback for complex tables)
 */

const PDFDocument = require('pdfkit');
const { Table } = require('pdfkit-table');
const fs = require('fs-extra');
const path = require('path');
const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Import custom modules
const fontManager = require('./font-manager');
const htmlParser = require('./html-parser');

// Constants for PDF generation
const PDF_TEMP_DIR = '/tmp';
const DEFAULT_FILENAME = 'table-export';

/**
 * Generate PDF from HTML table using PDFKit
 * This is the primary method using direct PDFKit generation
 * 
 * @param {string} tableHtml - HTML table to convert
 * @param {string} filename - Base filename for the output
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDFWithPDFKit(tableHtml, filename = DEFAULT_FILENAME) {
  return new Promise(async (resolve, reject) => {
    try {
      // Verify fonts are available
      const fontCheck = fontManager.verifyFonts();
      if (!fontCheck.valid) {
        console.warn(`Missing font files: ${fontCheck.missing.join(', ')}`);
        console.warn('Will try to continue with system fonts');
      }
      
      // Parse HTML table to structured data
      const tableData = htmlParser.parseHtmlTable(tableHtml);
      const processedData = htmlParser.processTableData(tableData);
      const tableStyles = htmlParser.extractTableStyles(tableHtml);
      
      // Create output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueFilename = `${filename}-${timestamp}`;
      const tempFilePath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.pdf`);
      
      // Create PDF document with RTL support
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 40, right: 40 },
        info: {
          Title: filename,
          Author: 'SuperChat PDF Export',
          Creator: 'PDFKit'
        },
        bufferPages: true
      });
      
      // Add a font if available
      if (fontCheck.valid) {
        fontManager.registerPDFKitFonts(doc);
        doc.font('Vazir');
      } else {
        // Fallback to a system font with decent RTL support
        doc.font('Helvetica');
      }
      
      // Create output stream
      const stream = fs.createWriteStream(tempFilePath);
      
      // Handle stream events
      stream.on('finish', () => resolve(tempFilePath));
      stream.on('error', err => reject(new Error(`Failed to write PDF: ${err.message}`)));
      
      // Pipe PDF to file
      doc.pipe(stream);
      
      // Add a new page
      doc.addPage();
      
      // Set RTL as the default direction
      doc.text('', { direction: 'rtl', align: 'right' });
      
      // Build the table
      const table = {
        title: '',
        subtitle: '',
        headers: processedData.headers,
        rows: processedData.rows,
        // Define specific styling for the table
        options: {
          width: 720,
          padding: 10,
          hideHeader: false,
          align: 'center',
          divider: {
            header: { disabled: false, width: 2, opacity: 1 },
            horizontal: { disabled: false, width: 1, opacity: 0.8 }
          }
        },
        // Style the table
        headerColor: tableStyles.headerBackgroundColor || '#333340',
        headerOpacity: 1,
        headerFont: fontCheck.valid ? 'Vazir-Bold' : 'Helvetica-Bold',
        rowFlexGrow: 1,
        rowFlexShrink: 0,
        cellsPadding: 10,
        cellsFont: fontCheck.valid ? 'Vazir' : 'Helvetica',
        // Style alternating rows
        alternateRowColor: [
          tableStyles.oddRowBackgroundColor || '#28282f',
          tableStyles.evenRowBackgroundColor || '#222228'
        ],
        alternateRowOpacity: 1,
        alternateRowColorOpacity: 1
      };
      
      // Add table to document
      const { width, height } = doc.page;
      const opts = {
        x: 40,
        y: 50,
        width: width - 80,
        height: height - 100
      };
      
      try {
        // Use pdfkit-table to render the table
        await doc.table(table, opts);
        
        // Finalize PDF and close
        doc.end();
      } catch (tableError) {
        console.error('Error generating table with pdfkit-table:', tableError);
        
        // Close the current document
        doc.end();
        
        // Return a rejected promise to trigger the fallback mechanism
        reject(new Error(`PDFKit table generation failed: ${tableError.message}`));
      }
    } catch (error) {
      console.error('Error in PDFKit PDF generation:', error);
      reject(error);
    }
  });
}

/**
 * Generate PDF from HTML table using Puppeteer (fallback method)
 * This renders the table with a real browser engine for better RTL support
 * 
 * @param {string} tableHtml - HTML table to convert 
 * @param {string} filename - Base filename for the output
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDFWithPuppeteer(tableHtml, filename = DEFAULT_FILENAME) {
  let browser = null;
  
  try {
    // Create complete HTML document with proper styling for RTL
    const htmlContent = createHTMLTemplate(tableHtml);
    
    // Create output file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueFilename = `${filename}-${timestamp}`;
    const tempHtmlPath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.html`);
    const tempPdfPath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.pdf`);
    
    // Write the HTML to a temporary file
    await fs.writeFile(tempHtmlPath, htmlContent, 'utf8');
    
    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none'
      ]
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set viewport size to A4 landscape
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2
    });
    
    // Load the HTML file
    await page.goto(`file://${tempHtmlPath}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for fonts to load and RTL processing to complete
    await page.waitForFunction(() => {
      return document.fonts.ready.then(() => true);
    });
    
    // Wait a bit more for rendering to stabilize
    await page.waitForTimeout(1000);
    
    // Run the RTL text processing function
    await page.evaluate(() => {
      if (typeof fixPersianTable === 'function') {
        fixPersianTable();
      }
    });
    
    // Wait for any animations or additional rendering
    await page.waitForTimeout(500);
    
    // Generate PDF
    await page.pdf({
      path: tempPdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '20mm',
        right: '10mm',
        bottom: '20mm',
        left: '10mm'
      }
    });
    
    // Close the browser
    await browser.close();
    browser = null;
    
    // Clean up the HTML file
    await fs.unlink(tempHtmlPath);
    
    return tempPdfPath;
  } catch (error) {
    // Make sure to close the browser if there was an error
    if (browser) {
      await browser.close();
    }
    console.error('Error in Puppeteer PDF generation:', error);
    throw error;
  }
}

/**
 * Generate PDF from HTML table using wkhtmltopdf as the final fallback
 * 
 * @param {string} tableHtml - HTML table to convert
 * @param {string} filename - Base filename for the output
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDFWithWkhtmltopdf(tableHtml, filename = DEFAULT_FILENAME) {
  try {
    // Create complete HTML document with proper styling for RTL
    const htmlContent = createHTMLTemplate(tableHtml);
    
    // Create output file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueFilename = `${filename}-${timestamp}`;
    const tempHtmlPath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.html`);
    const tempPdfPath = path.join(PDF_TEMP_DIR, `${uniqueFilename}.pdf`);
    
    // Write the HTML to a temporary file
    await fs.writeFile(tempHtmlPath, htmlContent, 'utf8');
    
    // Use wkhtmltopdf to generate PDF
    const cmd = `wkhtmltopdf --encoding utf-8 --enable-local-file-access `+
               `--javascript-delay 5000 --no-stop-slow-scripts --enable-javascript `+
               `--debug-javascript --run-script "fixPersianTable();" --dpi 300 --zoom 1.3 `+
               `--minimum-font-size 14 --margin-left 10 --margin-right 10 --margin-top 20 `+
               `--margin-bottom 20 --page-size A4 --orientation Landscape `+
               `${tempHtmlPath} ${tempPdfPath}`;
    
    await exec(cmd);
    
    // Clean up the HTML file
    await fs.unlink(tempHtmlPath);
    
    return tempPdfPath;
  } catch (error) {
    console.error('Error in wkhtmltopdf PDF generation:', error);
    throw error;
  }
}

/**
 * Create a complete HTML document with proper styling for the table
 * 
 * @param {string} tableHtml - The HTML table content
 * @returns {string} - Complete HTML document
 */
function createHTMLTemplate(tableHtml) {
  // Add font CSS
  const fontCSS = fontManager.generateFontCSS();
  
  // Create HTML template with inline styles
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Table Export</title>
  <style>
    ${fontCSS}
    
    html, body {
      direction: rtl;
      text-align: right;
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      color: #333;
      padding: 20px;
      background-color: white;
      margin: 0;
    }
    
    * {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif !important;
      direction: rtl !important;
      unicode-bidi: embed;
    }
    
    /* Container for better table display */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin: 0 auto;
      padding: 0;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 auto;
      direction: rtl;
      text-align: right;
      border: 2px solid #4a4a57;
      table-layout: fixed;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      page-break-inside: avoid;
    }
    
    /* Column widths for specific columns */
    table th:first-child, table td:first-child {
      width: 22%;
      min-width: 140px;
      font-weight: bold;
    }
    
    table th:not(:first-child), table td:not(:first-child) {
      width: 39%; /* Equal distribution of remaining width */
      min-width: 180px;
    }
    
    th {
      background-color: #333340;
      color: white;
      font-weight: bold;
      border-bottom: 2px solid #a855f7;
      text-align: center;
      padding: 12px 15px;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: keep-all;
      line-height: 1.5;
      white-space: normal;
    }
    
    td {
      border: 1px solid #4a4a57;
      padding: 12px 15px;
      text-align: center;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: keep-all;
      line-height: 1.5;
      white-space: normal;
    }
    
    /* Fix for long words in Persian */
    th, td {
      overflow: visible; /* Changed from hidden to allow text to display fully */
      word-wrap: break-word;
      word-break: normal;
      max-width: none;
      position: relative;
      white-space: normal;
      hyphens: auto;
    }
    
    /* Alternating row colors */
    tr:nth-child(odd) {
      background-color: #28282f;
      color: white;
    }
    
    tr:nth-child(even) {
      background-color: #222228;
      color: white;
    }
    
    /* Fix for common RTL text patterns */
    .fix-numbers {
      unicode-bidi: embed;
      direction: rtl;
    }
    
    /* Extra specificity to ensure RTL is applied */
    table[dir="rtl"],
    table[dir="rtl"] th,
    table[dir="rtl"] td {
      text-align: center !important;
      direction: rtl !important;
    }
    
    /* Fix for Persian table headers specifically */
    [lang="fa"] th,
    [dir="rtl"] th {
      text-align: center;
      vertical-align: middle;
      font-weight: bold;
      padding: 10px 8px;
    }
    
    /* Fix for RTL text in cells */
    [lang="fa"] td,
    [dir="rtl"] td {
      text-align: center;
      vertical-align: middle;
      padding: 8px 8px;
    }
    
    /* Overrides for specific tables */
    .comparison-table th:first-child,
    .comparison-table td:first-child {
      position: sticky;
      right: 0;
      background-color: #333340;
      z-index: 2;
      font-weight: bold;
    }
    
    /* Print-specific styles - critical for PDF rendering */
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        color-adjust: exact !important;
        print-color-adjust: exact !important;
        background-color: white !important;
      }
      
      .table-container {
        width: 100% !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      
      table {
        page-break-inside: avoid !important;
        width: 100% !important;
        table-layout: fixed !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 2px solid #4a4a57 !important;
      }
      
      th, td {
        page-break-inside: avoid !important;
        overflow: visible !important;
        word-wrap: break-word !important;
        padding: 10px 8px !important;
      }
      
      tr {
        page-break-inside: avoid !important;
        min-height: 40px !important;
      }
      
      /* Enforce background colors in print */
      th {
        background-color: #333340 !important;
        color: white !important;
      }
      
      tr:nth-child(odd) td {
        background-color: #28282f !important;
        color: white !important;
      }
      
      tr:nth-child(even) td {
        background-color: #222228 !important;
        color: white !important;
      }
      
      .comparison-table th:first-child,
      .comparison-table td:first-child {
        background-color: #333340 !important;
      }
    }
    
    /* Fix for specific Persian text patterns */
    .rtl-number-fix:after {
      content: attr(data-text);
      direction: rtl;
      unicode-bidi: embed;
    }
  </style>
</head>
<body>
  <div dir="rtl" lang="fa" class="table-container">
    ${tableHtml
      .replace(/<table/g, '<table dir="rtl" lang="fa" class="comparison-table"')
      .replace(/<th/g, '<th dir="rtl" lang="fa"')
      .replace(/<td/g, '<td dir="rtl" lang="fa"')}
  </div>
  
  <script>
    // Force RTL and language for Persian text
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'fa';
    document.body.dir = 'rtl';
    document.body.lang = 'fa';
    
    // Advanced Persian text and table fixing function
    function fixPersianTable() {
      // Force RTL for the entire document
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'fa';
      document.body.dir = 'rtl';
      document.body.lang = 'fa';
      
      // Process all tables
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        // Ensure the table has proper RTL attributes
        table.dir = 'rtl';
        table.setAttribute('lang', 'fa');
        table.style.direction = 'rtl';
        table.style.width = '100%';
        
        // Process each row to ensure even spacing
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
          // Make header row taller
          if (rowIndex === 0) {
            row.style.height = '50px';
          } else {
            row.style.height = '40px';
          }
          
          // Process each cell in the row
          const cells = row.querySelectorAll('th, td');
          cells.forEach((cell, cellIndex) => {
            // Set cell properties
            cell.dir = 'rtl';
            cell.setAttribute('lang', 'fa');
            cell.style.textAlign = 'center';
            cell.style.direction = 'rtl';
            cell.style.verticalAlign = 'middle';
            
            // Add min-height to ensure content isn't cut off
            cell.style.minHeight = rowIndex === 0 ? '50px' : '40px';
            
            // Preserve line breaks
            cell.style.whiteSpace = 'pre-line';
            
            // Ensure text doesn't overflow
            cell.style.overflow = 'visible';
            
            // First column styling (categories)
            if (cellIndex === 0) {
              cell.style.fontWeight = 'bold';
              cell.style.backgroundColor = '#333340';
            }
            
            // Get the cell text content
            let text = cell.innerHTML;
            
            // Fix various text pattern issues
            
            // Fix parentheses position - e.g., "(CR7) کریستیانو رونالدو" to "کریستیانو رونالدو (CR7)"
            text = text.replace(/\\(([^)]+)\\)\\s*([^<]+)/g, '$2 ($1)');
            
            // Fix "بیش از" patterns with numbers - e.g., "730 از بیش" to "بیش از 730"
            text = text.replace(/(\\d+)\\s+از\\s+بیش/g, 'بیش از $1');
            
            // Fix numbers followed by Persian text - e.g., "730 گل" to "گل 730"
            text = text.replace(/(\\d+)\\s+(قهرمانی|گل|پاس)/g, '$2 $1');
            
            // Fix parenthetical phrases - ensure correct bidirectional rendering
            text = text.replace(/\\(([^)]*?بیشترین در تاریخ[^)]*?)\\)/g, '(بیشترین در تاریخ)');
            text = text.replace(/\\(([^)]*?اسپانیا[^)]*?)\\)/g, '($1)');
            text = text.replace(/\\(([^)]*?فرانسه[^)]*?)\\)/g, '($1)');
            text = text.replace(/\\(([^)]*?انگلیس[^)]*?)\\)/g, '($1)');
            text = text.replace(/\\(([^)]*?ایتالیا[^)]*?)\\)/g, '($1)');
            
            // Fix specific patterns that are problematic
            text = text.replace(/بدون قهرمانی \\(بهترین: مقام چهارم\\)/g, 'بدون قهرمانی (بهترین: مقام چهارم)');
            text = text.replace(/۷ \\(در انگلیس، اسپانیا، ایتالیا\\)/g, '۷ (در انگلیس، اسپانیا، ایتالیا)');
            text = text.replace(/۱۱ \\(اسپانیا، فرانسه\\)/g, '۱۱ (اسپانیا، فرانسه)');
            
            // Handle numeric text specially to prevent bidirectional issues
            text = text.replace(/(\\d+)/g, '<span class="fix-numbers">$1</span>');
            
            // Apply the fixed text
            cell.innerHTML = text;
          });
        });
        
        // Adjust column widths
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          const cells = firstRow.querySelectorAll('th');
          if (cells.length > 0) {
            // First column (headers) should be wider
            cells[0].style.width = '22%';
            
            // Distribute other columns evenly
            const otherWidth = (78 / (cells.length - 1)) + '%';
            for (let i = 1; i < cells.length; i++) {
              cells[i].style.width = otherWidth;
            }
          }
        }
      });
    }
    
    // Run fixes multiple times to ensure proper rendering
    fixPersianTable();
    setTimeout(fixPersianTable, 200);
    setTimeout(fixPersianTable, 500);
    setTimeout(fixPersianTable, 1000);
  </script>
</body>
</html>`;
}

/**
 * Main PDF Generation function
 * Tries different approaches in sequence
 * 
 * @param {string} tableHtml - HTML table to convert
 * @param {string} filename - Base filename for the output
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDF(tableHtml, filename = DEFAULT_FILENAME) {
  try {
    console.log('Attempting to generate PDF with PDFKit...');
    
    // First attempt: Try PDFKit direct generation (fastest, most reliable)
    try {
      return await generatePDFWithPDFKit(tableHtml, filename);
    } catch (pdfkitError) {
      console.warn('PDFKit generation failed, trying Puppeteer fallback...', pdfkitError.message);
      
      // Second attempt: Try Puppeteer-based generation
      try {
        return await generatePDFWithPuppeteer(tableHtml, filename);
      } catch (puppeteerError) {
        console.warn('Puppeteer generation failed, trying wkhtmltopdf fallback...', puppeteerError.message);
        
        // Final fallback: Use wkhtmltopdf (most compatible but least reliable with RTL)
        return await generatePDFWithWkhtmltopdf(tableHtml, filename);
      }
    }
  } catch (error) {
    console.error('All PDF generation methods failed:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

/**
 * Test PDF generation with a sample table
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function testPDFGeneration() {
  // Simple test table
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
  testPDFGeneration
};