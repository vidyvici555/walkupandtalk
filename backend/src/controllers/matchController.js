const { query } = require('../config/database');

// GET /api/matches
const getMatches = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         m.id,
         m.matched_at,
         m.call_deadline,
         m.call_completed,
         m.is_active,
         EXTRACT(EPOCH FROM (m.call_deadline - NOW())) AS seconds_until_deadline,
         CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END AS partner_id,
         CASE WHEN m.user1_id = $1 THEN p2.display_name ELSE p1.display_name END AS partner_name,
         CASE WHEN m.user1_id = $1 THEN ph2.url ELSE ph1.url END AS partner_photo,
         (SELECT content FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
         (SELECT COUNT(*) FROM messages WHERE match_id = m.id AND sender_id != $1 AND is_read = false)::int AS unread_count
       FROM matches m
       JOIN profiles p1 ON m.user1_id = p1.user_id
       JOIN profiles p2 ON m.user2_id = p2.user_id
       LEFT JOIN profile_photos ph1 ON m.user1_id = ph1.user_id AND ph1.is_primary = true
       LEFT JOIN profile_photos ph2 ON m.user2_id = ph2.user_id AND ph2.is_primary = true
       WHERE (m.user1_id = $1 OR m.user2_id = $1) AND m.is_active = true
       ORDER BY last_message_at DESC NULLS LAST, m.matched_at DESC`,
      [req.user.id]
    );

    res.json({ matches: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/:matchId
const getMatch = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*,
         CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END AS partner_id,
         CASE WHEN m.user1_id = $1 THEN p2.display_name ELSE p1.display_name END AS partner_name,
         CASE WHEN m.user1_id = $1 THEN p2.bio ELSE p1.bio END AS partner_bio,
         CASE WHEN m.user1_id = $1 THEN ph2.url ELSE ph1.url END AS partner_photo,
         EXTRACT(EPOCH FROM (m.call_deadline - NOW())) AS seconds_until_deadline
       FROM matches m
       JOIN profiles p1 ON m.user1_id = p1.user_id
       JOIN profiles p2 ON m.user2_id = p2.user_id
       LEFT JOIN profile_photos ph1 ON m.user1_id = ph1.user_id AND ph1.is_primary = true
       LEFT JOIN profile_photos ph2 ON m.user2_id = ph2.user_id AND ph2.is_primary = true
       WHERE m.id = $2 AND (m.user1_id = $1 OR m.user2_id = $1)`,
      [req.user.id, req.params.matchId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/matches/:matchId  (unmatch)
const unmatch = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE matches SET is_active = false, unmatched_at = NOW(), unmatch_reason = 'user_unmatched'
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = true
       RETURNING *`,
      [req.params.matchId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/matches/:matchId/block
// Silently blocks the partner and deactivates the match.
const blockUser = async (req, res, next) => {
  try {
    // Find the match to get the partner's id
    const matchResult = await query(
      `SELECT id, user1_id, user2_id FROM matches
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = true`,
      [req.params.matchId, req.user.id]
    );

    if (!matchResult.rows[0]) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const partnerId = match.user1_id === req.user.id ? match.user2_id : match.user1_id;

    // Insert into blocked_users (ignore if already blocked)
    await query(
      `INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, partnerId]
    );

    // Deactivate the match
    await query(
      `UPDATE matches SET is_active = false, unmatched_at = NOW(), unmatch_reason = 'blocked'
       WHERE id = $1`,
      [req.params.matchId]
    );

    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/:userId/block  (block without an existing match)
const blockUserDirect = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await query(
      `INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, userId]
    );

    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMatches, getMatch, unmatch, blockUser, blockUserDirect };
