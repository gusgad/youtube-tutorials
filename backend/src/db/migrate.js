const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { hashPassword } = require('../utils/password');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrations applied.');

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) {
    console.log('Seed data already present, skipping seed.');
    await pool.end();
    return;
  }

  console.log('Seeding demo data...');

  const users = [
    { email: 'alice@chatterbox.dev', username: 'alice', password: 'password123' },
    { email: 'bob@chatterbox.dev', username: 'bob', password: 'password123' },
    { email: 'carol@chatterbox.dev', username: 'carol', password: 'password123' },
  ];

  const userIds = [];
  for (const u of users) {
    const { rows } = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [u.email, u.username, hashPassword(u.password)]
    );
    userIds.push(rows[0].id);
  }
  const [aliceId, bobId, carolId] = userIds;

  const { rows: wsRows } = await pool.query(
    'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id',
    ['Acme Corp', aliceId]
  );
  const workspaceId = wsRows[0].id;

  await pool.query(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $5)',
    [workspaceId, aliceId, 'admin', bobId, 'member', carolId]
  );

  const { rows: chRows } = await pool.query(
    `INSERT INTO channels (workspace_id, name, is_private, created_by) VALUES
      ($1, 'general', false, $2),
      ($1, 'random', false, $2),
      ($1, 'exec-private', true, $2)
      RETURNING id, name`,
    [workspaceId, aliceId]
  );

  const general = chRows.find((c) => c.name === 'general');
  const random = chRows.find((c) => c.name === 'random');
  const execPrivate = chRows.find((c) => c.name === 'exec-private');

  await pool.query(
    `INSERT INTO channel_members (channel_id, user_id) VALUES
      ($1, $2), ($1, $3), ($1, $4),
      ($5, $2), ($5, $3), ($5, $4),
      ($6, $2)`,
    [general.id, aliceId, bobId, carolId, random.id, execPrivate.id]
  );

  await pool.query(
    `INSERT INTO messages (channel_id, user_id, body) VALUES
      ($1, $2, 'Welcome to #general!'),
      ($1, $3, 'Hey everyone 👋'),
      ($4, $2, 'This channel is just for private exec chatter.')`,
    [general.id, aliceId, bobId, execPrivate.id]
  );

  console.log('Seed complete. Demo users (password: password123):', users.map((u) => u.email).join(', '));
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
