const test = require('node:test');
const assert = require('node:assert/strict');

const itemController = require('../controllers/item.controller');
const Item = require('../models/item.model');

const buildRes = () => ({
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
});

test('rejects an unsupported item taxonomy', async () => {
  const res = buildRes();
  await itemController.createItem({
    body: {
      title: 'Wallet',
      description: 'Brown leather wallet',
      category: 'lost',
      item_category: 'laptops',
      location: 'Library',
      date_event: '2026-09-21',
    },
    user: { id: 'student-1' },
  }, res, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { error: 'Invalid item category' });
});

test('passes search and filter parameters to the item model', async () => {
  const original = Item.findAll;
  let received;
  Item.findAll = async (filters) => {
    received = filters;
    return [];
  };

  try {
    const res = buildRes();
    await itemController.getAllItems({
      query: {
        category: 'lost',
        item_category: 'phones',
        search: 'black phone',
        status: 'active',
        date_from: '2026-09-01',
        date_to: '2026-09-21',
        location: 'Library',
      },
    }, res, () => {
      throw new Error('next should not be called');
    });

    assert.deepEqual(received, {
      category: 'lost',
      itemCategory: 'phones',
      search: 'black phone',
      status: 'active',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-21',
      location: 'Library',
    });
    assert.deepEqual(res.payload, []);
  } finally {
    Item.findAll = original;
  }
});

test('returns resolution events for an item', async () => {
  const original = Item.getResolutions;
  let receivedId = null;
  Item.getResolutions = async (itemId) => {
    receivedId = itemId;
    return [ { id: 'res-1', item_id: itemId, resolved_by: 'staff-1', notes: 'Test', created_at: '2026-09-22T00:00:00Z' } ];
  };

  try {
    const res = buildRes();
    await itemController.getResolutions({ params: { id: 'item-123' }, user: { id: 'staff-1' } }, res, () => { throw new Error('next should not be called'); });
    assert.equal(receivedId, 'item-123');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, [ { id: 'res-1', item_id: 'item-123', resolved_by: 'staff-1', notes: 'Test', created_at: '2026-09-22T00:00:00Z' } ]);
  } finally {
    Item.getResolutions = original;
  }
});
