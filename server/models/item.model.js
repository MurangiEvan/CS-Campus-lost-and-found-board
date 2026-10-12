const db = require('../config/db');
const ImageUpload = require('./image-upload.model');
const objectStorage = require('../services/object-storage');

const Item = {
  async create({ title, description, category, itemCategory = 'other', location, dateEvent, userId, imageUploadId, custodyIntake = false, storageLocation, droppedOffBy = '' }) {
    const client = await db.pool.connect();
    let attachedImage;
    try {
      await client.query('BEGIN');
      attachedImage = imageUploadId ? await ImageUpload.attach(client, imageUploadId, userId) : null;
      const { rows } = await client.query(`
        INSERT INTO items (title, description, category, item_category, location, date_event, user_id, image_url, custody_status, storage_location, custodian_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `, [title, description, category, itemCategory, location, dateEvent, userId, attachedImage?.imageUrl || null,
        custodyIntake ? 'in_custody' : null, custodyIntake ? storageLocation : null, custodyIntake ? userId : null]);
      const item = rows[0];
      if (custodyIntake) {
        await client.query(
          "INSERT INTO custody_events (item_id, actor_id, event_type, details) VALUES ($1, $2, 'intake', $3);",
          [item.id, userId, JSON.stringify({ storage_location: storageLocation, dropped_off_by: droppedOffBy || null })]
        );
        await client.query(
          "INSERT INTO audit_events (user_id, action, target_type, target_id, details) VALUES ($1, 'item_intake', 'item', $2, $3);",
          [userId, item.id, JSON.stringify({ storage_location: storageLocation, dropped_off_by: droppedOffBy || null })]
        );
      }
      await client.query('COMMIT');
      return item;
    } catch (error) {
      await client.query('ROLLBACK');
      if (attachedImage?.objectKey) {
        try { await objectStorage.deleteObject(attachedImage.objectKey); } catch { /* Cleanup is best-effort; see the upload cleanup job. */ }
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async findAll({ category, itemCategory, search, status = 'active', dateFrom, dateTo, location, includeOwner = false }) {
    let select = 'SELECT items.*';
    if (includeOwner) select += ', users.username AS owner_name, users.email AS owner_email, users.student_number, users.staff_number, custodian.username AS custodian_name';
    let query = `${select} FROM items`;
    if (includeOwner) query += ' LEFT JOIN users ON users.id = items.user_id LEFT JOIN users AS custodian ON custodian.id = items.custodian_user_id';
    // start a predictable WHERE clause so subsequent ANDs work
    query += ' WHERE 1 = 1';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (itemCategory) {
      query += ` AND item_category = $${paramCount++}`;
      params.push(itemCategory);
    }

    if (search) {
      query += ` AND search_vector @@ plainto_tsquery('simple', $${paramCount++})`;
      params.push(search);
    }

    if (status && status !== 'all' && ['active', 'resolved'].includes(status)) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (dateFrom) {
      query += ` AND date_event >= $${paramCount++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND date_event <= $${paramCount++}`;
      params.push(dateTo);
    }

    if (location) {
      query += ` AND location ILIKE $${paramCount++}`;
      params.push(`%${location}%`);
    }

    // Optionally include owner contact info when requested by staff
    query += ' ORDER BY created_at DESC;';
    const { rows } = await db.query(query, params);
    return rows;
  },

  async reassign(id, newUserId, actorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: itemRows } = await client.query(
        "SELECT id, custodian_user_id FROM items WHERE id = $1 AND status = 'active' AND custody_status = 'in_custody' FOR UPDATE;",
        [id]
      );
      if (!itemRows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const { rows: userRows } = await client.query("SELECT id FROM users WHERE id = $1 AND account_type = 'staff';", [newUserId]);
      if (!userRows[0]) {
        const error = new Error('Custody can only be reassigned to an active staff account');
        error.status = 400;
        throw error;
      }
      const previousCustodian = itemRows[0].custodian_user_id;
      if (previousCustodian === newUserId) {
        const error = new Error('Item is already assigned to this staff account');
        error.status = 400;
        throw error;
      }
      const { rows } = await client.query(
        'UPDATE items SET custodian_user_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *;',
        [newUserId, id]
      );
      await client.query(
        "INSERT INTO custody_events (item_id, actor_id, event_type, details) VALUES ($1, $2, 'reassigned', $3);",
        [id, actorId, JSON.stringify({ from_user_id: previousCustodian, to_user_id: newUserId })]
      );
      await client.query(
        "INSERT INTO audit_events (user_id, action, target_type, target_id, details) VALUES ($1, 'reassign_custody', 'item', $2, $3);",
        [actorId, id, JSON.stringify({ from_user_id: previousCustodian, to_user_id: newUserId })]
      );
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findById(id) {
    const query = 'SELECT * FROM items WHERE id = $1;';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async update(id, updates, userId) {
    const allowedFields = ['title', 'description', 'category', 'location', 'date_event', 'item_category'];
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) continue;
      fields.push(`${key} = $${params.length + 1}`);
      params.push(value);
    }

    if (!fields.length && !updates.image_upload_id) return null;
    const client = await db.pool.connect();
    let attachedImage;
    try {
      await client.query('BEGIN');
      const { rows: existingRows } = await client.query('SELECT image_url FROM items WHERE id = $1 AND user_id = $2 AND custody_status IS NULL FOR UPDATE;', [id, userId]);
      if (!existingRows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const previousImageUrl = existingRows[0].image_url;
      if (updates.image_upload_id) {
        attachedImage = await ImageUpload.attach(client, updates.image_upload_id, userId);
        fields.push(`image_url = $${params.length + 1}`);
        params.push(attachedImage.imageUrl);
      }
      if (!fields.length) {
        await client.query('ROLLBACK');
        return null;
      }
      fields.push('updated_at = NOW()');
      params.push(id, userId);
      const { rows } = await client.query(
        `UPDATE items SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING *;`,
        params
      );
      await client.query('COMMIT');
      return { item: rows[0], previousImageUrl };
    } catch (error) {
      await client.query('ROLLBACK');
      if (attachedImage?.objectKey) {
        try { await objectStorage.deleteObject(attachedImage.objectKey); } catch { /* Cleanup is best-effort; see the upload cleanup job. */ }
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async delete(id, userId) {
    const query = 'DELETE FROM items WHERE id = $1 AND user_id = $2 AND custody_status IS NULL RETURNING id, image_url;';
    const { rows } = await db.query(query, [id, userId]);
    return rows[0];
  },

  async markAsResolved(id, userId, accountType = 'student', notes = '', verification = null) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const authorization = accountType === 'staff'
        ? " AND custody_status = 'in_custody' AND custodian_user_id = $2"
        : ' AND user_id = $2 AND custody_status IS NULL';
      const itemResult = await client.query(`UPDATE items SET status = 'resolved', resolution_notes = $3, resolved_at = NOW(), resolved_by = $2, custody_status = CASE WHEN custody_status = 'in_custody' THEN 'released' ELSE custody_status END, updated_at = NOW() WHERE id = $1${authorization} AND status = 'active' RETURNING *;`, [id, userId, notes || null]);
      if (!itemResult.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('INSERT INTO resolution_events (item_id, resolved_by, notes) VALUES ($1, $2, $3);', [id, userId, notes || null]);
      if (accountType === 'staff') {
        await client.query(
          "INSERT INTO custody_events (item_id, actor_id, event_type, details) VALUES ($1, $2, 'released', $3);",
          [id, userId, JSON.stringify({ verification, notes: notes || null })]
        );
        await client.query(
          "INSERT INTO audit_events (user_id, action, target_type, target_id, details) VALUES ($1, 'release_item', 'item', $2, $3);",
          [userId, id, JSON.stringify({ verification, notes: notes || null })]
        );
      }
      await client.query('COMMIT');
      return itemResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  ,

  async getResolutions(itemId) {
    const query = 'SELECT id, item_id, resolved_by, notes, created_at FROM resolution_events WHERE item_id = $1 ORDER BY created_at DESC;';
    const { rows } = await db.query(query, [itemId]);
    return rows;
  },

  async getCustodyEvents(itemId) {
    const { rows } = await db.query(
      `SELECT events.id, events.item_id, events.actor_id, actor_user.username AS actor_name,
        events.event_type, events.details, events.created_at,
        from_user.username AS from_user_name, to_user.username AS to_user_name
       FROM custody_events AS events
       JOIN users AS actor_user ON actor_user.id = events.actor_id
       LEFT JOIN users AS from_user ON from_user.id = NULLIF(events.details->>'from_user_id', '')::uuid
       LEFT JOIN users AS to_user ON to_user.id = NULLIF(events.details->>'to_user_id', '')::uuid
       WHERE events.item_id = $1 ORDER BY events.created_at DESC;`,
      [itemId]
    );
    return rows;
  },
};

module.exports = Item;
