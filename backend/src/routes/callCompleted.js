const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const { markCallCompleted } = require('../services/matchService');
const { query } = require('../config/database');

const MIN_CALL_SECONDS = 120; // 2 minutes

// POST /api/matches/:matchId/call-completed
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { durationSeconds = 0 } = req.body;

    // Verify user is part of this active match
    const matchCheck = await query(
      `SELECT id, call_completed FROM matches
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = true`,
      [matchId, req.user.id]
    );

    if (!matchCheck.rows[0]) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Only the first qualifying call secures the match
    if (matchCheck.rows[0].call_completed) {
      return res.json({ secured: false, reason: 'Match already secured by a previous call.' });
    }

    // Enforce 2-minute minimum
    if (durationSeconds < MIN_CALL_SECONDS) {
      return res.json({
        secured: false,
        reason: `Call was ${durationSeconds}s — need at least ${MIN_CALL_SECONDS}s to secure the match.`,
      });
    }

    await markCallCompleted(matchId);

    // Log the qualifying call
    await query(
      `INSERT INTO call_logs (match_id, caller_id, callee_id, status, duration_seconds)
       SELECT $1, $2,
         CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END,
         'completed', $3
       FROM matches WHERE id = $1`,
      [matchId, req.user.id, durationSeconds]
    );

    res.json({ secured: true, message: 'Match secured!' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
