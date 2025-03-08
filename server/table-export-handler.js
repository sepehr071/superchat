/**
 * Table Export Handler
 * Provides a clean integration point between the API endpoint and the enhanced PDF service
 */

const fs = require('fs').promises;
const path = require('path');
const { generatePDF, generatePDFWithOptions } = require('./enhanced-pdf-service');

/**
 * Handle table export request and return PDF
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Handles the response directly
 */
async function handleTableExport(req, res) {
  try {
    let { tableHtml, filename = 'table-export', options = {} } = req.body;
    
    if (!tableHtml) {
      return res.status(400).json({ error: 'Table HTML is required' });
    }
    
    console.log(`Processing table export request for ${filename}...`);
    
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
      pdfPath = await generatePDFWithOptions(tableHtml, filename, options);
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
}

module.exports = {
  handleTableExport
};