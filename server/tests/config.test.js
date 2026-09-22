const test = require('node:test');
const assert = require('node:assert/strict');

const authModulePath = require.resolve('../config/auth');

test('production requires an explicit JWT secret', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJwtSecret = process.env.JWT_SECRET;

  try {
    delete require.cache[authModulePath];
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    assert.throws(() => require('../config/auth'), /JWT_SECRET/i);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }

    delete require.cache[authModulePath];
  }
});
