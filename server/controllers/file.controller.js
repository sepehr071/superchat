const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { db, getCurrentISOTimestamp } = require('../config/database');

/**
 * Upload files and create a new conversation
 */
exports.uploadFiles = (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Create a new conversation
    const userId = req.user.id;
    const firstFileName = path.basename(req.files[0].originalname);
    const extension = path.extname(firstFileName);
    const title = firstFileName.replace(extension, ''); // Use first filename as title
    
    // Use transaction to ensure data consistency
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Insert conversation
      const insertConversation = db.prepare(`
        INSERT INTO conversations (user_id, title)
        VALUES (?, ?)
      `);
      
      const result = insertConversation.run(userId, title);
      const conversationId = result.lastInsertRowid;
      
      // Insert file records
      const insertFile = db.prepare(`
        INSERT INTO pdf_files (conversation_id, file_path, file_name, file_type, upload_time)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      // Process each file
      const fileRecords = req.files.map(file => {
        const fileName = path.basename(file.originalname);
        const filePath = file.path;
        const fileType = file.mimetype;
        
        // Insert file record
        const fileResult = insertFile.run(
          conversationId, 
          filePath, 
          fileName, 
          fileType, 
          getCurrentISOTimestamp()
        );
        
        return {
          id: fileResult.lastInsertRowid,
          path: filePath,
          name: fileName,
          type: fileType
        };
      });
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({
        message: 'Files uploaded successfully',
        files: fileRecords,
        conversationId: conversationId
      });
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
};

/**
 * Add files to an existing conversation
 */
exports.addFilesToConversation = (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Use transaction to ensure data consistency
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Insert file records
      const insertFile = db.prepare(`
        INSERT INTO pdf_files (conversation_id, file_path, file_name, file_type, upload_time)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      // Process each file
      const fileRecords = req.files.map(file => {
        const fileName = path.basename(file.originalname);
        const filePath = file.path;
        const fileType = file.mimetype;
        
        // Insert file record
        const fileResult = insertFile.run(
          conversationId, 
          filePath, 
          fileName, 
          fileType, 
          getCurrentISOTimestamp()
        );
        
        return {
          id: fileResult.lastInsertRowid,
          path: filePath,
          name: fileName,
          type: fileType
        };
      });
      
      // Update conversation's updated_at timestamp
      const currentTime = getCurrentISOTimestamp();
      db.prepare(`
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
      `).run(currentTime, conversationId);
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({
        message: 'Files uploaded successfully',
        files: fileRecords,
        conversationId: conversationId
      });
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error uploading files to conversation:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
};

/**
 * Export table to PDF
 */
exports.exportTableToPdf = async (req, res) => {
  try {
    let { tableHtml, filename = 'table-export' } = req.body;
    
    if (!tableHtml) {
      return res.status(400).json({ error: 'Table HTML is required' });
    }
    
    // Generate a unique filename with timestamp and random string
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomString = Math.random().toString(36).substring(2, 8);
    const uniqueFilename = `${filename}-${timestamp}-${randomString}`;
    
    // Create a complete HTML document with proper styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Table Export</title>
        <!-- Import Vazir font for Persian text support -->
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap">
        <style>
          @font-face {
            font-family: 'Vazirmatn';
            src: url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap');
            font-weight: normal;
            font-style: normal;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
            color: #333;
            padding: 20px;
          }
          
          /* RTL and Persian text support - more compatible selectors */
          :lang(fa), :lang(ar), [dir="rtl"] {
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          /* Apply Vazir font and RTL for Persian content */
          .rtl-text {
            direction: rtl;
            text-align: right;
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          /* Add a script to detect Persian text and apply RTL class */
          body.rtl {
            direction: rtl;
            text-align: right;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 0 auto;
          }
          
          th {
            background-color: #333340;
            color: #f0f0f0;
            font-weight: 600;
            border-bottom: 2px solid #a855f7;
            text-align: left;
            padding: 10px 12px;
          }
          
          td {
            border: 1px solid #4a4a57;
            padding: 10px 12px;
            text-align: left;
          }
          
          /* Fallback to use JavaScript to apply RTL */
          .rtl-cell {
            text-align: right;
            direction: rtl;
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          tr:nth-child(odd) {
            background-color: #28282f;
            color: #f0f0f0;
          }
          
          tr:nth-child(even) {
            background-color: #222228;
            color: #f0f0f0;
          }
        </style>
      </head>
      <body>
        ${tableHtml}
      </body>
      </html>
    `;
    
    // Launch puppeteer browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Set content and generate PDF
      await page.setContent(htmlContent);
      
      // Wait for Vazir font to load properly and apply RTL classes using JavaScript
      await page.evaluateHandle(() => {
        return new Promise((resolve) => {
          // Apply RTL detection for Persian text
          function detectPersianAndApplyRTL() {
            // Detect Persian text in table cells and apply RTL
            const persianRegex = /[\u0600-\u06FF]/;
            
            // Check if body contains Persian text
            if (persianRegex.test(document.body.innerText)) {
              document.body.classList.add('rtl');
            }
            
            // Process table cells
            const cells = document.querySelectorAll('th, td');
            cells.forEach(cell => {
              if (persianRegex.test(cell.innerText)) {
                cell.classList.add('rtl-cell');
              }
            });
          }
          
          // Wait for fonts to load first
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
              detectPersianAndApplyRTL();
              // Add a small delay to ensure font rendering and script execution
              setTimeout(resolve, 800);
            });
          } else {
            // Fallback if document.fonts.ready is not available
            setTimeout(() => {
              detectPersianAndApplyRTL();
              resolve();
            }, 1200);
          }
        });
      });
      
      // Generate PDF with proper font embedding
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      // Close browser
      await browser.close();
      
      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      
      // Format Content-Disposition header according to RFC 6266 for better browser compatibility
      // Both filename and filename* parameters are included for wider compatibility
      const encodedFilename = encodeURIComponent(uniqueFilename);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${uniqueFilename}.pdf"; filename*=UTF-8''${encodedFilename}.pdf`
      );
      
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF buffer directly
      res.end(pdfBuffer);
    } catch (innerError) {
      console.error('Error during PDF generation with Puppeteer:', innerError);
      await browser.close();
      throw innerError;
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};