const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { authenticateUser } = require('./middleware/auth');

// Initialize Express app
const app = express();

// Configure middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.paths.uploadDir;
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

// Make multer upload middleware available to the application
app.locals.upload = upload;

// Serve static files from the client directory
app.use(express.static(config.paths.clientDir));

// Import route handlers
const authRoutes = require('./routes/auth.routes');
const conversationRoutes = require('./routes/conversation.routes');
const fileRoutes = require('./routes/file.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const { db, getCurrentISOTimestamp } = require('./config/database');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', authenticateUser, conversationRoutes);
app.use('/api/files', authenticateUser, fileRoutes);
app.use('/api/chat', chatRoutes); // Already has authentication middleware in its router
app.use('/api/admin', adminRoutes); // Already has authentication middleware in its router

// Backward compatibility for direct chat route
app.post('/api/chat', authenticateUser, (req, res) => {
  // The new chat routes already use the same endpoint, but let's ensure this still works
  // Just pass it to the controller directly
  const chatController = require('./controllers/chat.controller');
  chatController.processChat(req, res);
});

// Backward compatibility routes for client
// Original file upload route
app.post('/api/upload', authenticateUser, upload.array('files', 10), (req, res) => {
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
        fileIds: fileRecords.map(file => file.id),
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

// Original route for adding files to existing conversation
app.post('/api/conversation/:id/upload', authenticateUser, upload.array('files', 10), (req, res) => {
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
        fileIds: fileRecords.map(file => file.id),
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

// Backwards compatibility for PDF export
app.post('/api/export-table', authenticateUser, (req, res) => {
  // Forward to the new endpoint
  req.url = '/api/files/export-table';
  app._router.handle(req, res);
});

// Define routes for specific HTML pages
// Redirect root URL to new dashboard
app.get('/', (req, res) => {
  console.log('Redirecting from root to new dashboard');
  res.redirect('/new-dashboard.html');
});

// Redirect old dashboard to new dashboard
app.get('/dashboard.html', (req, res) => {
  console.log('Redirecting from old dashboard to new dashboard');
  res.redirect('/new-dashboard.html');
});

app.get('/new-dashboard.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'new-dashboard.html'));
});

app.get('/normal-chat.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'normal-chat.html'));
});

app.get('/pdf-chat.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'pdf-chat.html'));
});

app.get('/deep-research.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'deep-research.html'));
});

app.get('/media-to-text.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'media-to-text.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'admin-dashboard.html'));
});

app.get('/user-details.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'user-details.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(config.paths.clientDir, 'login.html'));
});

// Final catch-all route to serve the main dashboard
app.get('*', (req, res) => {
  res.sendFile(config.paths.indexHtml);
});

module.exports = app;