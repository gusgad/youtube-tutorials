# Expand-Contract: renaming a column with zero downtime

The problem: you can't just `ALTER TABLE users RENAME COLUMN email TO email_address`
and redeploy app code at the same instant. During a rolling deploy, old app
instances and new app instances run **side by side** for minutes (sometimes
longer). If the migration and the code deploy aren't decoupled, one of the two
versions is always broken.

The fix is to split one risky change into several small, individually-safe
steps. At every step, both the old and new app code must work against
whatever the schema looks like at that moment. This is "expand-contract":
first you **expand** the schema to support both old and new, then once
everything is migrated over, you **contract** it back down.

Example used throughout: table `users`, renaming column `email` to
`email_address`.

| Step | File | What changes |
|---|---|---|
| 1 | [`01_migration_add_new_column.sql`](01_migration_add_new_column.sql) | DB migration: add `email_address`, nullable |
| 2 | [`02_app_write_both_read_old.js`](02_app_write_both_read_old.js) | Deploy: app writes both columns, reads `email` |
| 3 | [`03_backfill_new_column.sql`](03_backfill_new_column.sql) | Batch job: fill `email_address` for existing rows |
| 4 | [`04_app_read_new_write_both.js`](04_app_read_new_write_both.js) | Deploy: app reads `email_address`, still writes both |
| 5 | [`05_verify.md`](05_verify.md) | No deploy: verify nothing still depends on `email` |
| 6 | [`06_app_only_new_column.js`](06_app_only_new_column.js) | Deploy: app only touches `email_address` |
| 7 | [`07_migration_drop_old_column.sql`](07_migration_drop_old_column.sql) | DB migration: drop `email` |

## Why the order matters

- **Step 1 before step 2**: the column must exist before any app instance can
  write to it. Nullable + no default enforcement means adding it is a fast,
  safe, non-locking metadata change on most databases.
- **Step 2 before step 3**: the backfill only needs to catch rows written
  *before* the dual-write code went live. Any row written after step 2
  already has both columns populated.
- **Step 4 keeps writing to `email`, not just reading from `email_address`**:
  this is the safety net. If step 4's read path has a bug, you can roll back
  to step 2/3's code and `email` is still correct and current.
- **Step 5 is a pause, not a deploy**: you're watching production — logs,
  query stats, anything that flags reads/writes against `email` — to make
  sure no forgotten job, replica consumer, or analytics query still needs it.
- **Step 6 before step 7**: nothing may write to `email` anymore before you
  drop it, or that writer starts failing loudly the moment the column is gone.
- **Step 7 last**: dropping a column is the one truly irreversible step, so
  it's pushed to the very end, after everything else has been proven safe.

## Rollback story at each step

This is the other half of why expand-contract exists: at every step, rolling
back the *previous* app deploy is safe, because the schema from the prior
step is still fully intact.

- Bad step 2 deploy → roll back to pre-step-1 app code. `email` still has all
  the data, `email_address` just goes unused. No data loss.
- Bad step 4 deploy → roll back to step 2 app code. Both columns are still
  kept in sync by the old code.
- Bad step 6 deploy → roll back to step 4 app code. `email` was never
  dropped, so it's still there and current.

Once step 7 runs, you're committed — which is exactly why it's gated behind
step 5's verification.
