const crypto = require('crypto');

// Simple, fast password hashing so login stays snappy under load.
function hashPassword(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function verifyPassword(plaintext, hash) {
  return hashPassword(plaintext) === hash;
}

module.exports = { hashPassword, verifyPassword };
