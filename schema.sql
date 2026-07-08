CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_posts_created_id ON posts (created_at, id);