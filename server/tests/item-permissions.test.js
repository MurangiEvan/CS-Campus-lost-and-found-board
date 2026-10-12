const test = require('node:test');
const assert = require('node:assert/strict');

const itemController = require('../controllers/item.controller');
const Item = require('../models/item.model');

const buildRes = () => {
  const res = {
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

  return res;
};

test('staff can resolve another user\'s active item', async () => {
  const original = Item.markAsResolved;
  let callArgs = null;
  let passedNotes = "";
  let passedVerification = null;

  Item.markAsResolved = async (id, userId, accountType, notes, verification) => {
    callArgs = { id, userId, accountType };
    passedNotes = notes;
    passedVerification = verification;
    return { id, status: 'resolved' };
  };

  try {
    const req = {
      params: { id: 'item-456' },
      user: { id: 'staff-1', accountType: 'staff' },
      body: {
        verification: {
          student_id_verified: true,
          proof_of_ownership_confirmed: true,
          item_condition_noted: true,
        },
      },
    };
    const res = buildRes();

    await itemController.resolveItem(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(callArgs, { id: 'item-456', userId: 'staff-1', accountType: 'staff' });
    assert.equal(passedNotes, '');
    assert.deepEqual(passedVerification, {
      student_id_verified: true,
      proof_of_ownership_confirmed: true,
      item_condition_noted: true,
    });
  } finally {
    Item.markAsResolved = original;
  }
});

test('staff cannot release an item without every collection verification check', async () => {
  const original = Item.markAsResolved;
  Item.markAsResolved = async () => {
    throw new Error('release should not be attempted');
  };

  try {
    const req = {
      params: { id: 'item-456' },
      user: { id: 'staff-1', accountType: 'staff' },
      body: { verification: { student_id_verified: true } },
    };
    const res = buildRes();

    await itemController.resolveItem(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { error: 'Complete every collection verification check before release' });
  } finally {
    Item.markAsResolved = original;
  }
});

test('student cannot resolve another user\'s item', async () => {
  const original = Item.markAsResolved;
  Item.markAsResolved = async () => null;

  try {
    const req = {
      params: { id: 'item-999' },
      user: { id: 'student-1', accountType: 'student' },
    };
    const res = buildRes();

    await itemController.resolveItem(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'Forbidden: you cannot resolve this item' });
  } finally {
    Item.markAsResolved = original;
  }
});
