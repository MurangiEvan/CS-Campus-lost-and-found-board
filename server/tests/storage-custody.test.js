const test = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../services/object-storage');
const ImageUpload = require('../models/image-upload.model');
const Item = require('../models/item.model');
const db = require('../config/db');
const itemController = require('../controllers/item.controller');
const uploadController = require('../controllers/upload.controller');

const storageEnv = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL', 'IMAGE_UPLOAD_MAX_BYTES', 'NODE_ENV'];
const originalEnv = Object.fromEntries(storageEnv.map((key) => [key, process.env[key]]));

test.before(() => {
  process.env.S3_BUCKET = 'test-bucket';
  process.env.S3_ACCESS_KEY_ID = 'test-access';
  process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
  process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.test/campus/';
  process.env.IMAGE_UPLOAD_MAX_BYTES = '4096';
  process.env.NODE_ENV = 'test';
});

test.after(() => {
  for (const key of storageEnv) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('upload validation rejects unsupported, empty, and oversized images', () => {
  assert.throws(() => storage.validateUpload({ contentType: 'image/svg+xml', size: 100 }), /JPEG, PNG, or WebP/);
  assert.throws(() => storage.validateUpload({ contentType: 'image/jpeg', size: 0 }), /no larger than/);
  assert.throws(() => storage.validateUpload({ contentType: 'image/jpeg', size: 4097 }), /no larger than/);
  assert.equal(storage.validateUpload({ contentType: 'image/webp', size: 1024 }).extension, 'webp');
});

test('presign reports a safe actionable error when object storage is not configured', async () => {
  const originalCreateUpload = storage.createUpload;
  let statusCode;
  let payload;
  storage.createUpload = async () => { throw new Error('Object storage is not configured'); };
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
  };

  try {
    await uploadController.createUpload({ body: {}, user: { id: 'user-id' } }, response, (error) => { throw error; });
    assert.equal(statusCode, 503);
    assert.deepEqual(payload, {
      error: 'Photo uploads are unavailable. Remove the photo or contact campus support.',
    });
  } finally {
    storage.createUpload = originalCreateUpload;
  }
});

test('image cleanup accepts only URLs under the configured public bucket prefix', () => {
  assert.equal(storage.keyFromPublicUrl('https://cdn.example.test/campus/items/user/photo.jpg'), 'items/user/photo.jpg');
  assert.equal(storage.keyFromPublicUrl('https://attacker.example.test/campus/items/user/photo.jpg'), null);
  assert.equal(storage.keyFromPublicUrl('https://cdn.example.test/other/items/user/photo.jpg'), null);
});

test('managed object cleanup accepts only generated staging and item keys', () => {
  assert.equal(storage.isManagedObjectKey('staging/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'), true);
  assert.equal(storage.isManagedObjectKey('items/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp'), true);
  assert.equal(storage.isManagedObjectKey('items/other-user/photo.jpg'), false);
  assert.equal(storage.isManagedObjectKey('staging/../../outside.jpg'), false);
});

test('staff item search joins the assigned custodian and applies substring location filtering', async () => {
  const originalQuery = db.query;
  let statement;
  let parameters;
  db.query = async (sql, params) => {
    statement = sql;
    parameters = params;
    return { rows: [] };
  };
  try {
    await Item.findAll({ location: 'Library', includeOwner: true, status: 'all' });
    assert.match(statement, /custodian\.username AS custodian_name/);
    assert.match(statement, /LEFT JOIN users AS custodian ON custodian\.id = items\.custodian_user_id/);
    assert.match(statement, /location ILIKE \$1/);
    assert.deepEqual(parameters, ['%Library%']);
  } finally {
    db.query = originalQuery;
  }
});

test('image verification checks JPEG, PNG, and WebP file signatures', () => {
  assert.equal(storage.hasSupportedImageSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(storage.hasSupportedImageSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(storage.hasSupportedImageSignature('image/webp', Buffer.from('RIFF1234WEBP', 'ascii')), true);
  assert.equal(storage.hasSupportedImageSignature('image/jpeg', Buffer.from('not an image')), false);
});

test('public item responses omit custody and resolution internals', async () => {
  const original = Item.findById;
  Item.findById = async () => ({
    id: 'item-1',
    title: 'Keys',
    storage_location: 'locked cabinet 4',
    custodian_user_id: 'staff-1',
    custody_status: 'in_custody',
    resolved_by: 'staff-2',
    resolution_notes: 'Private handover note',
  });
  const res = buildRes();
  try {
    await itemController.getItemById({ params: { id: 'item-1' }, user: null }, res, (error) => { throw error; });
    assert.deepEqual(res.payload, { id: 'item-1', title: 'Keys' });
  } finally {
    Item.findById = original;
  }
});

test('student cannot read another user’s resolution notes', async () => {
  const originalFindById = Item.findById;
  const originalGetResolutions = Item.getResolutions;
  Item.findById = async () => ({ id: 'item-1', user_id: 'owner-1' });
  Item.getResolutions = async () => { throw new Error('private history must not be queried'); };
  const res = buildRes();
  try {
    await itemController.getResolutions({ params: { id: 'item-1' }, user: { id: 'other-student', accountType: 'student' } }, res, () => { throw new Error('next should not be called'); });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'Forbidden' });
  } finally {
    Item.findById = originalFindById;
    Item.getResolutions = originalGetResolutions;
  }
});

test('security intake creates custody item through atomic item model options', async () => {
  const originalCreate = Item.create;
  let received;
  Item.create = async (options) => { received = options; return { id: 'item-1', custody_status: 'in_custody' }; };
  const res = buildRes();
  try {
    await itemController.createIntake({
      body: { title: 'Wallet', description: 'Brown wallet', item_category: 'cards', location: 'Library', date_event: '2026-10-07', storage_location: 'Cabinet 2' },
      user: { id: 'staff-1', accountType: 'staff' },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.equal(received.category, 'found');
    assert.equal(received.custodyIntake, true);
    assert.equal(received.storageLocation, 'Cabinet 2');
  } finally {
    Item.create = originalCreate;
  }
});

test('custody reassignment updates the custodian and records event/audit atomically', async () => {
  const originalConnect = db.pool.connect;
  const calls = [];
  db.pool.connect = async () => ({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id, custodian_user_id')) return { rows: [{ id: 'item-1', custodian_user_id: 'staff-1' }] };
      if (sql.startsWith('SELECT id FROM users')) return { rows: [{ id: 'staff-2' }] };
      if (sql.startsWith('UPDATE items')) return { rows: [{ id: 'item-1', custodian_user_id: 'staff-2' }] };
      return { rows: [] };
    },
    release() {},
  });
  try {
    const item = await Item.reassign('item-1', 'staff-2', 'staff-1');
    assert.equal(item.custodian_user_id, 'staff-2');
    assert.ok(calls.some(({ sql, params }) => sql.includes('custody_events') && JSON.parse(params[2]).from_user_id === 'staff-1'));
    assert.ok(calls.some(({ sql }) => sql.includes('audit_events')));
    assert.ok(calls.some(({ sql }) => sql === 'COMMIT'));
    assert.ok(!calls.some(({ sql }) => sql === 'ROLLBACK'));
  } finally {
    db.pool.connect = originalConnect;
  }
});

test('custody reassignment rejects a non-staff destination and rolls back', async () => {
  const originalConnect = db.pool.connect;
  const calls = [];
  db.pool.connect = async () => ({
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT id, custodian_user_id')) return { rows: [{ id: 'item-1', custodian_user_id: 'staff-1' }] };
      if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  });
  try {
    await assert.rejects(Item.reassign('item-1', 'student-1', 'staff-1'), (error) => error.status === 400);
    assert.ok(calls.includes('ROLLBACK'));
    assert.ok(!calls.some((sql) => sql.startsWith('UPDATE items')));
  } finally {
    db.pool.connect = originalConnect;
  }
});

test('image upload attachment is tied to its owner and verified before consumption', async () => {
  const originalFinalize = storage.finalizeUploadedObject;
  const statements = [];
  storage.finalizeUploadedObject = async ({ key, contentType, size }) => {
    assert.equal(key, 'staging/user-1/photo.jpg');
    assert.equal(contentType, 'image/jpeg');
    assert.equal(size, 500);
    return { imageUrl: 'https://cdn.example.test/campus/items/user-1/photo.jpg', objectKey: 'items/user-1/photo.jpg' };
  };
  const client = {
    async query(sql, params) {
      statements.push({ sql, params });
      return sql.startsWith('SELECT') ? { rows: [{ id: 'upload-1', object_key: 'staging/user-1/photo.jpg', content_type: 'image/jpeg', byte_size: 500 }] } : { rows: [] };
    },
  };
  try {
    const attached = await ImageUpload.attach(client, 'upload-1', 'user-1');
    assert.equal(attached.imageUrl, 'https://cdn.example.test/campus/items/user-1/photo.jpg');
    assert.equal(attached.objectKey, 'items/user-1/photo.jpg');
    assert.match(statements[0].sql, /user_id = \$2/);
    assert.match(statements[1].sql, /status = 'attached'/);
  } finally {
    storage.finalizeUploadedObject = originalFinalize;
  }
});

test('staff release records custody and audit events in the item transaction', async () => {
  const originalConnect = db.pool.connect;
  const calls = [];
  db.pool.connect = async () => ({
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('UPDATE items')) return { rows: [{ id: 'item-1', status: 'resolved', custody_status: 'released' }] };
      return { rows: [] };
    },
    release() {},
  });
  const verification = { student_id_verified: true, proof_of_ownership_confirmed: true, item_condition_noted: true };
  try {
    const resolved = await Item.markAsResolved('item-1', 'staff-1', 'staff', 'Returned at desk', verification);
    assert.equal(resolved.custody_status, 'released');
    assert.ok(calls.some(({ sql, params }) => sql.includes("'released'" ) && sql.includes('custody_events') && JSON.parse(params[2]).verification.item_condition_noted));
    assert.ok(calls.some(({ sql }) => sql.includes('audit_events')));
    assert.ok(calls.some(({ sql }) => sql === 'COMMIT'));
    assert.ok(!calls.some(({ sql }) => sql === 'ROLLBACK'));
  } finally {
    db.pool.connect = originalConnect;
  }
});

test('custody-event failure rolls back item release', async () => {
  const originalConnect = db.pool.connect;
  const calls = [];
  db.pool.connect = async () => ({
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('UPDATE items')) return { rows: [{ id: 'item-1' }] };
      if (sql.includes('custody_events')) throw new Error('simulated custody event failure');
      return { rows: [] };
    },
    release() {},
  });
  try {
    await assert.rejects(Item.markAsResolved('item-1', 'staff-1', 'staff', '', {
      student_id_verified: true,
      proof_of_ownership_confirmed: true,
      item_condition_noted: true,
    }), /simulated custody event failure/);
    assert.ok(calls.includes('ROLLBACK'));
    assert.ok(!calls.includes('COMMIT'));
  } finally {
    db.pool.connect = originalConnect;
  }
});

function buildRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.statusCode = this.statusCode || 200; this.payload = value; return this; },
  };
}