const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const { isAllowedOrigin } = require('../config/deployment');

function createTrustedOriginGuard(allowedOrigins) {
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();
    const origin = req.get ? req.get('origin') : req.headers?.origin;
    if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
      return res.status(403).json({ error: 'Request origin is not allowed' });
    }
    return next();
  };
}

module.exports = { createTrustedOriginGuard };