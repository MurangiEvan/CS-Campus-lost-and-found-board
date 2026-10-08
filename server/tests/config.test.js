const test = require('node:test');
const assert = require('node:assert/strict');

const authModulePath = require.resolve('../config/auth');
const { createTrustedOriginGuard } = require('../middleware/origin.middleware');
const { getAllowedOrigins, getCookieSameSite, isAllowedOrigin } = require('../config/deployment');

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

test('state-changing requests require a trusted Origin', () => {
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

  nextCalled = false;
  guard(request('POST', 'https://clienntt-g9grgedw5-murangievans-projects.vercel.app'), response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('only this CampusLink Vercel preview host pattern is trusted', () => {
  const allowedOrigins = ['https://campus.example.test'];

  assert.equal(isAllowedOrigin('https://campus.example.test', allowedOrigins), true);
  assert.equal(isAllowedOrigin('https://clienntt-g9grgedw5-murangievans-projects.vercel.app', allowedOrigins), true);
  assert.equal(isAllowedOrigin('https://another-project-g9grgedw5-murangievans-projects.vercel.app', allowedOrigins), false);
  assert.equal(isAllowedOrigin('https://clienntt-g9grgedw5-other-team.vercel.app', allowedOrigins), false);
  assert.equal(isAllowedOrigin('http://clienntt-g9grgedw5-murangievans-projects.vercel.app', allowedOrigins), false);
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
