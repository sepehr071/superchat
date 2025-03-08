const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply admin authentication middleware to all admin routes
router.use(authenticateAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get user details
 * @access  Admin
 */
router.get('/users/:userId', adminController.getUserDetails);

/**
 * @route   GET /api/admin/users/:userId/conversations
 * @desc    Get all conversations for a user
 * @access  Admin
 */
router.get('/users/:userId/conversations', adminController.getUserConversations);

/**
 * @route   GET /api/admin/conversations/:chatId
 * @desc    Get conversation details with messages
 * @access  Admin
 */
router.get('/conversations/:chatId', adminController.getConversationDetails);

/**
 * @route   DELETE /api/admin/conversations/:chatId
 * @desc    Delete a conversation
 * @access  Admin
 */
router.delete('/conversations/:chatId', adminController.deleteConversation);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete a user
 * @access  Admin
 */
router.delete('/users/:userId', adminController.deleteUser);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system stats
 * @access  Admin
 */
router.get('/stats', adminController.getStats);

module.exports = router;