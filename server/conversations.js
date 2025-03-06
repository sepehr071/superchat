const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, getCurrentISOTimestamp } = require('./database');
const { authenticateUser } = require('./auth');

const router = express.Router();

// Apply authentication middleware to all conversation routes
router.use(authenticateUser);

// Create an empty conversation for normal chat (without files)
router.post('/create-empty', (req, res) => {
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

// Get all conversations for the current user
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = db.prepare(`
      SELECT c.id, c.title, c.created_at, c.updated_at, c.type,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
      (SELECT COUNT(*) FROM pdf_files WHERE conversation_id = c.id) as file_count
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);
    
    // Format the response
    const formattedConversations = conversations.map(conv => {
      return {
        id: conv.id,
        title: conv.title,
        messageCount: conv.message_count,
        fileCount: conv.file_count,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        type: conv.type || 'pdf' // Default to 'pdf' for backward compatibility
      };
    });
    
    res.status(200).json({ conversations: formattedConversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get a specific conversation with messages and files
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    // Get conversation
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get files for this conversation
    const files = db.prepare(`
      SELECT id, file_path, file_name, file_type, upload_time
      FROM pdf_files
      WHERE conversation_id = ?
      ORDER BY upload_time ASC
    `).all(conversationId);
    
    // Get messages for this conversation
    const messages = db.prepare(`
      SELECT role, content, timestamp
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(conversationId);
    
    // Format the response
    const formattedConversation = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      type: conversation.type || 'pdf', // Include conversation type
      files: files.map(file => ({
        id: file.id,
        name: file.file_name,
        type: file.file_type,
        uploadTime: file.upload_time
      })),
      messages: messages
    };
    
    res.status(200).json({ conversation: formattedConversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get files for a conversation
router.get('/:id/files', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get files for this conversation
    const files = db.prepare(`
      SELECT id, file_path, file_name, file_type, upload_time
      FROM pdf_files
      WHERE conversation_id = ?
      ORDER BY upload_time ASC
    `).all(conversationId);
    
    // Format the response
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.file_name,
      type: file.file_type,
      uploadTime: file.upload_time
    }));
    
    res.status(200).json({ files: formattedFiles });
  } catch (error) {
    console.error('Error fetching conversation files:', error);
    res.status(500).json({ error: 'Failed to fetch conversation files' });
  }
});

// Update conversation title
router.put('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Update conversation title
    db.prepare(`
      UPDATE conversations
      SET title = ?, updated_at = ?
      WHERE id = ?
    `).run(title, getCurrentISOTimestamp(), conversationId);
    
    res.status(200).json({ 
      message: 'Conversation updated successfully',
      id: conversationId,
      title: title
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Delete a file from a conversation
router.delete('/:id/files/:fileId', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const fileId = req.params.fileId;
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get file info before deleting
    const file = db.prepare(`
      SELECT * FROM pdf_files
      WHERE id = ? AND conversation_id = ?
    `).get(fileId, conversationId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Start a transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Delete file from database
      db.prepare(`
        DELETE FROM pdf_files
        WHERE id = ?
      `).run(fileId);
      
      // Delete message-file associations
      db.prepare(`
        DELETE FROM message_files
        WHERE file_id = ?
      `).run(fileId);
      
      // Update conversation's updated_at timestamp
      db.prepare(`
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
      `).run(getCurrentISOTimestamp(), conversationId);
      
      // Delete the physical file
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Add a message to a conversation
router.post('/:id/messages', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { role, content } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Insert message
    const insertMessage = db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `);
    
    const result = insertMessage.run(conversationId, role, content);
    
    // Update conversation's updated_at timestamp with current ISO timestamp
    const currentTime = getCurrentISOTimestamp();
    db.prepare(`
      UPDATE conversations
      SET updated_at = ?
      WHERE id = ?
    `).run(currentTime, conversationId);
    
    res.status(201).json({
      message: 'Message added successfully',
      messageId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a conversation
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Delete conversation (messages will be deleted via ON DELETE CASCADE)
    db.prepare(`
      DELETE FROM conversations
      WHERE id = ?
    `).run(conversationId);
    
    res.status(200).json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
