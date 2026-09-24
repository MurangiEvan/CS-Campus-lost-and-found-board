const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken, authorizeStaff } = require('../middleware/auth.middleware');

// Search users (staff only)
router.get('/users', authenticateToken, authorizeStaff, adminController.searchUsers);
router.get('/audit', authenticateToken, authorizeStaff, adminController.listAudit);

module.exports = router;
