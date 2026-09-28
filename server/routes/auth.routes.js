const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/session', authenticateToken, authController.getSession);
router.get('/preferences', authenticateToken, authController.getPreferences);
router.patch('/preferences', authenticateToken, authController.updatePreferences);

module.exports = router;
