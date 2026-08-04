// Step 4: read new, still dual-write
// =====================================
// Once the backfill has finished, deploy app code that READS from the new
// column, but keep writing to both. Writing to both is a safety net: if a
// bug is found in the new read path and you roll back to step 2's code,
// `email` is still up to date and nothing is lost.

const { Pool } = require('pg');
const pool = new Pool();

async function updateUserEmail(userId, newEmail) {
  await pool.query(
    'UPDATE users SET email = $1, email_address = $1 WHERE id = $2',
    [newEmail, userId] // email is still written, as a safety net
  );
}

async function getUserEmail(userId) {
  const { rows } = await pool.query(
    'SELECT email_address FROM users WHERE id = $1',
    [userId]
  );
  return rows[0].email_address; // reads now go through the new column
}

module.exports = { updateUserEmail, getUserEmail };
