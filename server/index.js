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
    
    // Create a complete HTML document with proper styling
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>Table Export</title>
        <!-- Import Vazir font for Persian text support -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
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
            color: #333;
            padding: 20px;
            background-color: white;
          }
          
          * {
            font-family: 'Vazirmatn', Tahoma, Arial, sans-serif !important;
            direction: rtl !important;
            unicode-bidi: embed;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 0 auto;
            direction: rtl;
            text-align: right;
            border: 2px solid #4a4a57;
            table-layout: fixed;
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
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
            position: relative;
          }
          
          tr:nth-child(odd) {
            background-color: #28282f;
            color: white;
          }
          
          tr:nth-child(even) {
            background-color: #222228;
            color: white;
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
          }
          
          /* Fix for RTL text in cells */
          [lang="fa"] td,
          [dir="rtl"] td {
            text-align: center;
            vertical-align: middle;
          }

          /* Overrides for specific tables */
          .comparison-table th:first-child,
          .comparison-table td:first-child {
            position: sticky;
            right: 0;
            background-color: #333340;
            z-index: 2;
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
          
          // Fix Persian text display in tables
          function fixPersianTable() {
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
              table.dir = 'rtl';
              table.setAttribute('lang', 'fa');
              
              // Fix all cells
              const cells = table.querySelectorAll('th, td');
              cells.forEach(cell => {
                // Ensure RTL attributes
                cell.dir = 'rtl';
                cell.setAttribute('lang', 'fa');
                cell.style.textAlign = 'center';
                
                // Get the cell text content
                let text = cell.innerHTML;
                
                // Fix parentheses position - e.g., "(CR7) کریستیانو رونالدو" to "کریستیانو رونالدو (CR7)"
                text = text.replace(/\(([^)]+)\)\s+([^<]+)/g, '$2 ($1)');
                
                // Fix number phrases - e.g., "730 از بیش" to "بیش از 730"
                text = text.replace(/(\d+)\s+از\s+بیش/g, 'بیش از $1');
                
                // Fix "بیشترین در تاریخ" phrases that might be reversed
                text = text.replace(/\(([^)]*بیشترین در تاریخ[^)]*)\)/g, '(بیشترین در تاریخ)');
                
                // Apply the fixed text
                cell.innerHTML = text;
              });
            });
          }
          
          // Run the fix immediately
          fixPersianTable();
          
          // Run again after a delay to ensure all content is processed
          setTimeout(fixPersianTable, 500);
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
      const cmd = `wkhtmltopdf --encoding utf-8 --enable-local-file-access --javascript-delay 2000 --no-stop-slow-scripts --enable-javascript --dpi 300 --margin-left 0 --margin-right 0 --margin-top 10 --margin-bottom 10 ${tempHtmlPath} ${tempPdfPath}`;
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
