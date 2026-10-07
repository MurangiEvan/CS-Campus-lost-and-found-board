const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();
router.post('/presign', authenticateToken, uploadController.createUpload);
router.delete('/:id', authenticateToken, uploadController.cancelUpload);

module.exports = router;