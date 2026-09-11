const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, email, username, created_at FROM users WHERE id = $1', [
      req.user.id,
    ]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
