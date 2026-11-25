const test = require('node:test');
const assert = require('node:assert/strict');
const { S3Client } = require('@aws-sdk/client-s3');

const storage = require('../services/object-storage');
const Item = require('../models/item.model');
const db = require('../config/db');
const itemController = require('../controllers/item.controller');
const { startUploadCleanup } = require('../jobs/upload-cleanup-scheduler');

const storageEnv = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL', 'IMAGE_UPLOAD_MAX_BYTES', 'NODE_ENV'];
const originalEnv = Object.fromEntries(storageEnv.map((key) => [key, process.env[key]]));
const ownerId = '11111111-1111-4111-8111-111111111111';
const uploadUuid = '22222222-2222-4222-8222-222222222222';

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

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('finalized item photos are stored with an immutable long-lived cache header', async () => {
  const originalSend = S3Client.prototype.send;
  const sent = [];
  S3Client.prototype.send = async function send(command) {
    const name = command.constructor.name;
    sent.push({ name, input: command.input });
    if (name === 'HeadObjectCommand') return { ContentType: 'image/jpeg', ContentLength: 500 };
    if (name === 'GetObjectCommand') {
      return { Body: { transformToByteArray: async () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]) } };
    }
    return {};
  };
  try {
    const result = await storage.finalizeUploadedObject({ key: `staging/${ownerId}/${uploadUuid}.jpg`, contentType: 'image/jpeg', size: 500 });
    const copy = sent.find((entry) => entry.name === 'CopyObjectCommand');
    assert.equal(copy.input.CacheControl, 'public, max-age=31536000, immutable');
    assert.equal(copy.input.MetadataDirective, 'REPLACE');
    assert.match(result.objectKey, new RegExp(`^items/${ownerId}/[0-9a-f-]{36}\\.jpg$`));
    assert.ok(sent.some((entry) => entry.name === 'DeleteObjectCommand' && entry.input.Key.startsWith('staging/')));
  } finally {
    S3Client.prototype.send = originalSend;
  }
});

test('owner can remove a photo; the old object is deleted after commit', async () => {
  const originalConnect = db.pool.connect;
  const originalDeleteImageUrl = storage.deleteImageUrl;
  const statements = [];
  const deleted = [];
  const previousUrl = `https://cdn.example.test/campus/items/${ownerId}/${uploadUuid}.jpg`;
  db.pool.connect = async () => ({
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.startsWith('SELECT image_url')) return { rows: [{ image_url: previousUrl }] };
      if (sql.startsWith('UPDATE items')) return { rows: [{ id: 'item-1', image_url: null }] };
      return { rows: [] };
    },
    release() {},
  });
  storage.deleteImageUrl = async (url, userId) => { deleted.push({ url, userId }); return true; };
  try {
    const res = mockResponse();
    await itemController.updateItem({ params: { id: 'item-1' }, body: { remove_image: true }, user: { id: ownerId, account_type: 'student' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.image_url, null);
    const update = statements.find((entry) => entry.sql.startsWith('UPDATE items'));
    assert.match(update.sql, /image_url = NULL/);
    assert.match(update.sql, /user_id = \$\d+/);
    assert.ok(statements.some((entry) => entry.sql === 'COMMIT'));
    assert.deepEqual(deleted, [{ url: previousUrl, userId: ownerId }]);
  } finally {
    db.pool.connect = originalConnect;
    storage.deleteImageUrl = originalDeleteImageUrl;
  }
});

test('photo removal is rejected for non-owners and custody items (no row is locked)', async () => {
  const originalConnect = db.pool.connect;
  const statements = [];
  db.pool.connect = async () => ({
    async query(sql, params) {
      statements.push({ sql, params });
      return { rows: [] };
    },
    release() {},
  });
  try {
    const res = mockResponse();
    await itemController.updateItem({ params: { id: 'item-1' }, body: { remove_image: true }, user: { id: 'someone-else', account_type: 'student' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 404);
    const lookup = statements.find((entry) => entry.sql.startsWith('SELECT image_url'));
    assert.match(lookup.sql, /custody_status IS NULL/);
    assert.deepEqual(lookup.params, ['item-1', 'someone-else']);
    assert.ok(!statements.some((entry) => entry.sql.startsWith('UPDATE items')));
  } finally {
    db.pool.connect = originalConnect;
  }
});

test('photo update rejects ambiguous or malformed remove_image requests', async () => {
  const originalUpdate = Item.update;
  Item.update = async () => { throw new Error('should not be called'); };
  try {
    const both = mockResponse();
    await itemController.updateItem({ params: { id: 'item-1' }, body: { remove_image: true, image_upload_id: uploadUuid }, user: { id: ownerId } }, both, (error) => { throw error; });
    assert.equal(both.statusCode, 400);
    assert.match(both.body.error, /either remove_image or image_upload_id/);

    const notBoolean = mockResponse();
    await itemController.updateItem({ params: { id: 'item-1' }, body: { remove_image: 'yes' }, user: { id: ownerId } }, notBoolean, (error) => { throw error; });
    assert.equal(notBoolean.statusCode, 400);
  } finally {
    Item.update = originalUpdate;
  }
});

test('upload cleanup scheduler is skipped when storage is not configured', () => {
  const timer = startUploadCleanup({ isStorageConfigured: () => false, cleanupExpired: async () => { throw new Error('unexpected'); } });
  assert.equal(timer, null);
});

test('upload cleanup scheduler runs periodically and survives cleanup errors', async () => {
  let calls = 0;
  const logged = [];
  const timer = startUploadCleanup({
    isStorageConfigured: () => true,
    intervalMs: 5,
    cleanupExpired: async () => { calls += 1; if (calls === 1) throw new Error('storage down'); return 2; },
    logger: { log: (message) => logged.push(message), error: (message) => logged.push(message) },
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.ok(calls >= 2, `expected repeated runs, got ${calls}`);
    assert.ok(logged.some((message) => /cleanup failed/.test(message)));
    assert.ok(logged.some((message) => /Cleaned 2 expired/.test(message)));
  } finally {
    clearInterval(timer);
  }
});
