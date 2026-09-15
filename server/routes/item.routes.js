const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/', itemController.getAllItems);
router.get('/:id', itemController.getItemById);

router.post('/', authenticateToken, itemController.createItem);
router.patch('/:id', authenticateToken, itemController.updateItem);
router.delete('/:id', authenticateToken, itemController.deleteItem);
router.patch('/:id/resolve', authenticateToken, itemController.resolveItem);

module.exports = router;
