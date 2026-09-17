const db = require('../config/db');

const User = {
  async create({ username, email, accountType, studentNumber, staffNumber, passwordHash }) {
    const query = `
      INSERT INTO users (username, email, account_type, student_number, staff_number, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, account_type, student_number, staff_number, created_at;
    `;
    const { rows } = await db.query(query, [username, email, accountType, studentNumber, staffNumber, passwordHash]);
    return rows[0];
  },

  async findByCredential({ accountType, identifier }) {
    const column = accountType === 'staff' ? 'staff_number' : 'student_number';
    const query = `SELECT * FROM users WHERE account_type = $1 AND ${column} = $2;`;
    const { rows } = await db.query(query, [accountType, identifier]);
    return rows[0];
  },

  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1;';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  },

  async findById(id) {
    const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1;';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  },
};

module.exports = User;
