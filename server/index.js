const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { Anthropic } = require('@anthropic-ai/sdk');

// Import custom modules
const { router: authRouter, authenticateUser } = require('./auth');
const conversationsRouter = require('./conversations');
const { router: adminRouter } = require('./admin');
const { db, getCurrentISOTimestamp } = require('./database');
require('./admin-migration'); // Run admin migrations on startup

// Load environment variables from .env.new (explicitly pointing to the new file)
dotenv.config({ path: path.resolve(__dirname, '.env.new') });

// Enhanced Debug: Show more details about the API key
console.log('API Key loaded from .env:', process.env.ANTHROPIC_API_KEY ?
  `${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...${process.env.ANTHROPIC_API_KEY.substring(process.env.ANTHROPIC_API_KEY.length - 20)}` : 'Not found');
console.log('API Key length:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:5000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 }, // 32MB limit per file
  fileFilter: (req, file, cb) => {
    // Allow PDFs and image files
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/admin', adminRouter);

// Direct route for creating empty conversation (fallback for potential router issues)
app.post('/api/conversations/create-empty', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const title = req.body.title || "New Chat";
    
    // Insert conversation with type 'normal'
    const insertConversation = db.prepare(`
      INSERT INTO conversations (user_id, title, type)
      VALUES (?, ?, 'normal')
    `);
    
    const result = insertConversation.run(userId, title);
    const conversationId = result.lastInsertRowid;
    
    console.log(`Created empty conversation with ID: ${conversationId} for user: ${userId}`);
    
    res.status(201).json({
      message: 'Empty conversation created successfully',
      conversationId: conversationId,
      type: 'normal',
      title: title
    });
  } catch (error) {
    console.error('Error creating empty conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Import utilities for PDF generation (more compatible with ARM architecture)
// This approach replaced Puppeteer due to compatibility issues with ARM architecture
// Requires wkhtmltopdf to be installed on the server - run install-wkhtmltopdf.sh
const { exec } = require('child_process');
const util = require('util');
const fsPromises = fs.promises; // Use promise-based API from already imported fs
const execPromise = util.promisify(exec);

// PDF Export endpoint
app.post('/api/export-table', authenticateUser, async (req, res) => {
  try {
    let { tableHtml, filename = 'table-export' } = req.body;
    
    if (!tableHtml) {
      return res.status(400).json({ error: 'Table HTML is required' });
    }
    
    // Generate a unique filename with timestamp and random string
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomString = Math.random().toString(36).substring(2, 8);
    const uniqueFilename = `${filename}-${timestamp}-${randomString}`;
    
    // Create a complete HTML document with proper styling and embedded fonts
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Table Export</title>
        <!-- Import fonts directly - Don't rely on CDN for PDF generation -->
        <style>
          /* Embed Vazirmatn font directly to ensure it's available for PDF generation */
          @font-face {
            font-family: 'Vazirmatn';
            src: url('data:font/woff2;base64,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...
            font-weight: normal;
            font-style: normal;
            font-display: swap;
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
                  text = text.replace(/\(([^)]+)\)\s*([^<]+)/g, '$2 ($1)');
                  
                  // Fix "بیش از" patterns with numbers - e.g., "730 از بیش" to "بیش از 730"
                  text = text.replace(/(\d+)\s+از\s+بیش/g, 'بیش از $1');
                  
                  // Fix numbers followed by Persian text - e.g., "730 گل" to "گل 730"
                  text = text.replace(/(\d+)\s+(قهرمانی|گل|پاس)/g, '$2 $1');
                  
                  // Fix parenthetical phrases - ensure correct bidirectional rendering
                  text = text.replace(/\(([^)]*?بیشترین در تاریخ[^)]*?)\)/g, '(بیشترین در تاریخ)');
                  text = text.replace(/\(([^)]*?اسپانیا[^)]*?)\)/g, '($1)');
                  text = text.replace(/\(([^)]*?فرانسه[^)]*?)\)/g, '($1)');
                  text = text.replace(/\(([^)]*?انگلیس[^)]*?)\)/g, '($1)');
                  text = text.replace(/\(([^)]*?ایتالیا[^)]*?)\)/g, '($1)');
                  
                  // Fix specific patterns that are problematic
                  text = text.replace(/بدون قهرمانی \(بهترین: مقام چهارم\)/g, 'بدون قهرمانی (بهترین: مقام چهارم)');
                  text = text.replace(/۷ \(در انگلیس، اسپانیا، ایتالیا\)/g, '۷ (در انگلیس، اسپانیا، ایتالیا)');
                  text = text.replace(/۱۱ \(اسپانیا، فرانسه\)/g, '۱۱ (اسپانیا، فرانسه)');
                  
                  // Handle numeric text specially to prevent bidirectional issues
                  text = text.replace(/(\d+)/g, '<span class="fix-numbers">$1</span>');
                  
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
      </html>
    `;
    
    // Alternative approach using wkhtmltopdf which works better on ARM
    try {
      // Create a temp HTML file
      const tempHtmlPath = `/tmp/table-${uniqueFilename}.html`;
      const tempPdfPath = `/tmp/table-${uniqueFilename}.pdf`;
      
      // Write the HTML content to the temp file
      await fsPromises.writeFile(tempHtmlPath, htmlContent);
      
      console.log(`Created temporary HTML file at ${tempHtmlPath}`);
      
      // Use wkhtmltopdf to generate PDF (must be installed on the system)
      const cmd = `wkhtmltopdf --encoding utf-8 --enable-local-file-access --javascript-delay 5000 --no-stop-slow-scripts --enable-javascript --debug-javascript --run-script "fixPersianTable();" --dpi 300 --zoom 1.3 --minimum-font-size 14 --margin-left 10 --margin-right 10 --margin-top 20 --margin-bottom 20 --page-size A4 --orientation Landscape ${tempHtmlPath} ${tempPdfPath}`;
      console.log(`Executing command: ${cmd}`);
      
      await execPromise(cmd);
      console.log(`PDF generated at ${tempPdfPath}`);
      
      // Read the generated PDF
      const pdfBuffer = await fsPromises.readFile(tempPdfPath);
      console.log(`PDF Buffer read successfully - size: ${pdfBuffer.length} bytes`);
      
      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      
      // Format Content-Disposition header
      const encodedFilename = encodeURIComponent(uniqueFilename);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${uniqueFilename}.pdf"; filename*=UTF-8''${encodedFilename}.pdf`
      );
      
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send the PDF
      res.end(pdfBuffer);
      
      // Clean up temp files after sending response
      try {
        console.log('Cleaning up temporary files');
        await fsPromises.unlink(tempHtmlPath);
        await fsPromises.unlink(tempPdfPath);
        console.log('Temporary files cleaned up');
      } catch (cleanupError) {
        console.error('Error cleaning up temp files:', cleanupError);
      }
    } catch (innerError) {
      console.error('Error during PDF generation with wkhtmltopdf:', innerError);
      throw innerError;
    }
  } catch (error) {
    console.error('Error generating PDF:', error.name, error.message, error.stack);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: `${error.name}: ${error.message}`
    });
  }
});

// Routes
app.post('/api/upload', authenticateUser, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
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
});

// Add endpoint for uploading files to existing conversation
app.post('/api/conversation/:id/upload', authenticateUser, upload.array('files', 10), (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
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
});

app.post('/api/chat', authenticateUser, async (req, res) => {
  try {
    const { message, fileIds, conversationId, conversationHistory, stream = false, conversationType = 'pdf' } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    // If conversationId is provided, verify it belongs to the user
    if (!conversationId) {
      res.status(400).json({ error: 'Conversation ID is required' });
      return;
    }
    
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, req.user.id);
    
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    
    // Determine the conversation type - use the one from database or fallback to the request parameter
    const chatType = conversation.type || conversationType;
    
    // Get files for this conversation (if any)
    let files = [];
    if (fileIds && fileIds.length > 0) {
      // Get files for this conversation
      files = db.prepare(`
        SELECT * FROM pdf_files
        WHERE conversation_id = ?
        AND id IN (${fileIds.join(',')})
      `).all(conversationId);
    }
    
    // For PDF chat type, files are required
    if (chatType === 'pdf' && files.length === 0) {
      res.status(400).json({ error: 'No files found for this PDF conversation' });
      return;
    }
    
    // Prepare the user message content array
    let userMessageContent = [];
    let messageText = message;
    
    // Process files for any chat type if files are present
    if (files.length > 0) {
      // Format document content with XML structure for better context handling
      let documentContent = '<documents>\n';
      
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Read the file and convert to base64
        const fileBuffer = fs.readFileSync(file.file_path);
        const base64Data = fileBuffer.toString('base64');
        
        // Add document to XML structure
        documentContent += `  <document index="${i+1}">\n`;
        documentContent += `    <source>${file.file_name}</source>\n`;
        
        // Add file content to message based on file type
        if (file.file_type === 'application/pdf') {
          userMessageContent.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          });
        } else if (file.file_type.startsWith('image/')) {
          userMessageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.file_type,
              data: base64Data
            }
          });
        }
      }
      
      // Close the XML structure
      documentContent += '</documents>\n\n';
      
      // Add document content to the message
      messageText = documentContent + message;
    }
    
    // Add the user's message text at the end
    userMessageContent.push({
      type: 'text',
      text: messageText
    });
    
    // Prepare the messages for Claude
    const userMessage = {
      role: 'user',
      content: userMessageContent
    };
    
    // Create messages array
    let messageArray = [userMessage];
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      // Add previous messages to the conversation
      messageArray = [...conversationHistory, ...messageArray];
    } else if (conversationId) {
      // If conversationId is provided but no history, fetch from database
      const messages = db.prepare(`
        SELECT role, content
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conversationId);
      
      if (messages.length > 0) {
        messageArray = [...messages, ...messageArray];
      }
    }
    
    // Create a system prompt based on conversation type
    let systemPrompt;
    let temperature = 0.4;
    
    if (chatType === 'pdf') {
      // System prompt for PDF analysis
      systemPrompt = `You are an intelligent assistant created by Sepehr Radmard for Super Chat.
Your purpose is to help users analyze and understand documents.

When working with document content:
1. First extract and quote relevant information from the documents using <quotes> tags
2. Then provide clear, detailed responses based solely on the document contents
3. For diagrams or tables in the documents, describe what they show and explain key data points
4. When referencing specific information, note the document and section
5. When organizing information or answering requests for data structuring, feel free to create markdown tables to present information clearly

Tables are supported in this interface. Use markdown table syntax when presenting tabular data:
\`\`\`
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| More 1   | More 2   | More 3   |
\`\`\`

Guidelines:
- you are an multilingual assistant so answer and respond based on the user input , or change your language if the user ask to
- Answer questions based ONLY on the content in the documents but in any language . If the information isn't in any document, clearly state this.
- When referencing specific information, mention the document name, page number, or section when possible
- Maintain context throughout the conversation about these documents
- Present information in a clear, structured manner
- For technical content, explain it in accessible terms while maintaining accuracy
- if you get asked about yourslef like "who are you?" , "what is your model?" say that you are an optimized llm model created by "Sepehr Radmard" to help all people in the world

When formatting mathematical content:
- For inline math, use $...$ syntax (e.g., $E = mc^2$)
- For display math, prefer $$...$$ syntax (e.g., $$E = mc^2$$)
- When using environments, prefer aligned format: $$\\begin{aligned}...\\end{aligned}$$
- Avoid using \\begin{equation} directly, as it may not render correctly
- For complex mathematics, break formulas into smaller, more manageable parts
- Use \\text{} for text within math environments

Always maintain a helpful, informative tone. You are Super Chat's core assistant, built to provide accurate document analysis.`;
    } else {
      // System prompt for normal conversations
      systemPrompt = `You are a multilingual helpful assistant created by Sepehr Radmard for Super Chat.
Your purpose is to assist users with any questions or tasks they need help with.

Guidelines:
- Respond to questions on any topic with accurate, helpful information
- Provide detailed, nuanced responses that consider multiple perspectives
- Explain complex concepts in clear, accessible language
- When appropriate, break down your answers into steps or sections for clarity
- If you're unsure about something, acknowledge the limitations of your knowledge
- Respond in the same language the user uses for their query
- if you get asked about yourslef like "who are you?" , "what is your model?" say that you are an optimized llm model created by "Sepehr Radmard" to help all people in the world

When formatting mathematical content:
- For inline math, use $...$ syntax (e.g., $E = mc^2$)
- For display math, prefer $$...$$ syntax (e.g., $$E = mc^2$$)
- When using environments, prefer aligned format: $$\\begin{aligned}...\\end{aligned}$$
- Avoid using \\begin{equation} directly, as it may not render correctly
- For complex mathematics, break formulas into smaller, more manageable parts
- Use \\text{} for text within math environments

Always maintain a friendly, respectful, and helpful tone. You are Super Chat's versatile assistant, designed to provide high-quality responses on a wide range of topics.`;
      
      // Use a slightly higher temperature for normal chat
      temperature = 0.5;
    }
    
    // Add system prompt as the first message from the assistant
    const messagesWithSystem = [
      { role: 'assistant', content: systemPrompt },
      ...messageArray
    ];
    
    // Check if streaming is requested
    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if using Nginx
      
      try {
        // Create a streaming request to Anthropic API with dynamic temperature
        const stream = await anthropic.messages.stream({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 64000, // Increased from 4096 to utilize the 128k capacity
          temperature: temperature,
          messages: messagesWithSystem
        });

        // If conversationId is provided, save the user message first
        if (conversationId) {
          try {
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
          } catch (dbError) {
            console.error('Error saving user message to database:', dbError);
          }
        }
        
        // Variable to accumulate the full assistant response
        let fullAssistantResponse = '';
        
        // Forward each event from Anthropic to the client
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && 'delta' in event) {
            // Send text deltas to the client
            if (event.delta.type === 'text_delta') {
              // Accumulate the response for saving to database
              fullAssistantResponse += event.delta.text;
              
              // Send to client
              res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
          } else if (event.type === 'message_stop') {
            // End of message
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            
            // Save the assistant message to database if conversationId is provided
            if (conversationId && fullAssistantResponse.length > 0) {
              try {
                // Save assistant message
                const insertAssistantMessage = db.prepare(`
                  INSERT INTO messages (conversation_id, role, content)
                  VALUES (?, ?, ?)
                `);
                insertAssistantMessage.run(conversationId, 'assistant', fullAssistantResponse);
                
                // Update conversation's updated_at timestamp with current ISO timestamp
                const currentTime = getCurrentISOTimestamp();
                db.prepare(`
                  UPDATE conversations
                  SET updated_at = ?
                  WHERE id = ?
                `).run(currentTime, conversationId);
              } catch (dbError) {
                console.error('Error saving assistant message to database:', dbError);
              }
            }
          }
        }
        
        // End the response
        res.end();
      } catch (apiError) {
        console.error('Anthropic API Streaming Error:', apiError);
        res.write(`data: ${JSON.stringify({ 
          error: 'Error calling Claude API', 
          details: apiError.message || 'Unknown error'
        })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming request
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 64000, // Increased from 4096 to utilize the 128k capacity
          temperature: temperature,
          messages: messagesWithSystem
        });
        
        // Get the assistant's response text
        const assistantResponse = response.content[0].text;
        
        // If conversationId is provided, save the messages
        if (conversationId) {
          try {
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
            
            // Save assistant message
            const insertAssistantMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertAssistantMessage.run(conversationId, 'assistant', assistantResponse);
            
            // Update conversation's updated_at timestamp with current ISO timestamp
            const currentTime = getCurrentISOTimestamp();
            db.prepare(`
              UPDATE conversations
              SET updated_at = ?
              WHERE id = ?
            `).run(currentTime, conversationId);
          } catch (dbError) {
            console.error('Error saving messages to database:', dbError);
          }
        }
        
        // Return the response
        res.status(200).json(response);
      } catch (apiError) {
        console.error('Anthropic API Error:', apiError);
        res.status(500).json({ 
          error: 'Error calling Claude API', 
          details: apiError.message || 'Unknown error'
        });
      }
    }
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Catch-all route to serve the main HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and bound to all interfaces`);
});
