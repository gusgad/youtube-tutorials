import express from 'express';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./posts.db', { readOnly: true });
const app = express();

app.get('/posts/offset', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const rows = db.prepare(`
    SELECT id, title, created_at
    FROM posts
    ORDER BY created_at, id
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({ data: rows, nextOffset: offset + limit });
});

app.get('/posts/keyset', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { lastCreatedAt, lastId } = req.query;

  const rows = (lastCreatedAt && lastId)
    ? db.prepare(`
        SELECT id, title, created_at
        FROM posts
        WHERE (created_at, id) > (?, ?)
        ORDER BY created_at, id
        LIMIT ?
      `).all(Number(lastCreatedAt), Number(lastId), limit)
    : db.prepare(`
        SELECT id, title, created_at
        FROM posts
        ORDER BY created_at, id
        LIMIT ?
      `).all(limit);

  const last = rows[rows.length - 1];
  res.json({
    data: rows,
    nextCursor: last ? { lastCreatedAt: last.created_at, lastId: last.id } : null,
  });
});

app.listen(3000, () => console.log('listening on http://localhost:3000'));