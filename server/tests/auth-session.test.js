const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../controllers/auth.controller');
const User = require('../models/user.model');

function buildRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.statusCode = this.statusCode || 200;
      this.payload = value;
      return this;
    },
  };
}

test('session returns safe database-backed user identity', async () => {
  const original = User.findById;
  User.findById = async () => ({
    id: 'student-1',
    username: 'Campus User',
    email: 'student@tut4life.ac.za',
    account_type: 'student',
    student_number: '12345',
    staff_number: null,
    password_hash: 'must-not-leak',
  });

  try {
    const res = buildRes();
    await authController.getSession({ user: { id: 'student-1' } }, res, (error) => {
      throw error;
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      id: 'student-1',
      username: 'Campus User',
      email: 'student@tut4life.ac.za',
      account_type: 'student',
      identifier: '12345',
    });
    assert.equal('password_hash' in res.payload, false);
  } finally {
    User.findById = original;
  }
});

test('session rejects a deleted account', async () => {
  const original = User.findById;
  User.findById = async () => undefined;

  try {
    const res = buildRes();
    await authController.getSession({ user: { id: 'deleted-user' } }, res, (error) => {
      throw error;
    });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: 'Session account no longer exists' });
  } finally {
    User.findById = original;
  }
});
