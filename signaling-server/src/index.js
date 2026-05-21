/**
 * Walk Up and Go - WebRTC Signaling Server
 *
 * Handles WebRTC peer connection negotiation between matched users.
 * Peers exchange SDP offers/answers and ICE candidates through this server.
 * Actual media (audio/video) travels peer-to-peer after connection is established.
 *
 * Flow:
 *   1. Caller emits 'call_user'  → server relays 'incoming_call' to callee
 *   2. Callee accepts → emits 'call_accepted' with answer SDP
 *   3. Both sides exchange 'ice_candidate'
 *   4. P2P connection established — no media goes through this server
 *   5. Either side emits 'end_call' to terminate
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Track online users: userId → socketId
const onlineUsers = new Map();
// Track active calls: callId → { caller, callee }
const activeCalls = new Map();

// ─── Auth middleware for socket connections ───────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// ─── Connection Handler ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);
  console.log(`User ${userId} connected (${socket.id}). Online: ${onlineUsers.size}`);

  // ── Initiate a call ──────────────────────────────────────────────────────
  socket.on('call_user', ({ targetUserId, matchId, offer, callType }) => {
    const targetSocketId = onlineUsers.get(targetUserId);

    if (!targetSocketId) {
      socket.emit('call_error', { message: 'User is not online right now' });
      return;
    }

    const callId = `${matchId}-${Date.now()}`;
    activeCalls.set(callId, { caller: userId, callee: targetUserId, matchId });

    io.to(targetSocketId).emit('incoming_call', {
      callId,
      callerId: userId,
      matchId,
      offer,
      callType: callType || 'voice', // 'voice' | 'video'
    });

    socket.emit('call_ringing', { callId, targetUserId });
    console.log(`Call initiated: ${userId} → ${targetUserId} [${callId}]`);
  });

  // ── Accept a call ────────────────────────────────────────────────────────
  socket.on('call_accepted', ({ callId, answer }) => {
    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call_error', { message: 'Call not found' });
      return;
    }

    const callerSocketId = onlineUsers.get(call.caller);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', { callId, answer });
    }
    console.log(`Call accepted: ${callId}`);
  });

  // ── Reject a call ────────────────────────────────────────────────────────
  socket.on('call_rejected', ({ callId }) => {
    const call = activeCalls.get(callId);
    if (!call) return;

    const callerSocketId = onlineUsers.get(call.caller);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', { callId });
    }

    activeCalls.delete(callId);
    console.log(`Call rejected: ${callId}`);
  });

  // ── Exchange ICE candidates ──────────────────────────────────────────────
  socket.on('ice_candidate', ({ callId, candidate, targetUserId }) => {
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice_candidate', { callId, candidate });
    }
  });

  // ── End a call ───────────────────────────────────────────────────────────
  socket.on('end_call', ({ callId, matchId }) => {
    const call = activeCalls.get(callId);

    if (call) {
      const otherUserId = call.caller === userId ? call.callee : call.caller;
      const otherSocketId = onlineUsers.get(otherUserId);

      if (otherSocketId) {
        io.to(otherSocketId).emit('call_ended', { callId });
      }

      activeCalls.delete(callId);
    }

    console.log(`Call ended: ${callId}`);
  });

  // ── Call completed notification (for match deadline reset) ───────────────
  socket.on('call_completed', ({ matchId, callId }) => {
    // Notify the backend API to mark the match call as completed
    // This is handled via REST API call from the frontend after call ends
    console.log(`Call completed for match ${matchId}`);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    onlineUsers.delete(userId);

    // End any active calls for this user
    for (const [callId, call] of activeCalls.entries()) {
      if (call.caller === userId || call.callee === userId) {
        const otherUserId = call.caller === userId ? call.callee : call.caller;
        const otherSocketId = onlineUsers.get(otherUserId);

        if (otherSocketId) {
          io.to(otherSocketId).emit('call_ended', { callId, reason: 'peer_disconnected' });
        }

        activeCalls.delete(callId);
      }
    }

    console.log(`User ${userId} disconnected. Online: ${onlineUsers.size}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || process.env.SIGNALING_PORT || 5001;
server.listen(PORT, () => {
  console.log(`🎥 Signaling server running on port ${PORT}`);
});
