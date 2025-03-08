const express = require('express');
const fileController = require('../controllers/file.controller');

const router = express.Router();

/**
 * @route   POST /api/files/upload
 * @desc    Upload files and create a new conversation
 * @access  Private
 */
router.post('/upload', fileController.uploadFiles);

/**
 * @route   POST /api/files/conversations/:id
 * @desc    Add files to an existing conversation
 * @access  Private
 */
router.post('/conversations/:id', fileController.addFilesToConversation);

/**
 * @route   POST /api/files/export-table
 * @desc    Export table to PDF
 * @access  Private
 */
router.post('/export-table', fileController.exportTableToPdf);

module.exports = router;