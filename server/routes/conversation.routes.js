const express = require('express');
const conversationController = require('../controllers/conversation.controller');

const router = express.Router();

/**
 * @route   POST /api/conversations/create-empty
 * @desc    Create an empty conversation for normal chat
 * @access  Private
 */
router.post('/create-empty', conversationController.createEmpty);

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation with uploaded files
 * @access  Private
 */
router.post('/', conversationController.createWithFiles);

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the current user
 * @access  Private
 */
router.get('/', conversationController.getAllConversations);

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a specific conversation with messages and files
 * @access  Private
 */
router.get('/:id', conversationController.getConversation);

/**
 * @route   GET /api/conversations/:id/files
 * @desc    Get files for a conversation
 * @access  Private
 */
router.get('/:id/files', conversationController.getConversationFiles);

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation title
 * @access  Private
 */
router.put('/:id', conversationController.updateConversation);

/**
 * @route   DELETE /api/conversations/:id/files/:fileId
 * @desc    Delete a file from a conversation
 * @access  Private
 */
router.delete('/:id/files/:fileId', conversationController.deleteFile);

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Add a message to a conversation
 * @access  Private
 */
router.post('/:id/messages', conversationController.addMessage);

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete('/:id', conversationController.deleteConversation);

module.exports = router;