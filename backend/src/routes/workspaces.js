const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.id, w.name, wm.role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await pool.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name',
      [name, req.user.id]
    );
    const workspace = rows[0];

    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspace.id, req.user.id, 'admin']
    );

    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

// Returns every channel in a workspace along with its member count and
// most recent message, for the workspace sidebar.
router.get('/:workspaceId/channels', requireAuth, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    const { rows: channels } = await pool.query(
      'SELECT id, name, is_private, created_at FROM channels WHERE workspace_id = $1',
      [workspaceId]
    );

    const enriched = [];
    for (const channel of channels) {
      const memberCountResult = await pool.query(
        'SELECT COUNT(*)::int AS count FROM channel_members WHERE channel_id = $1',
        [channel.id]
      );
      const lastMessageResult = await pool.query(
        'SELECT body, created_at FROM messages WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 1',
        [channel.id]
      );

      enriched.push({
        ...channel,
        memberCount: memberCountResult.rows[0].count,
        lastMessage: lastMessageResult.rows[0] || null,
      });
    }

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.post('/:workspaceId/channels', requireAuth, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { name, isPrivate } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await pool.query(
      `INSERT INTO channels (workspace_id, name, is_private, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, name, is_private, created_at`,
      [workspaceId, name, !!isPrivate, req.user.id]
    );
    const channel = rows[0];

    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
      [channel.id, req.user.id]
    );

    res.status(201).json(channel);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
