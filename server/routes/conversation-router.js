/**
 * Conversation Router Module
 * Handles conversation management operations
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../auth');
const { db, getCurrentISOTimestamp } = require('../database');

/**
 * Create a new empty conversation
 * @route POST /api/conversations/create-empty
 */
router.post('/create-empty', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    const { title = "New Chat", type = "normal" } = req.body;
    
    // Validate the conversation type
    const validTypes = ['normal', 'pdf'];
    const convType = validTypes.includes(type) ? type : 'normal';
    
    const insertConversation = db.prepare(`
      INSERT INTO conversations (user_id, title, type)
      VALUES (?, ?, ?)
    `);
    
    const result = insertConversation.run(userId, title, convType);
    const conversationId = result.lastInsertRowid;
    
    console.log(`Created empty conversation with ID: ${conversationId} for user: ${userId} with type: ${convType}`);
    
    res.status(201).json({
      message: 'Empty conversation created successfully',
      conversationId: conversationId,
      type: convType,
      title: title
    });
  } catch (error) {
    console.error('Error creating empty conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * Get all conversations for the current user
 * @route GET /api/conversations
 */
router.get('/', authenticateUser, (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = db.prepare(`
      SELECT id, title, created_at, updated_at, type
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(userId);
    
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Get a specific conversation by ID
 * @route GET /api/conversations/:id
 */
router.get('/:id', authenticateUser, (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT id, title, created_at, updated_at, type
      FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get messages for this conversation
    const messages = db.prepare(`
      SELECT id, role, content, timestamp
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(conversationId);
    
    // Get files for this conversation
    const files = db.prepare(`
      SELECT id, file_path, file_name, file_type, upload_time
      FROM pdf_files
      WHERE conversation_id = ?
    `).all(conversationId);
    
    // Format response to match what client expects
    const response = {
      conversation: {
        ...conversation,
        messages,
        files
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * Update a conversation title
 * @route PUT /api/conversations/:id
 */
router.put('/:id', authenticateUser, (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
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
    const currentTime = getCurrentISOTimestamp();
    db.prepare(`
      UPDATE conversations
      SET title = ?, updated_at = ?
      WHERE id = ?
    `).run(title, currentTime, conversationId);
    
    res.status(200).json({
      message: 'Conversation updated successfully',
      conversationId: conversationId,
      title: title
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * Delete a conversation
 * @route DELETE /api/conversations/:id
 */
router.delete('/:id', authenticateUser, (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    // Verify conversation belongs to user
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Begin transaction for deletion
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Delete the conversation (cascade will delete messages and file references)
      db.prepare(`
        DELETE FROM conversations
        WHERE id = ?
      `).run(conversationId);
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({
        message: 'Conversation deleted successfully',
        conversationId: conversationId
      });
    } catch (error) {
      // Rollback transaction on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;