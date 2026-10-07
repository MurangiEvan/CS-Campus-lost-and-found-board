const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function createTrustedOriginGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();
    const origin = req.get ? req.get('origin') : req.headers?.origin;
    if (!origin || !allowed.has(origin)) {
      return res.status(403).json({ error: 'Request origin is not allowed' });
    }
    return next();
  };
}

module.exports = { createTrustedOriginGuard };