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

  Item.markAsResolved = async (id, userId, accountType) => {
    callArgs = { id, userId, accountType };
    return { id, status: 'resolved' };
  };

  try {
    const req = {
      params: { id: 'item-456' },
      user: { id: 'staff-1', accountType: 'staff' },
    };
    const res = buildRes();

    await itemController.resolveItem(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(callArgs, { id: 'item-456', userId: 'staff-1', accountType: 'staff' });
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
