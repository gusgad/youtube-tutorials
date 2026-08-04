-- Step 1: EXPAND
-- Add the new column. Nullable, no default enforcement, no backfill yet.
-- This is a fast metadata-only change on most databases (Postgres, MySQL 8+),
-- so it's safe to run against a live table without a long lock.

ALTER TABLE users ADD COLUMN email_address VARCHAR(255) NULL;

-- Deliberately NOT doing here:
--   * NOT NULL            -- existing rows have no value yet
--   * DEFAULT              -- would rewrite the whole table on some engines
--   * UNIQUE / index       -- add once the column is fully populated (step 5+)
