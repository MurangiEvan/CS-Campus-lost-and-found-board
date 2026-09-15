const db = require('../config/db');

const Item = {
  async create({ title, description, category, location, dateEvent, userId, imageUrl }) {
    const query = `
      INSERT INTO items (title, description, category, location, date_event, user_id, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [title, description, category, location, dateEvent, userId, imageUrl]);
    return rows[0];
  },

  async findAll({ category, search }) {
    let query = 'SELECT * FROM items WHERE status = \'active\'';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND (title ILIKE $${paramCount++} OR description ILIKE $${paramCount++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC;';
    const { rows } = await db.query(query, params);
    return rows;
  },

  async findById(id) {
    const query = 'SELECT * FROM items WHERE id = $1;';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },

  async update(id, updates, userId) {
    const fields = [];
    const params = [userId];
    let paramCount = 2;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramCount++}`);
      params.push(value);
    }

    const query = `
      UPDATE items
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    // Note: paramCount for id and userId. The query above uses $1 for id, but I passed userId first.
    // Let's fix the param order.
    return this._updateFixed(id, updates, userId);
  },

  async _updateFixed(id, updates, userId) {
    const fields = [];
    const params = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramCount++}`);
      params.push(value);
    }

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

  async markAsResolved(id, userId) {
    const query = "UPDATE items SET status = 'resolved', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *;";
    const { rows } = await db.query(query, [id, userId]);
    return rows[0];
  }
};

module.exports = Item;
