const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { jwtSecret, jwtExpiration } = require('../config/auth');
const { getCookieSameSite } = require('../config/deployment');
const crypto = require('crypto');
const emailUtils = require('../utils/email');

const isCampusEmail = (email, identifier) => email.trim().toLowerCase() === `${identifier.trim().toLowerCase()}@tut4life.ac.za`;
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const invalidLoginMessage = 'Invalid email or password';

const register = async (req, res, next) => {
  try {
    const { username, email, password, confirm_password, account_type, student_number, staff_number } = req.body || {};
    const identifier = account_type === 'student' ? student_number : staff_number;

    if (typeof username !== 'string' || !username.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !['student', 'staff'].includes(account_type)) {
      return res.status(400).json({ error: 'Name, email, password, and a valid account type are required' });
    }

    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid campus email address' });
    }

    if (typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: `${account_type === 'student' ? 'Student' : 'Staff'} number is required` });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (typeof confirm_password !== 'string' || password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!isCampusEmail(email, identifier)) {
      return res.status(400).json({ error: 'Email must match your student/staff number and use the @tut4life.ac.za domain' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findByEmail(normalizedEmail);
    const existingIdentifier = await User.findByCampusIdentifier(identifier.trim());
    if (existingUser || existingIdentifier) {
      return res.status(409).json({ error: 'Email or campus number is already registered' });
    }

    // Hash the password before it reaches PostgreSQL.
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await User.create({ username: username.trim(), email: normalizedEmail, accountType: account_type, studentNumber: account_type === 'student' ? identifier.trim() : null, staffNumber: account_type === 'staff' ? identifier.trim() : null, passwordHash });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Email or campus number is already registered' });
      }
      throw error;
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, email: user.email, account_type: user.account_type },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};

    if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
      return res.status(401).json({ error: invalidLoginMessage });
    }

    const user = await User.findByLoginIdentifier(identifier.trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: invalidLoginMessage });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, accountType: user.account_type },
      jwtSecret,
      { expiresIn: jwtExpiration }
    );

    res.cookie('campuslink_session', token, {
      httpOnly: true,
      sameSite: getCookieSameSite(),
      secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        account_type: user.account_type,
        identifier: user.account_type === 'staff' ? user.staff_number : user.student_number,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie('campuslink_session', { httpOnly: true, sameSite: getCookieSameSite(), secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out' });
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findByEmail(normalizedEmail);

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour
      await User.setResetToken(normalizedEmail, token, expires);
      await emailUtils.sendPasswordResetEmail(normalizedEmail, token);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const user = await User.findByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await User.updatePassword(user.id, passwordHash);

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Session account no longer exists' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      account_type: user.account_type,
      identifier: user.account_type === 'staff' ? user.staff_number : user.student_number,
    });
  } catch (error) {
    next(error);
  }
};

const getPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ emailUpdates: user?.email_updates ?? true, matchAlerts: user?.match_alerts ?? true });
  } catch (error) {
    next(error);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const preferences = await User.updatePreferences(req.user.id, {
      emailUpdates: req.body.emailUpdates,
      matchAlerts: req.body.matchAlerts,
    });
    res.json({ emailUpdates: preferences.email_updates, matchAlerts: preferences.match_alerts });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, forgotPassword, resetPassword, getSession, getPreferences, updatePreferences };
