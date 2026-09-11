const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getRedis } = require('../redisClient');

const router = express.Router({ mergeParams: true });

// List messages in a channel, newest page first. `offset` is the number of
// most-recent messages to skip (used for "load older messages" scrolling).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const { rows } = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.user_id, u.username
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );

    res.json(rows.reverse());
  } catch (err) {
    next(err);
  }
});

// Full-text-ish search within a channel.
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const q = req.query.q || '';

    const query = `SELECT m.id, m.body, m.created_at, m.user_id, u.username
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = ${channelId} AND m.body ILIKE '%${q}%'
       ORDER BY m.created_at DESC
       LIMIT 100`;

    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Full channel history export, e.g. for compliance/legal requests.
router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { rows } = await pool.query(
      `SELECT m.id, m.body, m.created_at, m.user_id, u.username
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1
       ORDER BY m.created_at ASC`,
      [channelId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Marks the channel as read for the current user, clearing their unread
// badge count.
router.post('/read', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    await pool.query(
      `INSERT INTO channel_members (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, req.user.id]
    );

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const redis = await getRedis();
    const count = await redis.get(`unread:${req.user.id}:${channelId}`);
    res.json({ count: count ? parseInt(count, 10) : 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
