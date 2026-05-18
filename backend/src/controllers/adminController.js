const { query } = require('../config/database');

// GET /api/admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [users, matches, reports, flagged] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      query('SELECT COUNT(*) FROM matches WHERE is_active = true'),
      query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
      query('SELECT COUNT(*) FROM users WHERE is_flagged = true'),
    ]);

    const recentSignups = await query(
      `SELECT id, email, created_at, is_flagged FROM users
       ORDER BY created_at DESC LIMIT 10`
    );

    res.json({
      stats: {
        totalActiveUsers: parseInt(users.rows[0].count),
        totalActiveMatches: parseInt(matches.rows[0].count),
        pendingReports: parseInt(reports.rows[0].count),
        flaggedAccounts: parseInt(flagged.rows[0].count),
      },
      recentSignups: recentSignups.rows,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, flagged, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (flagged === 'true') {
      whereClause += ' AND u.is_flagged = true';
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (u.email ILIKE $${params.length} OR p.display_name ILIKE $${params.length})`;
    }

    params.push(parseInt(limit), offset);

    const result = await query(
      `SELECT u.id, u.email, u.is_active, u.is_flagged, u.flag_reason, u.created_at, u.last_active,
              p.display_name, p.location_state, p.is_complete,
              (SELECT COUNT(*) FROM reports r WHERE r.reported_id = u.id)::int AS report_count
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON u.id = p.user_id ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/users/:userId/suspend
const suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    await query(
      'UPDATE users SET is_active = false, flag_reason = $1 WHERE id = $2',
      [reason || 'Suspended by admin', req.params.userId]
    );
    res.json({ message: 'User suspended' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/users/:userId/reinstate
const reinstateUser = async (req, res, next) => {
  try {
    await query(
      'UPDATE users SET is_active = true, is_flagged = false, flag_reason = NULL WHERE id = $1',
      [req.params.userId]
    );
    res.json({ message: 'User reinstated' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/reports
const getReports = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT r.*,
              u1.email AS reporter_email,
              u2.email AS reported_email,
              p2.display_name AS reported_name
       FROM reports r
       JOIN users u1 ON r.reporter_id = u1.id
       JOIN users u2 ON r.reported_id = u2.id
       LEFT JOIN profiles p2 ON r.reported_id = p2.user_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), offset]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/reports/:reportId/review
const reviewReport = async (req, res, next) => {
  try {
    const { action, notes } = req.body; // action: 'actioned' | 'dismissed'

    await query(
      `UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [action, req.user.id, req.params.reportId]
    );

    // If actioned, flag the reported user
    if (action === 'actioned') {
      const report = await query('SELECT reported_id FROM reports WHERE id = $1', [req.params.reportId]);
      if (report.rows[0]) {
        await query(
          "UPDATE users SET is_flagged = true, flag_reason = $1 WHERE id = $2",
          [notes || 'Flagged via report review', report.rows[0].reported_id]
        );
      }
    }

    res.json({ message: 'Report reviewed' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/fake-signals
const getFakeSignals = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fs.*, u.email, p.display_name
       FROM fake_profile_signals fs
       JOIN users u ON fs.user_id = u.id
       LEFT JOIN profiles p ON fs.user_id = p.user_id
       ORDER BY fs.created_at DESC
       LIMIT 50`
    );
    res.json({ signals: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getUsers, suspendUser, reinstateUser, getReports, reviewReport, getFakeSignals };
