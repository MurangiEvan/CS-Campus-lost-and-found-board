const ImageUpload = require('../models/image-upload.model');
const objectStorage = require('../services/object-storage');

const createUpload = async (req, res, next) => {
  try {
    const { content_type, size } = req.body || {};
    const upload = await objectStorage.createUpload({ contentType: content_type, size, ownerId: req.user.id });
    const saved = await ImageUpload.create({
      id: upload.uploadId,
      ownerId: req.user.id,
      key: upload.key,
      contentType: upload.contentType,
      size: upload.size,
    });
    res.status(201).json({ upload_id: saved.id, expires_at: saved.expires_at, url: upload.uploadUrl, fields: upload.fields });
  } catch (error) {
    if (error.message?.startsWith('Choose a JPEG') || error.message?.startsWith('Image must be no larger')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

const cancelUpload = async (req, res, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid image upload reference' });
    }
    const cancelled = await ImageUpload.cancel(req.params.id, req.user.id);
    if (!cancelled) return res.status(404).json({ error: 'Pending image upload not found' });
    res.json({ message: 'Image upload cancelled' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createUpload, cancelUpload };