const Item = require('../models/item.model');
const objectStorage = require('../services/object-storage');

const isStaff = (req) => req.user?.accountType === 'staff';
const publicItem = (item) => {
  if (!item) return item;
  const { storage_location, custodian_user_id, custody_status, resolved_by, resolution_notes, ...visible } = item;
  return visible;
};

const validateItemBody = (body) => {
  const { title, description, category, item_category, location, date_event } = body || {};
  if (!title || !description || !category || !location || !date_event) return 'Missing required fields';
  if (!['lost', 'found'].includes(category)) return 'Category must be either "lost" or "found"';
  if (item_category && !['cards', 'keys', 'phones', 'bags', 'other'].includes(item_category)) return 'Invalid item category';
  if (body.image_url) return 'image_url is server-managed; upload an image before submitting the item';
  if (body.image_upload_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.image_upload_id)) return 'Invalid image upload reference';
  return null;
};

const createItem = async (req, res, next) => {
  try {
    const validationError = validateItemBody(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const { title, description, category, item_category, location, date_event, image_upload_id } = req.body;

    const item = await Item.create({
      title,
      description,
      category,
      itemCategory: item_category || 'other',
      location,
      dateEvent: date_event,
      userId: req.user.id,
      imageUploadId: image_upload_id,
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const createIntake = async (req, res, next) => {
  try {
    const validationError = validateItemBody({ ...req.body, category: 'found' });
    if (validationError) return res.status(400).json({ error: validationError });
    const { title, description, item_category, location, date_event, storage_location, dropped_off_by, image_upload_id } = req.body;
    if (typeof storage_location !== 'string' || !storage_location.trim()) {
      return res.status(400).json({ error: 'Storage location is required for security intake' });
    }
    const item = await Item.create({
      title,
      description,
      category: 'found',
      itemCategory: item_category || 'other',
      location,
      dateEvent: date_event,
      userId: req.user.id,
      imageUploadId: image_upload_id,
      custodyIntake: true,
      storageLocation: storage_location.trim().slice(0, 255),
      droppedOffBy: typeof dropped_off_by === 'string' ? dropped_off_by.trim().slice(0, 100) : '',
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const getAllItems = async (req, res, next) => {
  try {
    const { category, item_category, search, status, date_from, date_to, location } = req.query;

    const validCategories = ['lost', 'found'];
    const validItemCategories = ['cards', 'keys', 'phones', 'bags', 'other'];
    const validStatuses = ['active', 'resolved', 'all'];

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    if (item_category && !validItemCategories.includes(item_category)) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    if (date_from && Number.isNaN(Date.parse(date_from))) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    if (date_to && Number.isNaN(Date.parse(date_to))) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    if (typeof location === 'string' && !location.trim()) {
      return res.status(400).json({ error: 'Invalid item category, status, or date filter' });
    }

    const filters = {
      category,
      itemCategory: item_category,
      search,
      status,
      dateFrom: date_from,
      dateTo: date_to,
      location: location?.trim() || undefined,
    };

    if (req.user && req.user.accountType === 'staff') {
      filters.includeOwner = true;
    }

    const items = await Item.findAll(filters);
    res.json(isStaff(req) ? items : items.map(publicItem));
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
    res.json(isStaff(req) ? item : publicItem(item));
  } catch (error) {
    next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    if (updates.image_url) return res.status(400).json({ error: 'image_url is server-managed; upload an image before updating the item' });
    if (updates.image_upload_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updates.image_upload_id)) {
      return res.status(400).json({ error: 'Invalid image upload reference' });
    }

    const result = await Item.update(id, updates, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    if (result.previousImageUrl && result.previousImageUrl !== result.item.image_url) {
      try { await objectStorage.deleteImageUrl(result.previousImageUrl, req.user.id); } catch { /* Best-effort cleanup after a successful update. */ }
    }
    res.json(result.item);
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
    if (deleted.image_url) {
      try { await objectStorage.deleteImageUrl(deleted.image_url, req.user.id); } catch { /* Best-effort cleanup after a successful delete. */ }
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const resolveItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const accountType = req.user.accountType || 'student';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) : '';
    const verification = req.body?.verification;

    if (accountType === 'staff' && (
      verification?.student_id_verified !== true ||
      verification?.proof_of_ownership_confirmed !== true ||
      verification?.item_condition_noted !== true
    )) {
      return res.status(400).json({ error: 'Complete every collection verification check before release' });
    }

    const resolutionNotes = notes;
    const item = await Item.markAsResolved(id, req.user.id, accountType, resolutionNotes, accountType === 'staff' ? verification : null);
    if (!item) {
      return res.status(403).json({ error: 'Forbidden: you cannot resolve this item' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const getResolutions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!isStaff(req) && item.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
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
    const item = await Item.reassign(id, user_id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const getCustodyEvents = async (req, res, next) => {
  try {
    const events = await Item.getCustodyEvents(req.params.id);
    res.json(events);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createItem,
  createIntake,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  resolveItem,
  getResolutions,
  reassignItem,
  getCustodyEvents,
};
