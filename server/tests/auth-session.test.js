const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../controllers/auth.controller');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

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

test('login issues an HttpOnly cookie without returning the JWT', async () => {
  const originalFind = User.findByLoginIdentifier;
  const originalCompare = bcrypt.compare;
  User.findByLoginIdentifier = async (identifier) => {
    assert.equal(identifier, '12345');
    return ({
    id: 'student-1',
    username: 'Campus User',
    email: 'student@tut4life.ac.za',
    account_type: 'student',
    student_number: '12345',
    password_hash: 'hash',
    });
  };
  bcrypt.compare = async () => true;
  try {
    const res = buildRes();
    res.cookie = (name, value, options) => { res.cookieValue = { name, value, options }; };
    await authController.login({ body: { account_type: 'staff', identifier: '12345', password: 'correct-password' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.cookieValue.name, 'campuslink_session');
    assert.equal(res.cookieValue.options.httpOnly, true);
    assert.equal(typeof res.cookieValue.value, 'string');
    assert.equal('token' in res.payload, false);
    assert.equal(res.payload.user.id, 'student-1');
  } finally {
    User.findByLoginIdentifier = originalFind;
    bcrypt.compare = originalCompare;
  }
});

test('registration stores student and Security choices in the existing account_type field', async () => {
  const originalFindEmail = User.findByEmail;
  const originalFindIdentifier = User.findByCampusIdentifier;
  const originalCreate = User.create;
  const originalHash = bcrypt.hash;
  const created = [];
  User.findByEmail = async () => null;
  User.findByCampusIdentifier = async () => null;
  User.create = async (user) => {
    created.push(user);
    return { id: `user-${created.length}`, username: user.username, email: user.email, account_type: user.accountType };
  };
  bcrypt.hash = async (password, rounds) => `bcrypt:${rounds}:${password}`;
  try {
    for (const accountType of ['student', 'staff']) {
      const identifier = accountType === 'student' ? '12345' : 'SEC-001';
      const res = buildRes();
      await authController.register({ body: {
        username: 'Campus User',
        email: `${identifier.toLowerCase()}@tut4life.ac.za`,
        password: 'safe-password',
        confirm_password: 'safe-password',
        account_type: accountType,
        ...(accountType === 'student' ? { student_number: identifier } : { staff_number: identifier }),
      } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 201);
    }

    assert.deepEqual(created.map((user) => user.accountType), ['student', 'staff']);
    assert.equal(created[0].studentNumber, '12345');
    assert.equal(created[0].staffNumber, null);
    assert.equal(created[1].studentNumber, null);
    assert.equal(created[1].staffNumber, 'SEC-001');
    assert.equal(created[0].passwordHash, 'bcrypt:12:safe-password');
    assert.equal('password' in created[0], false);
  } finally {
    User.findByEmail = originalFindEmail;
    User.findByCampusIdentifier = originalFindIdentifier;
    User.create = originalCreate;
    bcrypt.hash = originalHash;
  }
});

test('registration rejects invalid required fields, email, role, password length, and confirmation', async () => {
  const invalidBodies = [
    { username: '', email: '12345@tut4life.ac.za', password: 'safe-password', confirm_password: 'safe-password', account_type: 'student', student_number: '12345' },
    { username: 'Campus User', email: 'not-an-email', password: 'safe-password', confirm_password: 'safe-password', account_type: 'student', student_number: '12345' },
    { username: 'Campus User', email: '12345@tut4life.ac.za', password: 'short', confirm_password: 'short', account_type: 'student', student_number: '12345' },
    { username: 'Campus User', email: '12345@tut4life.ac.za', password: 'safe-password', confirm_password: 'different-password', account_type: 'student', student_number: '12345' },
    { username: 'Campus User', email: '12345@tut4life.ac.za', password: 'safe-password', confirm_password: 'safe-password', account_type: 'administrator', student_number: '12345' },
    { username: 'Campus User', email: 'other@tut4life.ac.za', password: 'safe-password', confirm_password: 'safe-password', account_type: 'student', student_number: '12345' },
  ];
  const originalFindEmail = User.findByEmail;
  const originalFindIdentifier = User.findByCampusIdentifier;
  User.findByEmail = async () => { throw new Error('invalid input should be rejected before lookup'); };
  User.findByCampusIdentifier = async () => { throw new Error('invalid input should be rejected before lookup'); };
  try {
    for (const body of invalidBodies) {
      const res = buildRes();
      await authController.register({ body }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 400);
      assert.equal(typeof res.payload.error, 'string');
    }
  } finally {
    User.findByEmail = originalFindEmail;
    User.findByCampusIdentifier = originalFindIdentifier;
  }
});

test('registration rejects duplicate email or campus number generically', async () => {
  const originalFindEmail = User.findByEmail;
  const originalFindIdentifier = User.findByCampusIdentifier;
  const cases = [
    [async () => ({ id: 'existing-email' }), async () => null],
    [async () => null, async () => ({ id: 'existing-number' })],
  ];
  try {
    for (const [findEmail, findIdentifier] of cases) {
      User.findByEmail = findEmail;
      User.findByCampusIdentifier = findIdentifier;
      const res = buildRes();
      await authController.register({ body: {
        username: 'Campus User', email: '12345@tut4life.ac.za', password: 'safe-password',
        confirm_password: 'safe-password', account_type: 'student', student_number: '12345',
      } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.equal(res.payload.error, 'Email or campus number is already registered');
    }
  } finally {
    User.findByEmail = originalFindEmail;
    User.findByCampusIdentifier = originalFindIdentifier;
  }
});

test('registration handles a concurrent unique-constraint collision safely', async () => {
  const originalFindEmail = User.findByEmail;
  const originalFindIdentifier = User.findByCampusIdentifier;
  const originalCreate = User.create;
  const originalHash = bcrypt.hash;
  User.findByEmail = async () => null;
  User.findByCampusIdentifier = async () => null;
  User.create = async () => { throw Object.assign(new Error('database constraint detail'), { code: '23505' }); };
  bcrypt.hash = async () => 'hashed-password';
  try {
    const res = buildRes();
    await authController.register({ body: {
      username: 'Campus User', email: '12345@tut4life.ac.za', password: 'safe-password',
      confirm_password: 'safe-password', account_type: 'student', student_number: '12345',
    } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.payload, { error: 'Email or campus number is already registered' });
  } finally {
    User.findByEmail = originalFindEmail;
    User.findByCampusIdentifier = originalFindIdentifier;
    User.create = originalCreate;
    bcrypt.hash = originalHash;
  }
});

test('login accepts email or campus number and ignores a client-selected role', async () => {
  const originalFind = User.findByLoginIdentifier;
  const originalCompare = bcrypt.compare;
  const received = [];
  User.findByLoginIdentifier = async (identifier) => {
    received.push(identifier);
    return identifier === 'student@tut4life.ac.za'
      ? { id: 'student-1', username: 'Campus Student', email: identifier, account_type: 'student', student_number: '12345', password_hash: 'hash' }
      : { id: 'security-1', username: 'Campus Security', email: 'security@tut4life.ac.za', account_type: 'staff', staff_number: 'SEC-001', password_hash: 'hash' };
  };
  bcrypt.compare = async () => true;
  try {
    for (const [identifier, requestedAccountType, expectedAccountType] of [
      ['student@tut4life.ac.za', 'staff', 'student'],
      ['SEC-001', 'student', 'staff'],
    ]) {
      const res = buildRes();
      res.cookie = () => {};
      await authController.login({ body: { identifier, password: 'safe-password', account_type: requestedAccountType } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.user.account_type, expectedAccountType);
    }
    assert.deepEqual(received, ['student@tut4life.ac.za', 'SEC-001']);
  } finally {
    User.findByLoginIdentifier = originalFind;
    bcrypt.compare = originalCompare;
  }
});

test('login uses the same generic error for unknown accounts and wrong passwords', async () => {
  const originalFind = User.findByLoginIdentifier;
  const originalCompare = bcrypt.compare;
  User.findByLoginIdentifier = async (identifier) => identifier === 'unknown@tut4life.ac.za' ? null : ({
    id: 'student-1', username: 'Campus User', email: '12345@tut4life.ac.za',
    account_type: 'student', student_number: '12345', password_hash: 'hash',
  });
  bcrypt.compare = async () => false;
  try {
    for (const identifier of ['unknown@tut4life.ac.za', '12345']) {
      const res = buildRes();
      await authController.login({ body: { identifier, password: 'wrong-password' } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.payload, { error: 'Invalid email or password' });
    }
  } finally {
    User.findByLoginIdentifier = originalFind;
    bcrypt.compare = originalCompare;
  }
});

test('login identifier lookup matches email or either campus number and fails closed on ambiguity', async () => {
  const originalQuery = db.query;
  const statements = [];
  db.query = async (sql, params) => {
    statements.push({ sql, params });
    return { rows: params[0] === 'ambiguous' ? [{ id: 'student-1' }, { id: 'staff-1' }] : [{ id: 'user-1' }] };
  };
  try {
    assert.equal((await User.findByLoginIdentifier('person@tut4life.ac.za')).id, 'user-1');
    assert.equal((await User.findByLoginIdentifier('12345')).id, 'user-1');
    assert.equal(await User.findByLoginIdentifier('ambiguous'), null);
    assert.match(statements[0].sql, /email = LOWER\(\$1\).*student_number.*staff_number/s);
    assert.deepEqual(statements.map(({ params }) => params[0]), ['person@tut4life.ac.za', '12345', 'ambiguous']);
  } finally {
    db.query = originalQuery;
  }
});
