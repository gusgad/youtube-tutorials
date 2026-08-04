// Step 6: contract app code
// ============================
// Deploy app code that only touches email_address. `email` is now fully
// unused by the app — but it still exists in the schema, so a rollback to
// any earlier step is still possible.

const { Pool } = require('pg');
const pool = new Pool();

async function updateUserEmail(userId, newEmail) {
  await pool.query(
    'UPDATE users SET email_address = $1 WHERE id = $2',
    [newEmail, userId] // email is no longer written at all
  );
}

async function getUserEmail(userId) {
  const { rows } = await pool.query(
    'SELECT email_address FROM users WHERE id = $1',
    [userId]
  );
  return rows[0].email_address;
}

module.exports = { updateUserEmail, getUserEmail };
