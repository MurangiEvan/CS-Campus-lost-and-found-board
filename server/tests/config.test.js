const test = require('node:test');
const assert = require('node:assert/strict');

const authModulePath = require.resolve('../config/auth');
const { createTrustedOriginGuard } = require('../middleware/origin.middleware');
const { getAllowedOrigins, getCookieSameSite } = require('../config/deployment');

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

test('state-changing requests require an exact trusted Origin', () => {
  const guard = createTrustedOriginGuard(['https://campus.example.test']);
  const request = (method, origin) => ({ method, headers: { origin }, get: (header) => header === 'origin' ? origin : undefined });
  const response = () => ({
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  });

  let nextCalled = false;
  guard(request('GET'), response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const missingOrigin = response();
  guard(request('POST'), missingOrigin, () => { throw new Error('missing Origin must be rejected'); });
  assert.equal(missingOrigin.statusCode, 403);

  const untrustedOrigin = response();
  guard(request('PATCH', 'https://attacker.example.test'), untrustedOrigin, () => { throw new Error('untrusted Origin must be rejected'); });
  assert.equal(untrustedOrigin.statusCode, 403);

  nextCalled = false;
  guard(request('DELETE', 'https://campus.example.test'), response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('production deployment defaults to the exact Vercel origin and cross-site cookies', () => {
  assert.deepEqual(getAllowedOrigins({ NODE_ENV: 'production' }), ['https://cs-campus-lost-and-found-board.vercel.app']);
  assert.equal(getCookieSameSite({ NODE_ENV: 'production' }), 'none');
});

test('deployment environment can override origins and cookie same-site policy', () => {
  assert.deepEqual(getAllowedOrigins({ CORS_ORIGINS: 'https://campus.example.test, https://admin.example.test' }), [
    'https://campus.example.test',
    'https://admin.example.test',
  ]);
  assert.equal(getCookieSameSite({ NODE_ENV: 'production', COOKIE_SAMESITE: 'lax' }), 'lax');
});
