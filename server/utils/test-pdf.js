/**
 * PDF Export Test Utility
 * 
 * This script tests the PDF export functionality with a sample table
 * Run with: node utils/test-pdf.js
 */

const enhancedPdfService = require('../services/pdf-service/enhanced-pdf-service');
const fs = require('fs');
const path = require('path');

// Sample table for testing
const sampleTable = `
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

/**
 * Test PDF generation with a sample table
 */
async function testPdfGeneration() {
  try {
    console.log('Starting PDF generation test...');
    
    // Create an HTML template with the sample table
    const htmlTemplate = createHTMLTemplate(sampleTable);
    
    // Generate PDF with the sample table
    console.log('Generating PDF...');
    const pdfPath = await enhancedPdfService.generatePDF(
      htmlTemplate, 
      'test-table-export',
      {
        orientation: 'landscape',
        headerColor: '#333340',
        oddRowColor: '#28282f',
        evenRowColor: '#222228',
        textColor: 'white'
      }
    );
    
    console.log(`PDF generated successfully at: ${pdfPath}`);
    console.log('\nTest completed successfully!');
    
    return pdfPath;
  } catch (error) {
    console.error('PDF generation test failed:', error);
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
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Table Export Test</title>
  <style>
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
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      direction: rtl;
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
      word-wrap: break-word;
      line-height: 1.5;
    }
    
    td {
      border: 1px solid #4a4a57;
      padding: 12px 15px;
      text-align: center;
      word-wrap: break-word;
      line-height: 1.5;
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
</body>
</html>`;
}

// Run the test
if (require.main === module) {
  testPdfGeneration()
    .then(pdfPath => {
      if (pdfPath) {
        console.log(`\nTo view the PDF, copy the file from: ${pdfPath}`);
      }
    })
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = {
  testPdfGeneration,
  sampleTable
};