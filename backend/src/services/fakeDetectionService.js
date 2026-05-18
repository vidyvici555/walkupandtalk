const { query } = require('../config/database');

/**
 * Fake profile detection service.
 * Runs heuristic checks and stores signals for admin review.
 * Score 0-100: higher = more suspicious.
 */

const SUSPICIOUS_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'temp-mail.org', 'throwam.com',
  'yopmail.com', 'sharklasers.com', 'trashmail.com', 'fakeinbox.com',
];

const detectFakeSignals = async (userId, data = {}) => {
  const signals = [];

  // 1. Disposable email domain check
  if (data.email) {
    const domain = data.email.split('@')[1]?.toLowerCase();
    if (SUSPICIOUS_EMAIL_DOMAINS.includes(domain)) {
      signals.push({
        type: 'disposable_email',
        score: 80,
        details: { domain },
      });
    }
  }

  // 2. Sequential/pattern email check
  if (data.email) {
    const localPart = data.email.split('@')[0];
    if (/^[a-z]+\d{5,}$/i.test(localPart)) {
      signals.push({
        type: 'pattern_email',
        score: 40,
        details: { pattern: 'alpha+many_digits' },
      });
    }
  }

  // 3. Multiple registrations from same IP
  if (data.ip) {
    const ipCount = await query(
      `SELECT COUNT(*) FROM fake_profile_signals
       WHERE signal_type = 'ip_registration' AND details->>'ip' = $1
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [data.ip]
    );
    const count = parseInt(ipCount.rows[0].count);
    if (count >= 2) {
      signals.push({
        type: 'ip_registration',
        score: 60 + count * 10,
        details: { ip: data.ip, count: count + 1 },
      });
    } else {
      // Store IP signal even if not suspicious (for future reference)
      signals.push({
        type: 'ip_registration',
        score: 0,
        details: { ip: data.ip, count: 1 },
      });
    }
  }

  // Save all signals
  for (const signal of signals) {
    await query(
      `INSERT INTO fake_profile_signals (user_id, signal_type, score, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, signal.type, signal.score, JSON.stringify(signal.details)]
    );

    // Auto-flag if single signal score is very high
    if (signal.score >= 70) {
      await query(
        "UPDATE users SET is_flagged = true, flag_reason = $1 WHERE id = $2",
        [`Auto-flagged: ${signal.type} (score: ${signal.score})`, userId]
      );
    }
  }

  return signals;
};

/**
 * Calculate aggregate fake score for a user.
 */
const getUserFakeScore = async (userId) => {
  const result = await query(
    'SELECT COALESCE(SUM(score), 0) AS total FROM fake_profile_signals WHERE user_id = $1',
    [userId]
  );
  return parseFloat(result.rows[0].total);
};

/**
 * Check profile completion speed (too fast = suspicious).
 * Call this after profile is fully submitted.
 */
const checkProfileCompletionSpeed = async (userId, profileCreatedAt) => {
  const accountResult = await query('SELECT created_at FROM users WHERE id = $1', [userId]);
  if (!accountResult.rows[0]) return;

  const accountAge = Date.now() - new Date(accountResult.rows[0].created_at).getTime();
  const minutesSinceRegistration = accountAge / 60000;

  if (minutesSinceRegistration < 2) {
    await query(
      `INSERT INTO fake_profile_signals (user_id, signal_type, score, details)
       VALUES ($1, 'rapid_profile_completion', 50, $2)`,
      [userId, JSON.stringify({ minutes: minutesSinceRegistration })]
    );
  }
};

module.exports = { detectFakeSignals, getUserFakeScore, checkProfileCompletionSpeed };
