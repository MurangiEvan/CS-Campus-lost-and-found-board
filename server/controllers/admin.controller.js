const db = require('../config/db');

const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const term = `%${q.trim()}%`;
    const query = `SELECT id, username, email, account_type, student_number, staff_number FROM users WHERE username ILIKE $1 OR email ILIKE $1 OR student_number ILIKE $1 OR staff_number ILIKE $1 LIMIT 20;`;
    const { rows } = await db.query(query, [term]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

const recordAudit = async (userId, action, targetType = null, targetId = null, details = null) => {
  const query = 'INSERT INTO audit_events (user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5);';
  await db.query(query, [userId, action, targetType, targetId, details ? JSON.stringify(details) : null]);
};

module.exports = { searchUsers, recordAudit };

const listAudit = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const query = `SELECT id, user_id, action, target_type, target_id, details, created_at FROM audit_events ORDER BY created_at DESC LIMIT $1;`;
    const { rows } = await db.query(query, [limit]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports.listAudit = listAudit;
