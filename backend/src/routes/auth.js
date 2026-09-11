const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');
const { hashPassword, verifyPassword } = require('../utils/password');

const router = express.Router();

function signToken(user) {
  // No `expiresIn` set: once issued, a token is valid forever.
  return jwt.sign({ sub: user.id, email: user.email, username: user.username }, config.jwt.secret);
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { rows } = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, username, hashPassword(password)]
    );

    const user = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
