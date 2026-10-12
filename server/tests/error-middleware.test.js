const test = require('node:test');
const assert = require('node:assert/strict');

const { errorMiddleware } = require('../middleware/error.middleware');

test('server errors do not expose internal messages to clients', () => {
  const error = new Error('password authentication failed for user "username"');
  const previousNodeEnv = process.env.NODE_ENV;
  let statusCode;
  let payload;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  const originalConsoleError = console.error;
  process.env.NODE_ENV = 'development';
  console.error = () => undefined;

  try {
    errorMiddleware(error, {}, response, () => undefined);

    assert.equal(statusCode, 500);
    assert.deepEqual(payload, {
      error: 'Service temporarily unavailable. Please try again later.',
      status: 500,
    });
  } finally {
    console.error = originalConsoleError;
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});