require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./config/logger');
const { pool } = require('./config/database');
const { redis } = require('./config/redis');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { startAutoUnmatchJob } = require('./jobs/autoUnmatch');

// Route imports
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const swipeRoutes = require('./routes/swipe');
const matchRoutes = require('./routes/matches');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const pushRoutes = require('./routes/push');

const app = express();
const server = http.createServer(app);

// ─── Allowed origins (CORS) ──────────────────────────────────────────────────
const getAllowedOrigin = (origin) => {
  if (!origin) return true; // same-origin / curl / server-to-server
  if (origin.startsWith('http://localhost')) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return true;
  return false;
};

// ─── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on('join_user_room', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('join_match_room', (matchId) => {
    socket.join(`match:${matchId}`);
  });

  socket.on('leave_match_room', (matchId) => {
    socket.leave(`match:${matchId}`);
  });

  socket.on('typing', ({ matchId, userId }) => {
    socket.to(`match:${matchId}`).emit('typing', { userId });
  });

  socket.on('stop_typing', ({ matchId, userId }) => {
    socket.to(`match:${matchId}`).emit('stop_typing', { userId });
  });

  // Read receipts — broadcast to everyone else in the match room
  socket.on('message_read', ({ matchId, messageId }) => {
    if (!matchId || !messageId) return;
    // Update in DB (best-effort, non-blocking)
    pool.query('UPDATE messages SET is_read = true WHERE id = $1', [messageId]).catch(() => {});
    // Tell the sender their message was read
    socket.to(`match:${matchId}`).emit('message_read', { messageId });
  });

  // Mark all unread messages in a chat as read
  socket.on('mark_all_read', ({ matchId }) => {
    if (!matchId) return;
    // We can't easily get the userId here without auth middleware, so the frontend
    // handles per-message marking. This event is a no-op on the server for now.
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: getAllowedOrigin,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/push', pushRoutes);

app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (e) {
    // db down
  }
  res.status(dbOk ? 200 : 200).json({
    status: 'ok',
    db: dbOk ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Start listening immediately so Railway's healthcheck can succeed.
// DB connection is verified in the background.
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Veri