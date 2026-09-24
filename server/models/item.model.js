const db = require('../config/db');

const Item = {
  async create({ title, description, category, itemCategory = 'other', location, dateEvent, userId, imageUrl }) {
    const query = `
      INSERT INTO items (title, description, category, item_category, location, date_event, user_id, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [title, description, category, itemCategory, location, dateEvent, userId, imageUrl]);
    return rows[0];
  },

  async findAll({ category, itemCategory, search, status = 'active', dateFrom, dateTo, location, includeOwner = false }) {
    let select = 'SELECT items.*';
    if (includeOwner) select += ', users.username AS owner_name, users.email AS owner_email, users.student_number, users.staff_number';
    let query = `${select} FROM items`;
    if (includeOwner) query += ' LEFT JOIN users ON users.id = items.user_id';
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
      // Use stored search_vector if available
      query += ` AND (search_vector @@ plainto_tsquery('simple', $${paramCount++}) OR to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('simple', $${paramCount - 1}))`;
      params.push(search);
    }

    if (status && ['active', 'resolved'].includes(status)) {
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

  async reassign(id, newUserId) {
    const query = 'UPDATE items SET user_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *;';
    const { rows } = await db.query(query, [newUserId, id]);
    return rows[0];
  },

  async findById(id) {
    const query = 'SELECT * FROM items WHERE id = $1;';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async update(id, updates, userId) {
    const allowedFields = ['title', 'description', 'category', 'location', 'date_event', 'image_url', 'item_category'];
    const fields = [];
    const params = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) continue;
      fields.push(`${key} = $${paramCount++}`);
      params.push(value);
    }

    if (!fields.length) return null;

    params.push(id);
    const idParam = `$${paramCount++}`;
    params.push(userId);
    const userIdParam = `$${paramCount++}`;

    const query = `
      UPDATE items
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ${idParam} AND user_id = ${userIdParam}
      RETURNING *;
    `;
    const { rows } = await db.query(query, params);
    return rows[0];
  },

  async delete(id, userId) {
    const query = 'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING id;';
    const { rows } = await db.query(query, [id, userId]);
    return rows[0];
  },

  async markAsResolved(id, userId, accountType = 'student', notes = '') {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const ownership = accountType === 'staff' ? '' : ' AND user_id = $2';
      const params = accountType === 'staff' ? [id] : [id, userId];
      const itemResult = await client.query(`UPDATE items SET status = 'resolved', resolution_notes = $${params.length + 1}, resolved_at = NOW(), resolved_by = $${params.length + 2}, updated_at = NOW() WHERE id = $1${ownership} AND status = 'active' RETURNING *;`, [...params, notes || null, userId]);
      if (!itemResult.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('INSERT INTO resolution_events (item_id, resolved_by, notes) VALUES ($1, $2, $3);', [id, userId, notes || null]);
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
};

module.exports = Item;
