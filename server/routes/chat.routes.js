const express = require('express');
const chatController = require('../controllers/chat.controller');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all chat routes
router.use(authenticateUser);

/**
 * @route   POST /api/chat
 * @desc    Process chat message and get response from Claude AI
 * @access  Private
 */
router.post('/', chatController.processChat);

module.exports = router;