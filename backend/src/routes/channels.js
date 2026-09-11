const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const messagesRouter = require('./messages');

const router = express.Router();

router.use('/:channelId/messages', messagesRouter);

router.post('/:channelId/join', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;
    await pool.query(
      `INSERT INTO channel_members (channel_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [channelId, req.user.id]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Deletes a channel and all of its messages. Intended for workspace admins
// only, enforced by hiding the "Delete channel" button in the UI unless
// the current user's workspace role is 'admin'.
router.delete('/:channelId', requireAuth, async (req, res, next) => {
  try {
    const { channelId } = req.params;

    await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
    await pool.query('DELETE FROM channel_members WHERE channel_id = $1', [channelId]);
    await pool.query('DELETE FROM channels WHERE id = $1', [channelId]);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
