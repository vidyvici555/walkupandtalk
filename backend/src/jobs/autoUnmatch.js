const cron = require('node-cron');
const { query } = require('../config/database');
const { processExpiredMatches } = require('../services/matchService');
const { notifyCallDeadline } = require('../services/pushService');
const { sendCallDeadlineEmail } = require('../services/emailService');
const logger = require('../config/logger');

/**
 * Runs every hour:
 * 1. Auto-unmatch couples who haven't called within the 7-day deadline.
 * 2. Send push + email deadline warnings at ~48h and ~24h remaining.
 */
const startAutoUnmatchJob = (io) => {

  // ── Main hourly job ──────────────────────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    logger.info('Running auto-unmatch job...');
    try {
      const unmatched = await processExpiredMatches();

      if (unmatched.length > 0) {
        logger.info(`Auto-unmatched ${unmatched.length} matches due to no call`);

        for (const match of unmatched) {
          if (io) {
            io.to(`user:${match.user1_id}`).emit('match_expired', { matchId: match.id });
            io.to(`user:${match.user2_id}`).emit('match_expired', { matchId: match.id });
          }
        }
      }
    } catch (err) {
      logger.error('Auto-unmatch job failed:', err);
    }
  });

  // ── Call deadline warnings (push + email) ────────────────────────────────
  // Runs every hour at :30, checks for matches expiring in ~24h or ~48h
  cron.schedule('30 * * * *', async () => {
    try {
      const deadlineMatches = await query(
        `SELECT m.id, m.user1_id, m.user2_id,
                p1.display_name AS name1, p2.display_name AS name2,
                EXTRACT(EPOCH FROM (m.call_deadline - NOW())) AS seconds_left
         FROM matches m
         JOIN profiles p1 ON p1.user_id = m.user1_id
         JOIN profiles p2 ON p2.user_id = m.user2_id
         WHERE m.is_active = true
           AND m.call_completed = false
           AND (
             (EXTRACT(EPOCH FROM (m.call_deadline - NOW())) BETWEEN 84600 AND 87000)
             OR
             (EXTRACT(EPOCH FROM (m.call_deadline - NOW())) BETWEEN 169800 AND 172200)
           )`
      );

      for (const match of deadlineMatches.rows) {
        const hoursLeft = Math.round(match.seconds_left / 3600);

        // Push notifications
        notifyCallDeadline(match.user1_id, match.name2, match.id, hoursLeft).catch(() => {});
        notifyCallDeadline(match.user2_id, match.name1, match.id, hoursLeft).catch(() => {});

        // Email reminders
        query(
          `SELECT u.id, u.email FROM users u WHERE u.id = ANY($1::uuid[])`,
          [[match.user1_id, match.user2_id]]
        ).then((emailRes) => {
          const emailMap = Object.fromEntries(emailRes.rows.map((r) => [r.id, r.email]));
          sendCallDeadlineEmail(emailMap[match.user1_id], match.name1, match.name2, match.id, hoursLeft).catch(() => {});
          sendCallDeadlineEmail(emailMap[match.user2_id], match.name2, match.name1, match.id, hoursLeft).catch(() => {});
        }).catch(() => {});
      }

      if (deadlineMatches.rows.length > 0) {
        logger.info(`Sent call-deadline warnings for ${deadlineMatches.rows.length} matches`);
      }
    } catch (err) {
      logger.error('Call deadline warning job failed:', err);
    }
  });

  logger.info('Auto-unmatch & deadline warning cron jobs started (hourly)');
};

module.exports = { startAutoUnmatchJob };
