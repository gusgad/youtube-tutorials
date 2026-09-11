const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db/pool');
const { getRedis } = require('../redisClient');
const { publishNotification } = require('../queue/publisher');

// Tracks which users are currently connected. This lives in the process's
// memory, which is simplest and fastest since we don't need to hit Redis
// on every heartbeat.
const onlineUsers = new Map(); // userId -> Set of socket ids

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = jwt.verify(token, config.jwt.secret);
      socket.user = { id: payload.sub, username: payload.username };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;

    if (!onlineUsers.has(user.id)) onlineUsers.set(user.id, new Set());
    onlineUsers.get(user.id).add(socket.id);
    io.emit('presence', { userId: user.id, online: true });

    socket.on('join_channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave_channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing', { channelId, userId: user.id, username: user.username });
    });

    socket.on('send_message', async ({ channelId, body }, ack) => {
      try {
        if (!body || !body.trim()) return;

        const { rows } = await pool.query(
          `INSERT INTO messages (channel_id, user_id, body)
           VALUES ($1, $2, $3)
           RETURNING id, channel_id, user_id, body, created_at`,
          [channelId, user.id, body]
        );
        const message = { ...rows[0], username: user.username };

        await pool.query('UPDATE channels SET last_message_at = $1 WHERE id = $2', [
          message.created_at,
          channelId,
        ]);

        // Bump unread counters for every member of the channel so their
        // sidebar badge updates in real time.
        const redis = await getRedis();
        const { rows: members } = await pool.query(
          'SELECT user_id FROM channel_members WHERE channel_id = $1',
          [channelId]
        );
        for (const member of members) {
          if (member.user_id === user.id) continue;
          await redis.incr(`unread:${member.user_id}:${channelId}`);
        }

        await publishNotification({
          type: 'new_message',
          channelId,
          messageId: message.id,
          authorId: user.id,
          recipientIds: members.map((m) => m.user_id).filter((id) => id !== user.id),
        });

        // Broadcast to everyone connected, so the UI updates instantly no
        // matter which channel they're currently viewing.
        io.emit('new_message', message);

        if (ack) ack({ ok: true, message });
      } catch (err) {
        console.error('send_message failed:', err);
        if (ack) ack({ ok: false, error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(user.id);
          io.emit('presence', { userId: user.id, online: false });
        }
      }
    });
  });
}

module.exports = { registerSocketHandlers, onlineUsers };
