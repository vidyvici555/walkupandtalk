const { query } = require('../config/database');

/**
 * Creates a match between two users (enforcing user1_id < user2_id to avoid duplicates).
 */
const createMatch = async (userAId, userBId) => {
  const [user1Id, user2Id] = [userAId, userBId].sort();

  const CALL_DEADLINE_DAYS = parseInt(process.env.CALL_DEADLINE_DAYS) || 7;

  const result = await query(
    `INSERT INTO matches (user1_id, user2_id, call_deadline)
     VALUES ($1, $2, NOW() + INTERVAL '${CALL_DEADLINE_DAYS} days')
     ON CONFLICT (user1_id, user2_id) DO UPDATE SET is_active = true, matched_at = NOW(),
       call_deadline = NOW() + INTERVAL '${CALL_DEADLINE_DAYS} days'
     RETURNING *`,
    [user1Id, user2Id]
  );

  return result.rows[0];
};

/**
 * Marks a match as having a completed call.
 */
const markCallCompleted = async (matchId) => {
  await query(
    'UPDATE matches SET call_completed = true, call_completed_at = NOW() WHERE id = $1',
    [matchId]
  );
};

/**
 * Auto-unmatch expired matches (called by cron job).
 * Returns the number of matches unmatched.
 */
const processExpiredMatches = async () => {
  const result = await query(
    `UPDATE matches
     SET is_active = false, unmatched_at = NOW(), unmatch_reason = 'no_call'
     WHERE is_active = true
       AND call_completed = false
       AND call_deadline < NOW()
     RETURNING id, user1_id, user2_id`,
  );

  return result.rows;
};

module.exports = { createMatch, markCallCompleted, processExpiredMatches };
