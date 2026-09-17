const Item = require('../models/item.model');

const createItem = async (req, res, next) => {
  try {
    const { title, description, category, location, date_event, image_url } = req.body;

    if (!title || !description || !category || !location || !date_event) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['lost', 'found'].includes(category)) {
      return res.status(400).json({ error: 'Category must be either "lost" or "found"' });
    }

    const item = await Item.create({
      title,
      description,
      category,
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
    const { category, search, status, date_from, date_to } = req.query;
    const items = await Item.findAll({ category, search, status, dateFrom: date_from, dateTo: date_to });
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
    const item = await Item.markAsResolved(id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
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
};
