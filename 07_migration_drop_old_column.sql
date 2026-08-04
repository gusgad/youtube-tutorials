-- Step 7: CONTRACT
-- Drop the old column. Safe now because step 6's app code is the only
-- writer/reader of user data, and it hasn't touched `email` since deploy.
-- This is the one irreversible step in the whole sequence, which is why
-- it's last and gated behind step 5's verification.

ALTER TABLE users DROP COLUMN email;
