/**
 * Test utility for Puppeteer-based PDF generation
 * This script tests the PDF export functionality using Puppeteer
 * 
 * Run with: node utils/test-puppeteer-pdf.js
 */

const puppeteerPdfService = require('../services/pdf-service/puppeteer-pdf-service');
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
 * Test the Puppeteer-based PDF generation
 */
async function testPuppeteerPDF() {
  try {
    console.log('Starting Puppeteer PDF generation test...');
    
    // Create an HTML template with the sample table
    console.log('Generating PDF with Puppeteer...');
    const pdfPath = await puppeteerPdfService.generatePDF(
      sampleTable, 
      'puppeteer-table-export',
      {
        landscape: true,
        headerColor: '#333340',
        oddRowColor: '#28282f',
        evenRowColor: '#222228',
        textColor: 'white',
        headerTextColor: 'white'
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

// Run the test
if (require.main === module) {
  testPuppeteerPDF()
    .then(pdfPath => {
      if (pdfPath) {
        console.log(`\nTo view the PDF, open the file at: ${pdfPath}`);
      }
    })
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = {
  testPuppeteerPDF,
  sampleTable
};