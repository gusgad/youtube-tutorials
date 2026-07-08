import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const DB_PATH = './posts.db';
const ROW_COUNT = 1_000_000;

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec(fs.readFileSync('./schema.sql', 'utf8'));

const insert = db.prepare(`INSERT INTO posts (title, created_at) VALUES (?, ?)`);
const baseTime = Date.now() - ROW_COUNT * 1000;

console.log(`Seeding ${ROW_COUNT.toLocaleString()} rows...`);
db.exec('BEGIN');
for (let i = 0; i < ROW_COUNT; i++) {
  insert.run(`Post #${i}`, baseTime + i * 1000);
}
db.exec('COMMIT');

console.log('Done.');
db.close();