/**
 * Email Service — powered by SendGrid
 * Install: npm install @sendgrid/mail
 *
 * Set in backend/.env:
 *   SENDGRID_API_KEY=SG.your_key_here
 *   FROM_EMAIL=no-reply@walkupandtalk.com
 *   FROM_NAME=Walk Up & Talk
 */

let sgMail;
let emailConfigured = false;

try {
  sgMail = require('@sendgrid/mail');
  if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.includes('REPLACE')) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    emailConfigured = true;
    console.log('[Email] SendGrid configured ✓');
  } else {
    console.warn('[Email] SENDGRID_API_KEY not set — emails will be skipped.');
  }
} catch {
  console.warn('[Email] @sendgrid/mail not installed — run: npm install @sendgrid/mail');
}

const FROM = {
  email: process.env.FROM_EMAIL || 'no-reply@walkupandtalk.com',
  name: process.env.FROM_NAME || 'Walk Up & Talk',
};

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Base HTML template ──────────────────────────────────────────────────────
function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Walk Up & Talk</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:#ec4899;padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">💘 Walk Up &amp; Talk</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              You're receiving this because you have an account on Walk Up &amp; Talk.<br/>
              <a href="${APP_URL}/profile" style="color:#ec4899;text-decoration:none;">Manage notifications</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Template helpers ────────────────────────────────────────────────────────
function pinkButton(text, url) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:14px 28px;background:#ec4899;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">${text}</a>`;
}

// ─── Send helper ─────────────────────────────────────────────────────────────
async function send({ to, toName, subject, html }) {
  if (!emailConfigured) return;
  try {
    await sgMail.send({
      to: { email: to, name: toName || '' },
      from: FROM,
      subject,
      html,
    });
  } catch (err) {
    console.error('[Email] Send failed:', err?.response?.body || err.message);
  }
}

// ─── Email templates ─────────────────────────────────────────────────────────

/**
 * New match notification
 */
async function sendNewMatchEmail(userEmail, userName, partnerName, matchId) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:24px;color:#111827;">It's a match! 💘</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:16px;">
      Hi ${userName}, you and <strong style="color:#ec4899;">${partnerName}</strong> have liked each other.
    </p>
    <p style="margin:0;color:#374151;font-size:15px;">
      Remember — you have <strong>7 days</strong> to make a voice or video call, or you'll be automatically unmatched.
    </p>
    <div style="text-align:center;">${pinkButton('💬 Start Chatting', `${APP_URL}/matches/${matchId}`)}</div>
  `);

  return send({ to: userEmail, toName: userName, subject: `💘 You matched with ${partnerName}!`, html });
}

/**
 * New message notification (only send if user has been offline > 10 min)
 */
async function sendNewMessageEmail(userEmail, userName, senderName, preview, matchId) {
  const truncated = preview.length > 100 ? preview.slice(0, 97) + '…' : preview;
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:24px;color:#111827;">New message from ${senderName} 💬</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:16px;">Hi ${userName},</p>
    <div style="background:#f9fafb;border-left:3px solid #ec4899;padding:12px 16px;border-radius:8px;color:#374151;font-style:italic;">
      "${truncated}"
    </div>
    <div style="text-align:center;">${pinkButton('Reply Now', `${APP_URL}/matches/${matchId}`)}</div>
  `);

  return send({ to: userEmail, toName: userName, subject: `💬 ${senderName} sent you a message`, html });
}

/**
 * Call deadline warning
 */
async function sendCallDeadlineEmail(userEmail, userName, partnerName, matchId, hoursLeft) {
  const urgency = hoursLeft <= 24 ? '🚨 Final warning' : '⏰ Reminder';
  const color = hoursLeft <= 24 ? '#ef4444' : '#f97316';

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:24px;color:${color};">${urgency}: ${hoursLeft}h left to call!</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:16px;">Hi ${userName},</p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Your match with <strong style="color:#ec4899;">${partnerName}</strong> expires in
      <strong style="color:${color};">${hoursLeft} hours</strong>.
      Make a voice or video call lasting at least 2 minutes to secure your match permanently.
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;">
      If no qualifying call is made, you'll be automatically unmatched.
    </p>
    <div style="text-align:center;">${pinkButton('📞 Call Now', `${APP_URL}/matches/${matchId}`)}</div>
  `);

  return send({ to: userEmail, toName: userName, subject: `${urgency}: Call ${partnerName} within ${hoursLeft}h or lose your match`, html });
}

/**
 * Welcome email sent after registration
 */
async function sendWelcomeEmail(userEmail, userName) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:24px;color:#111827;">Welcome to Walk Up &amp; Talk! 🎉</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:16px;">Hi ${userName},</p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      You're now part of the only dating app that requires an actual conversation.
      No endless texting — match, chat briefly, then <strong>call within 7 days</strong>.
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">
      <li>You get <strong>50 swipes per day</strong></li>
      <li>After a match, you have <strong>7 days to call</strong></li>
      <li>Calls must be at least <strong>2 minutes</strong> to secure the match</li>
      <li>Walk Up &amp; Talk is <strong>100% free</strong> — always</li>
    </ul>
    <div style="text-align:center;">${pinkButton('Start Swiping', `${APP_URL}/swipe`)}</div>
  `);

  return send({ to: userEmail, toName: userName, subject: 'Welcome to Walk Up & Talk! 👋', html });
}

module.exports = {
  sendNewMatchEmail,
  sendNewMessageEmail,
  sendCallDeadlineEmail,
  sendWelcomeEmail,
};
