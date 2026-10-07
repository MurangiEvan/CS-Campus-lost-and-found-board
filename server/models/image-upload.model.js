const db = require('../config/db');
const objectStorage = require('../services/object-storage');

const ImageUpload = {
  async create({ id, ownerId, key, contentType, size }) {
    const query = `
      INSERT INTO item_image_uploads (id, user_id, object_key, content_type, byte_size, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '5 minutes')
      RETURNING id, expires_at;
    `;
    const { rows } = await db.query(query, [id, ownerId, key, contentType, size]);
    return rows[0];
  },

  async attach(client, uploadId, ownerId) {
    const { rows } = await client.query(
      "SELECT id, object_key, content_type, byte_size FROM item_image_uploads WHERE id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > NOW() FOR UPDATE;",
      [uploadId, ownerId]
    );
    const upload = rows[0];
    if (!upload) {
      const error = new Error('Image upload is missing, expired, or already used');
      error.status = 400;
      throw error;
    }

    let finalized;
    try {
      finalized = await objectStorage.finalizeUploadedObject({
        key: upload.object_key,
        contentType: upload.content_type,
        size: upload.byte_size,
      });
      await client.query("UPDATE item_image_uploads SET status = 'attached', object_key = $2 WHERE id = $1;", [upload.id, finalized.objectKey]);
      return finalized;
    } catch (error) {
      if (finalized?.objectKey) {
        try { await objectStorage.deleteObject(finalized.objectKey); } catch { /* Cleanup is retried by storage lifecycle policy if needed. */ }
      }
      throw error;
    }
  },

  async cancel(uploadId, ownerId) {
    const client = await db.pool.connect();
    let key;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        "SELECT object_key FROM item_image_uploads WHERE id = $1 AND user_id = $2 AND status = 'pending' FOR UPDATE;",
        [uploadId, ownerId]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }
      key = rows[0].object_key;
      await objectStorage.deleteObject(key);
      await client.query("UPDATE item_image_uploads SET status = 'cancelled' WHERE id = $1;", [uploadId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async cleanupExpired(limit = 100) {
    let cleaned = 0;
    const { rows } = await db.query(
      "SELECT id, object_key FROM item_image_uploads WHERE status = 'pending' AND expires_at <= NOW() ORDER BY expires_at LIMIT $1;",
      [Math.min(Math.max(Number(limit) || 100, 1), 500)]
    );
    for (const upload of rows) {
      await objectStorage.deleteObject(upload.object_key);
      await db.query("UPDATE item_image_uploads SET status = 'cancelled' WHERE id = $1 AND status = 'pending';", [upload.id]);
      cleaned += 1;
    }
    return cleaned;
  },
};

module.exports = ImageUpload;