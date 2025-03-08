/**
 * Upload Router Module
 * Handles file uploads for the application
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateUser } = require('../auth');
const { db, getCurrentISOTimestamp } = require('../database');
const fileUtils = require('../utils/file-utils');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    fileUtils.ensureDirectoryExists(uploadDir);
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

/**
 * Upload files and create a new conversation
 * @route POST /api/upload
 */
router.post('/', authenticateUser, upload.array('files', 10), (req, res) => {
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

/**
 * Upload files to an existing conversation
 * @route POST /api/conversation/:id/upload
 */
router.post('/conversation/:id', authenticateUser, upload.array('files', 10), (req, res) => {
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

module.exports = router;