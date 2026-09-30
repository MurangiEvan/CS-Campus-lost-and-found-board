const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { jwtSecret, jwtExpiration } = require('../config/auth');
const crypto = require('crypto');
const emailUtils = require('../utils/email');

const isCampusEmail = (email, identifier) => email.trim().toLowerCase() === `${identifier.trim().toLowerCase()}@tut4life.ac.za`;

const register = async (req, res, next) => {
  try {
    const { username, email, password, account_type = 'student', student_number, staff_number } = req.body;
    const identifier = account_type === 'student' ? student_number : staff_number;

    if (!username || !email || !password || !['student', 'staff'].includes(account_type)) {
      return res.status(400).json({ error: 'Name, email, password, and a valid account type are required' });
    }

    if (!identifier) {
      return res.status(400).json({ error: `${account_type === 'student' ? 'Student' : 'Staff'} number is required` });
    }

    if (!isCampusEmail(email, identifier)) {
      return res.status(400).json({ error: 'Email must match your student/staff number and use the @tut4life.ac.za domain' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email: normalizedEmail, accountType: account_type, studentNumber: student_number || null, staffNumber: staff_number || null, passwordHash });

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
    const { account_type = 'student', identifier, password } = req.body;

    if (!identifier || !password || !['student', 'staff'].includes(account_type)) {
      return res.status(400).json({ error: 'Account type, student/staff number, and password are required' });
    }

    const user = await User.findByCredential({ accountType: account_type, identifier });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, accountType: user.account_type },
      jwtSecret,
      { expiresIn: jwtExpiration }
    );

    res.cookie('campuslink_session', token, {
      httpOnly: true,
      sameSite: process.env.COOKIE_SAMESITE || 'lax',
      secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, account_type: user.account_type, identifier },
    });
  } catch (error) {
    next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie('campuslink_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
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
