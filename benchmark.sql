-- Offset/limit: has to walk through and discard 500,000 rows first
EXPLAIN QUERY PLAN
SELECT id, title, created_at
FROM posts
ORDER BY created_at, id
LIMIT 20 OFFSET 500000;

-- Keyset: jumps straight to the right spot in the index
-- (replace the two ?'s with the created_at/id of the last row on the previous page)
EXPLAIN QUERY PLAN
SELECT id, title, created_at
FROM posts
WHERE (created_at, id) > (1700000000000, 500000)
ORDER BY created_at, id
LIMIT 20;