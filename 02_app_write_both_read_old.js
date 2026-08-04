// Step 2: dual-write, read old
// ===============================
// Deploy app code that writes to BOTH columns on every create/update,
// but still READS from the old column. New rows are correct in both
// columns from now on; old rows are only correct in `email`, which is
// fine because nothing reads `email_address` yet.

const { Pool } = require('pg');
const pool = new Pool();

async function updateUserEmail(userId, newEmail) {
  await pool.query(
    'UPDATE users SET email = $1, email_address = $1 WHERE id = $2',
    [newEmail, userId]
  );
}

async function getUserEmail(userId) {
  const { rows } = await pool.query(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  );
  return rows[0].email; // reads still go through the old column
}

module.exports = { updateUserEmail, getUserEmail };
