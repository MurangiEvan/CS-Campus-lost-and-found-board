const Item = require('../models/item.model');

const createItem = async (req, res, next) => {
  try {
    const { title, description, category, item_category, location, date_event, image_url } = req.body;

    if (!title || !description || !category || !location || !date_event) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['lost', 'found'].includes(category)) {
      return res.status(400).json({ error: 'Category must be either "lost" or "found"' });
    }

    if (item_category && !['cards', 'keys', 'phones', 'bags', 'other'].includes(item_category)) {
      return res.status(400).json({ error: 'Invalid item category' });
    }

    const item = await Item.create({
      title,
      description,
      category,
      itemCategory: item_category || 'other',
      location,
      dateEvent: date_event,
      userId: req.user.id,
      imageUrl: image_url,
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const getAllItems = async (req, res, next) => {
  try {
    const { category, item_category, search, status, date_from, date_to, location } = req.query;
    // Staff may request all items including ownership details
    const includeOwner = req.user && req.user.accountType === 'staff';
    const items = await Item.findAll({ category, itemCategory: item_category, search, status, dateFrom: date_from, dateTo: date_to, location, includeOwner });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const item = await Item.update(id, updates, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Item.delete(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const resolveItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) : '';
    const item = await Item.markAsResolved(id, req.user.id, req.user.accountType || 'student', notes);
    if (!item) {
      return res.status(403).json({ error: 'Forbidden: you cannot resolve this item' });
    }
    try {
      const { recordAudit } = require('./admin.controller');
      await recordAudit(req.user.id, 'resolve_item', 'item', id, { notes: notes || null });
    } catch (e) {
      // ignore
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const getResolutions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resolutions = await Item.getResolutions(id);
    res.json(resolutions);
  } catch (error) {
    next(error);
  }
};

const reassignItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const item = await Item.reassign(id, user_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    // Record audit
    try {
      const { recordAudit } = require('./admin.controller');
      await recordAudit(req.user.id, 'reassign_item', 'item', id, { new_user: user_id });
    } catch (e) {
      // non-fatal
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  resolveItem,
  getResolutions,
  reassignItem,
};
