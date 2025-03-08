/**
 * Puppeteer PDF Service
 * Uses headless Chrome via Puppeteer to generate PDFs with proper RTL support
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const puppeteerConfig = require('../../config/puppeteer-config');

// Singleton browser instance for reuse
let browserInstance = null;
// PDF buffer cache to avoid regenerating identical tables
const pdfBufferCache = new Map();

// Constants for PDF generation
const PDF_TEMP_DIR = path.join(__dirname, '../../temp');
const DEFAULT_FILENAME = 'table-export';

/**
 * Get or create a shared browser instance
 * This improves performance by reusing the browser
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function getBrowser() {
  if (!browserInstance) {
    console.log('Launching new Puppeteer browser instance...');

    // Platform-specific options for different architectures and operating systems
    // Use our centralized config with architecture-specific settings
    const options = { ...puppeteerConfig };
    
    // Use environment-provided executable path if available (important for ARM/Linux)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      console.log(`Using browser from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.env.CHROME_BIN) {
      console.log(`Using browser from CHROME_BIN: ${process.env.CHROME_BIN}`);
      options.executablePath = process.env.CHROME_BIN;
    }
    
    // Log detailed system information for debugging
    console.log('System information:');
    console.log(` - Platform: ${process.platform}`);
    console.log(` - Architecture: ${process.arch}`);
    
    browserInstance = await puppeteer.launch(options);
    
    // Handle browser crashes or unexpected closures
    browserInstance.on('disconnected', () => {
      console.log('Browser disconnected, will create new instance on next request');
      browserInstance = null;
    });
  }
  
  return browserInstance;
}

/**
 * Clean up browser instance on application shutdown
 */
function cleanupBrowser() {
  if (browserInstance) {
    console.log('Closing Puppeteer browser instance during cleanup');
    browserInstance.close().catch(err => {
      console.error('Error closing browser:', err);
    });
    browserInstance = null;
  }
}

/**
 * Calculate cache key for PDF generation
 * @param {string} tableHtml - Table HTML
 * @param {Object} options - PDF options
 * @returns {string} Cache key
 */
function calculateCacheKey(tableHtml, options) {
  const content = JSON.stringify({ tableHtml, options });
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Generate PDF from HTML table content using Puppeteer
 * This provides much better support for RTL text, especially Persian
 * 
 * @param {string} tableHtml - HTML table content to convert
 * @param {string} filename - Base filename for the generated PDF
 * @param {Object} options - Additional options for PDF generation
 * @returns {Promise<string>} - Path to the generated PDF file
 */
async function generatePDF(tableHtml, filename = DEFAULT_FILENAME, options = {}) {
  // Generate cache key
  const cacheKey = calculateCacheKey(tableHtml, options);
  
  // Create unique filename based on time and random ID
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomId = crypto.randomBytes(4).toString('hex');
  const uniqueFilename = `${filename}-${timestamp}-${randomId}.pdf`;
  const outputPath = path.join(PDF_TEMP_DIR, uniqueFilename);
  
  // Check if we have a cached buffer version
  if (pdfBufferCache.has(cacheKey)) {
    console.log('Using cached PDF buffer');
    
    // Write the cached buffer to a new file
    await fs.writeFile(outputPath, pdfBufferCache.get(cacheKey));
    console.log(`Cached PDF buffer written to: ${outputPath}`);
    return outputPath;
  }
  
  const defaultOptions = {
    format: 'A4',
    landscape: true,
    margins: {
      top: '1cm',
      right: '1cm',
      bottom: '1cm',
      left: '1cm'
    },
    headerColor: '#333340',
    oddRowColor: '#28282f',
    evenRowColor: '#222228',
    textColor: 'white',
    headerTextColor: 'white'
  };

  // Merge default options with custom options
  const opts = { ...defaultOptions, ...options };

  // Ensure temp directory exists
  if (!fs.existsSync(PDF_TEMP_DIR)) {
    fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
  }
  
  console.log(`Starting Puppeteer PDF generation for ${filename}...`);

  // Create a complete HTML document with proper RTL styling
  let htmlContent = createHtmlTemplate(tableHtml, opts);

  // Performance optimization: pre-compile critical HTML for faster loading
  htmlContent = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Track generation time for performance logging
  const startTime = Date.now();
  let browser = null;
  let page = null;
  
  try {
    // Get or create shared browser instance
    browser = await getBrowser();

    // Create a new page
    page = await browser.newPage();
    
    // Optimize viewport size based on format and orientation
    const viewportWidth = opts.landscape ? 1200 : 850;
    const viewportHeight = opts.landscape ? 850 : 1200;
    
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 2 // For higher quality
    });

    // Set content with optimized wait conditions
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded', // Faster than networkidle0
      timeout: 20000
    });

    // Use CSS visibility check to ensure fonts are loaded
    await page.evaluate(() => {
      return new Promise(resolve => {
        // Check if document is ready, otherwise wait for load event
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
        }
      });
    });

    // Generate PDF with optimized settings
    await page.pdf({
      path: outputPath,
      format: opts.format,
      landscape: opts.landscape,
      printBackground: true,
      margin: opts.margins,
      preferCSSPageSize: true,
      omitBackground: false // Ensure background colors are included
    });

    // Read the file into a buffer and cache it
    const pdfBuffer = await fs.readFile(outputPath);
    pdfBufferCache.set(cacheKey, pdfBuffer);
    
    // Limit buffer cache size to avoid memory issues (lower for ARM)
    const maxCacheSize = process.arch === 'arm64' ? 10 : 20;
    if (pdfBufferCache.size > maxCacheSize) {
      // Remove oldest entry (first key added)
      const oldestKey = pdfBufferCache.keys().next().value;
      pdfBufferCache.delete(oldestKey);
    }
    
    const endTime = Date.now();
    console.log(`PDF successfully generated at: ${outputPath} (${endTime - startTime}ms)`);
    
    return outputPath;
  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', error);
    
    // Try to diagnose the issue
    try {
      // Create a safer version of options for a retry
      const fallbackOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN
      };
      
      console.error('Trying fallback puppeteer options...');
      const fallbackBrowser = await puppeteer.launch(fallbackOptions);
      await fallbackBrowser.close();
      console.error('Fallback browser launched successfully - issue may be with page creation or rendering');
    } catch (fallbackError) {
      console.error('Fallback browser also failed:', fallbackError);
    }
    
    // Provide detailed error for Linux debugging
    if (process.platform === 'linux') {
      console.error('Linux-specific debugging info:');
      console.error('- Check Chrome dependencies');
      
      if (process.arch === 'arm64') {
        console.error('- ARM64 architecture detected, may need ARM-specific packages');
        console.error('- Make sure chromium-browser is installed');
      } else {
        console.error('- Check Chrome dependencies with: ldd $(which google-chrome)');
      }
      
      console.error('- Ensure fonts-liberation package is installed');
    }
    
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    // Clean up page but keep browser for reuse
    if (page) {
      await page.close().catch(e => console.error('Error closing page:', e));
    }
  
    // If we keep having issues, release the browser instance for a fresh start next time
    if (browserInstance && Math.random() < 0.05) { // 5% chance of browser reset
      try {
        await browserInstance.close();
      } catch (e) {
        console.error('Error closing browser during periodic cleanup:', e);
      }
      browserInstance = null;
      console.log('Browser instance released for periodic refresh');
    }
  }
}

/**
 * Create a complete HTML document with RTL support and styling
 * @param {string} tableHtml - The HTML table content
 * @param {Object} options - Styling options
 * @returns {string} - Complete HTML document
 */
function createHtmlTemplate(tableHtml, options) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Table Export</title>
  <!-- Add Vazir font from Google Fonts for Persian text -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap">
  <style>
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
    
    html, body {
      direction: rtl;
      text-align: right;
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      background-color: white;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    
    * {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
    }
    
    .table-container {
      width: 100%;
      margin: 0 auto;
      padding: 0;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      direction: rtl;
      border: 2px solid #4a4a57;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    
    /* Column widths */
    table th:first-child, table td:first-child {
      width: 22%;
      min-width: 140px;
      font-weight: bold;
    }
    
    table th:not(:first-child), table td:not(:first-child) {
      width: 39%;
      min-width: 180px;
    }
    
    th {
      background-color: ${options.headerColor};
      color: ${options.headerTextColor};
      font-weight: bold;
      border-bottom: 2px solid #a855f7;
      text-align: center;
      padding: 12px 15px;
      white-space: normal;
      word-wrap: break-word;
    }
    
    td {
      border: 1px solid #4a4a57;
      padding: 12px 15px;
      text-align: center;
      white-space: normal;
      word-wrap: break-word;
    }
    
    /* Alternating row colors */
    tr:nth-child(odd):not(:first-child) {
      background-color: ${options.oddRowColor};
      color: ${options.textColor};
    }
    
    tr:nth-child(even):not(:first-child) {
      background-color: ${options.evenRowColor};
      color: ${options.textColor};
    }
    
    /* Footer with page number */
    .footer {
      position: fixed;
      bottom: 0;
      width: 100%;
      text-align: center;
      font-size: 10px;
      color: #666;
      padding: 5px 0;
    }
  </style>
</head>
<body>
  <div class="table-container">
    ${tableHtml
      .replace(/<table/g, '<table dir="rtl" lang="fa" class="comparison-table"')
      .replace(/<th/g, '<th dir="rtl" lang="fa"')
      .replace(/<td/g, '<td dir="rtl" lang="fa"')}
  </div>
  <div class="footer">
    <span class="page-number"></span>
  </div>
  <script>
    // Apply additional RTL attributes to ensure proper rendering
    document.addEventListener('DOMContentLoaded', function() {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'fa';
      document.body.dir = 'rtl';
      document.body.lang = 'fa';
      
      // Process all tables
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        table.dir = 'rtl';
        table.setAttribute('lang', 'fa');
        
        // Process each cell for RTL text
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
          cell.dir = 'rtl';
          cell.setAttribute('lang', 'fa');
          cell.style.textAlign = 'center';
        });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Test Puppeteer PDF generation with a sample table
 * @returns {Promise<string>} - Path to the generated PDF
 */
async function testPDF() {
  // Sample test table with Persian text
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
  
  return generatePDF(testTable, 'puppeteer-test-table');
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

module.exports = {
  generatePDF,
  generatePDFWithOptions,
  testPDF,
  cleanupBrowser,
  // For testing purposes only
  _clearCache: () => pdfBufferCache.clear()
};