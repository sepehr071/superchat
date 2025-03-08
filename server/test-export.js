/**
 * Test script for the PDF export functionality
 */

require('dotenv').config({ path: '.env.new' });
const express = require('express');
const bodyParser = require('express').json({ limit: '50mb' });
const exportRouter = require('./routes/export-router');

// Create a simple Express app for testing
const app = express();
app.use(bodyParser);
app.use('/api/export', exportRouter);

// Sample table data
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

// Test function for PDF export
async function testPDFExport() {
  const pdfService = require('./services/pdf-service');
  
  try {
    console.log('Testing PDF export...');
    const result = await pdfService.generatePDF(sampleTable, 'test-export');
    console.log(`Test successful! PDF generated at ${result}`);
    return result;
  } catch (error) {
    console.error('PDF export test failed:', error);
    throw error;
  }
}

// Run the test if the script is executed directly
if (require.main === module) {
  // Mock authentication middleware for testing
  const mockAuth = (req, res, next) => {
    req.user = { id: 1 };
    next();
  };
  
  // Replace the real authentication middleware for testing
  const authModule = require('./auth');
  authModule.authenticateUser = mockAuth;
  
  // Run the test
  testPDFExport()
    .then(pdfPath => {
      console.log('Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPDFExport };