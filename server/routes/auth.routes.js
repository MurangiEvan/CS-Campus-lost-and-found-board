const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/preferences', authenticateToken, authController.getPreferences);
router.patch('/preferences', authenticateToken, authController.updatePreferences);

module.exports = router;
