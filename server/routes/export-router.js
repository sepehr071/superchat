/**
 * Export Router Module
 * Handles routes for exporting data to various formats (PDF, etc.)
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { authenticateUser } = require('../auth');
const pdfService = require('../services/pdf-service');
const fileUtils = require('../utils/file-utils');
const fontManager = require('../services/pdf-service/font-manager');

/**
 * Handle table export to PDF
 * @route POST /api/export/table
 */
router.post('/table', authenticateUser, async (req, res) => {
  try {
    let { tableHtml, filename = 'table-export', options = {} } = req.body;
    
    if (!tableHtml) {
      return res.status(400).json({ error: 'Table HTML is required' });
    }
    
    console.log(`Processing table export request for ${filename}...`);
    
    // Create a complete HTML document with proper styling for the table
    const htmlContent = createHTMLTemplate(tableHtml);
    
    // Parse options if they were sent as a string
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        console.warn('Could not parse options JSON, using defaults');
        options = {};
      }
    }
    
    // Generate PDF with enhanced service
    let pdfPath;
    try {
      pdfPath = await pdfService.generatePDFWithOptions(htmlContent, filename, options);
      console.log(`PDF generated successfully at ${pdfPath}`);
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      return res.status(500).json({
        error: 'Failed to generate PDF',
        details: pdfError.message
      });
    }
    
    // Read the generated PDF
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      console.log(`PDF Buffer read successfully - size: ${pdfBuffer.length} bytes`);
      
      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      
      // Format Content-Disposition header
      const sanitizedFilename = filename.replace(/[^\w\-\.]/g, '_');
      const encodedFilename = encodeURIComponent(sanitizedFilename);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizedFilename}.pdf"; filename*=UTF-8''${encodedFilename}.pdf`
      );
      
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF
      res.end(pdfBuffer);
      
      // Clean up temp file after sending response
      try {
        await fs.unlink(pdfPath);
        console.log('Temporary PDF file cleaned up');
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    } catch (readError) {
      console.error('Error reading PDF file:', readError);
      return res.status(500).json({
        error: 'Failed to read generated PDF',
        details: readError.message
      });
    }
  } catch (error) {
    console.error('Error in table export handler:', error);
    res.status(500).json({
      error: 'Failed to process export request',
      details: error.message
    });
  }
});

/**
 * Create a complete HTML document with proper styling for the table
 * 
 * @param {string} tableHtml - The HTML table content
 * @returns {string} - Complete HTML document
 */
function createHTMLTemplate(tableHtml) {
  // Add font CSS
  const fontCSS = fontManager.generateFontCSS();
  
  // Create HTML template with inline styles for proper RTL display
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
    
    // Function to fix Persian text in tables
    function fixPersianTable() {
      // Process all tables
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        // Ensure the table has proper RTL attributes
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
    }
    
    // Run the fix when the page loads
    document.addEventListener('DOMContentLoaded', fixPersianTable);
    fixPersianTable();
  </script>
</body>
</html>`;
}

module.exports = router;