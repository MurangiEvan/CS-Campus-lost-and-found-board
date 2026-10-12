const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item.controller');
const { authenticateToken, authorizeStaff, optionalAuthenticate } = require('../middleware/auth.middleware');

router.get('/', optionalAuthenticate, itemController.getAllItems);
router.get('/:id', optionalAuthenticate, itemController.getItemById);
router.get('/:id/resolutions', authenticateToken, itemController.getResolutions);
router.get('/:id/custody-events', authenticateToken, authorizeStaff, itemController.getCustodyEvents);

// Staff-only reassign endpoint
router.patch('/:id/reassign', authenticateToken, authorizeStaff, itemController.reassignItem);

router.post('/', authenticateToken, itemController.createItem);
router.post('/intake', authenticateToken, authorizeStaff, itemController.createIntake);
router.patch('/:id', authenticateToken, itemController.updateItem);
router.delete('/:id', authenticateToken, itemController.deleteItem);
router.patch('/:id/resolve', authenticateToken, itemController.resolveItem);

module.exports = router;
