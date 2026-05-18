const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { setEx, get, del } = require('../config/redis');
const { detectFakeSignals } = require('../services/fakeDetectionService');
const { sendWelcomeEmail } = require('../services/emailService');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { email, password, phone } = req.body;

    const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await query(
      'INSERT INTO users (id, email, password_hash, phone) VALUES ($1, $2, $3, $4)',
      [userId, email.toLowerCase(), passwordHash, phone || null]
    );

    // Run fake detection signals for new registration
    detectFakeSignals(userId, { email, phone, ip: req.ip }).catch(() => {});

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(email.toLowerCase(), email.split('@')[0]).catch(() => {});

    const token = generateToken(userId);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      userId,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, password_hash, is_active, is_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    // Check if profile is complete
    const profileResult = await query(
      'SELECT is_complete FROM profiles WHERE user_id = $1',
      [user.id]
    );

    res.json({
      token,
      userId: user.id,
      isAdmin: user.is_admin,
      profileComplete: profileResult.rows[0]?.is_complete || false,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.phone, u.is_admin, u.created_at,
            p.display_name, p.is_complete
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
};

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me, changePassword };
