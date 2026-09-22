const jwtSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = {
  jwtSecret: jwtSecret || 'development-secret-change-me',
  jwtExpiration: '24h',
};
