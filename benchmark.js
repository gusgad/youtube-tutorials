import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';

const db = new DatabaseSync('./posts.db', { readOnly: true });

const PAGE_SIZE = 20;
const DEPTHS = [100, 1000, 10000, 100000, 500000, 900000];
const RUNS = 20;

function timeRuns(fn) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

console.log('depth'.padEnd(10), 'offset (ms)'.padEnd(14), 'keyset (ms)'.padEnd(14), 'speedup');

for (const depth of DEPTHS) {
  const cursor = db.prepare(`
    SELECT id, created_at FROM posts
    ORDER BY created_at, id
    LIMIT 1 OFFSET ?
  `).get(depth);

  const offsetMs = timeRuns(() => {
    db.prepare(`
      SELECT id, title, created_at
      FROM posts
      ORDER BY created_at, id
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, depth);
  });

  const keysetMs = timeRuns(() => {
    db.prepare(`
      SELECT id, title, created_at
      FROM posts
      WHERE (created_at, id) > (?, ?)
      ORDER BY created_at, id
      LIMIT ?
    `).all(cursor.created_at, cursor.id, PAGE_SIZE);
  });

  console.log(
    String(depth).padEnd(10),
    offsetMs.toFixed(3).padEnd(14),
    keysetMs.toFixed(3).padEnd(14),
    `${(offsetMs / keysetMs).toFixed(1)}x`
  );
}

db.close();