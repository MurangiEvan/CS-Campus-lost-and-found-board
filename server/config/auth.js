module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'default_secret_key',
  jwtExpiration: '24h',
};
