# Step 5: VERIFY

No code or schema change here — this is a pause to confirm it's actually
safe to stop touching `email` before step 6 removes it from the app, and
step 7 drops it for good.

Things to check:

- **Monitor the app** for a while with step 4's code running in production.
  Confirm reads/writes behave correctly under real traffic.
- **Check for any other writer of `email`** you might have missed:
  other services, cron jobs, admin scripts, ETL/analytics pipelines,
  anything with direct DB access. If something writes `email` directly
  and skips `email_address`, step 6 (and step 7) will silently break it.
- **Spot-check for drift** between the two columns — if anything ever wrote
  to `email` without also writing `email_address`, they'll disagree:

```sql
SELECT count(*) FROM users WHERE email IS DISTINCT FROM email_address;
```

  This should be zero. If it's not, find and fix the stray writer before
  moving on — don't proceed to step 6 with unexplained drift.

Only once you're confident nothing but the app (already migrated in step 4)
depends on `email` do you move to step 6.
