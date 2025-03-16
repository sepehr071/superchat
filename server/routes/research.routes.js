const express = require('express');
const router = express.Router();
const researchController = require('../controllers/research.controller');
const { authenticateUser } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Create a new research conversation
router.post('/create', researchController.createResearchConversation);

// Process a research chat message
router.post('/chat', researchController.researchChat);

module.exports = router;