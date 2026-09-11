const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, email: payload.email, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Checks the caller's role within a given workspace. Route handlers that
// perform destructive or admin-only actions should compose this after
// requireAuth.
async function requireWorkspaceRole(pool, workspaceId, userId, allowedRoles) {
  const { rows } = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  if (rows.length === 0) return false;
  return allowedRoles.includes(rows[0].role);
}

module.exports = { requireAuth, requireWorkspaceRole };
