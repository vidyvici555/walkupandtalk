/**
 * Push Notification Service
 * Uses the web-push library (npm install web-push) for VAPID-authenticated
 * Web Push messages. Falls back gracefully if not installed yet.
 */

const { query } = require('../config/database');

let webpush;
let vapidConfigured = false;

// Lazy-load web-push so the server still starts if it hasn't been installed yet
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@walkupandtalk.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
    console.log('[Push] web-push configured ✓');
  } else {
    console.warn('[Push] VAPID keys missing — push notifications disabled.');
  }
} catch {
  console.warn('[Push] web-push not installed — run: npm install web-push');
}

/**
 * Send a push notification to all subscriptions for a user.
 * Silently removes stale/invalid subscriptions.
 */
async function sendPushToUser(userId, payload) {
  if (!vapidConfigured) return;

  const result = await query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  if (result.rows.length === 0) return;

  const notification = JSON.stringify(payload);

  const sends = result.rows.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification,
        { TTL: 86400 } // 24 hour TTL
      );
    } catch (err) {
      // 404 / 410 = subscription expired, remove it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
    }
  });

  await Promise.allSettled(sends);
}

// ─── Notification helpers ────────────────────────────────────────────────────

async function notifyNewMatch(userId, partnerName, matchId) {
  return sendPushToUser(userId, {
    title: '💘 New Match!',
    body: `You matched with ${partnerName}! Say hi and remember to call within 7 days.`,
    data: { url: `/matches/${matchId}`, tag: `match-${matchId}` },
  });
}

async function notifyNewMessage(userId, senderName, preview, matchId) {
  return sendPushToUser(userId, {
    title: `💬 ${senderName}`,
    body: preview.length > 80 ? preview.slice(0, 77) + '…' : preview,
    data: { url: `/matches/${matchId}`, tag: `msg-${matchId}` },
  });
}

async function notifyCallDeadline(userId, partnerName, matchId, hoursLeft) {
  return sendPushToUser(userId, {
    title: '⏰ Call deadline approaching!',
    body: `Only ${hoursLeft}h left to call ${partnerName} or you'll be unmatched.`,
    data: { url: `/matches/${matchId}`, tag: `deadline-${matchId}` },
  });
}

module.exports = { sendPushToUser, notifyNewMatch, notifyNewMessage, notifyCallDeadline };
