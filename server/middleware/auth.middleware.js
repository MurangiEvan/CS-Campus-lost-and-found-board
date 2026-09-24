const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.campuslink_session;

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional authenticate: if token present, verify and attach user; otherwise continue anonymously
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.campuslink_session;
  if (!token) return next();
  jwt.verify(token, jwtSecret, (err, user) => {
    if (!err && user) req.user = user;
    return next();
  });
};

const authorizeStaff = (req, res, next) => {
  if (!req.user || req.user.accountType !== 'staff') {
    return res.status(403).json({ error: 'Forbidden: staff only' });
  }
  next();
};

module.exports = { authenticateToken, optionalAuthenticate, authorizeStaff };
