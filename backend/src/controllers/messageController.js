const { query } = require('../config/database');
const { notifyNewMessage } = require('../services/pushService');
const { sendNewMessageEmail } = require('../services/emailService');

// GET /api/messages/:matchId
const getMessages = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { before, limit = 50 } = req.query;

    const matchCheck = await query(
      'SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = true',
      [matchId, req.user.id]
    );
    if (!matchCheck.rows[0]) {
      return res.status(403).json({ error: 'Not authorized for this match' });
    }

    const result = await query(
      `SELECT m.*, p.display_name AS sender_name
       FROM messages m
       JOIN profiles p ON m.sender_id = p.user_id
       WHERE m.match_id = $1
         ${before ? 'AND m.created_at < $3' : ''}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      before ? [matchId, parseInt(limit), before] : [matchId, parseInt(limit)]
    );

    await query(
      'UPDATE messages SET is_read = true WHERE match_id = $1 AND sender_id != $2 AND is_read = false',
      [matchId, req.user.id]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId
const sendMessage = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const matchCheck = await query(
      `SELECT m.id, m.user1_id, m.user2_id, p.display_name AS sender_name
       FROM matches m
       JOIN profiles p ON p.user_id = $2
       WHERE m.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2) AND m.is_active = true`,
      [matchId, req.user.id]
    );
    if (!matchCheck.rows[0]) {
      return res.status(403).json({ error: 'Cannot send message to this match' });
    }

    const match = matchCheck.rows[0];

    const result = await query(
      'INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [matchId, req.user.id, content.trim()]
    );

    const message = result.rows[0];

    // Emit via socket.io
    req.app.get('io')?.to(`match:${matchId}`).emit('new_message', message);

    // Push notification to recipient (fire-and-forget)
    const recipientId = match.user1_id === req.user.id ? match.user2_id : match.user1_id;
    notifyNewMessage(recipientId, match.sender_name, content.trim(), matchId).catch(() => {});

    // Email only if recipient has unread messages older than 10 minutes (likely offline)
    query(
      `SELECT COUNT(*) FROM messages
       WHERE match_id = $1 AND sender_id = $2 AND is_read = false
         AND created_at < NOW() - INTERVAL '10 minutes'`,
      [matchId, req.user.id]
    ).then(async (res2) => {
      if (parseInt(res2.rows[0].count) > 0) {
        const recipientUser = await query(
          `SELECT u.email, p.display_name
           FROM users u JOIN profiles p ON p.user_id = u.id
           WHERE u.id = $1`,
          [recipientId]
        );
        if (recipientUser.rows[0]) {
          const { email, display_name } = recipientUser.rows[0];
          sendNewMessageEmail(email, display_name || 'there', match.sender_name, content.trim(), matchId).catch(() => {});
        }
      }
    }).catch(() => {});

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

module.exports = { getMessages, sendMessage };
