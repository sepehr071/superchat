const express = require('express');
const fs = require('fs');
const { db, getCurrentISOTimestamp } = require('./database');
const { authenticateUser } = require('./auth');

const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  // First authenticate user
  authenticateUser(req, res, () => {
    // Then check if user is admin
    const userId = req.user.id;
    const isAdmin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
    
    if (!isAdmin || isAdmin.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  });
};

// Apply admin authentication middleware to all admin routes
router.use(authenticateAdmin);

// Get all users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, created_at,
      (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) as conversation_count
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    // Format the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      conversationCount: user.conversation_count
    }));
    
    res.status(200).json({ users: formattedUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user details
    const user = db.prepare(`
      SELECT id, username, created_at, is_admin,
      (SELECT COUNT(*) FROM conversations WHERE user_id = users.id) as conversation_count
      FROM users
      WHERE id = ?
    `).get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Format the response
    const formattedUser = {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
      isAdmin: user.is_admin === 1,
      conversationCount: user.conversation_count
    };
    
    res.status(200).json({ user: formattedUser });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Get all conversations for a user
router.get('/users/:userId/conversations', (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get conversations for user
    const conversations = db.prepare(`
      SELECT c.id, c.title, c.created_at, c.updated_at, c.type,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
      (SELECT COUNT(*) FROM pdf_files WHERE conversation_id = c.id) as file_count
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);
    
    // Format the response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      messageCount: conv.message_count,
      fileCount: conv.file_count,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      type: conv.type || 'pdf' // Default to 'pdf' for backward compatibility
    }));
    
    res.status(200).json({ 
      conversations: formattedConversations,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({ error: 'Failed to fetch user chats' });
  }
});

// Get conversation details with messages
router.get('/conversations/:chatId', (req, res) => {
  try {
    const chatId = req.params.chatId;
    
    // Get conversation
    const conversation = db.prepare(`
      SELECT c.*, u.username
      FROM conversations c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(chatId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Get files for this conversation
    const files = db.prepare(`
      SELECT id, file_path, file_name, file_type, upload_time
      FROM pdf_files
      WHERE conversation_id = ?
      ORDER BY upload_time ASC
    `).all(chatId);
    
    // Get messages for this conversation
    const messages = db.prepare(`
      SELECT id, role, content, timestamp
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `).all(chatId);
    
    // Format the response
    const formattedConversation = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      type: conversation.type || 'pdf',
      user: {
        id: conversation.user_id,
        username: conversation.username
      },
      files: files.map(file => ({
        id: file.id,
        name: file.file_name,
        type: file.file_type,
        uploadTime: file.upload_time
      })),
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
    
    res.status(200).json({ conversation: formattedConversation });
  } catch (error) {
    console.error('Error fetching chat details:', error);
    res.status(500).json({ error: 'Failed to fetch chat details' });
  }
});

// Delete a conversation as admin
router.delete('/conversations/:chatId', (req, res) => {
  try {
    const chatId = req.params.chatId;
    
    // Verify conversation exists
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(chatId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Get files to delete physical files
    const files = db.prepare('SELECT file_path FROM pdf_files WHERE conversation_id = ?').all(chatId);
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Delete conversation (messages and files will be deleted via ON DELETE CASCADE)
      db.prepare('DELETE FROM conversations WHERE id = ?').run(chatId);
      
      // Delete physical files
      files.forEach(file => {
        if (file.file_path && fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      });
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({ message: 'Chat deleted successfully' });
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Delete a user
router.delete('/users/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Don't allow admins to delete themselves
    if (userId == req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    
    // Verify user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get files to delete physical files
    const files = db.prepare(`
      SELECT pf.file_path
      FROM pdf_files pf
      JOIN conversations c ON pf.conversation_id = c.id
      WHERE c.user_id = ?
    `).all(userId);
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Delete user (conversations, messages, and files will be deleted via ON DELETE CASCADE)
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      
      // Delete physical files
      files.forEach(file => {
        if (file.file_path && fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      });
      
      // Commit transaction
      db.exec('COMMIT');
      
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get system stats
router.get('/stats', (req, res) => {
  try {
    // Get total counts
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalConversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const totalFiles = db.prepare('SELECT COUNT(*) as count FROM pdf_files').get().count;
    
    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
    
    const newUsers30Days = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE created_at > ?
    `).get(thirtyDaysAgoStr).count;
    
    const newConversations30Days = db.prepare(`
      SELECT COUNT(*) as count FROM conversations
      WHERE created_at > ?
    `).get(thirtyDaysAgoStr).count;
    
    // Calculate storage usage
    let totalStorage = 0;
    const databaseSize = 0; // Would need file system access to get this
    
    // Try to get the size of all files
    const files = db.prepare('SELECT file_path FROM pdf_files').all();
    files.forEach(file => {
      if (file.file_path && fs.existsSync(file.file_path)) {
        try {
          const stats = fs.statSync(file.file_path);
          totalStorage += stats.size;
        } catch (err) {
          console.error('Error getting file size:', err);
        }
      }
    });
    
    res.status(200).json({
      totalUsers,
      totalConversations,
      totalMessages,
      totalFiles,
      newUsers30Days,
      newConversations30Days,
      totalStorage,
      databaseSize
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

module.exports = {
  router,
  authenticateAdmin
};