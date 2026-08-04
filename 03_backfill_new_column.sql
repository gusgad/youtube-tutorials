-- Step 3: BACKFILL
-- Populate email_address for rows that existed before step 2's dual-write
-- code went live. Runs as a background job, in small batches, so it never
-- holds a long lock or competes heavily with live traffic.
--
-- Safe to re-run / resume: only touches rows where the new column is still
-- unset, so a crashed job just picks up where it left off.

UPDATE users
SET email_address = email
WHERE email_address IS NULL
  AND id IN (
      SELECT id FROM users
      WHERE email_address IS NULL
      ORDER BY id
      LIMIT 1000
  );

-- The job driving this query loops until it updates 0 rows, with a short
-- sleep between batches to keep load on the database low.
