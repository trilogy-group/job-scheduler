-- 0004_split_per_user_admission_caps.sql
--
-- Replace the global "one PROGRESS row per user" guarantee with a bucketed
-- version: at most 1 PROGRESS row per user where gpu_count >= 8. Small jobs
-- (gpu_count < 8) are no longer constrained at the DB level; the scheduler
-- enforces a per-user small-job concurrency cap in admission code instead.
--
-- Rationale: the legacy index was the main cause of >3h queue waits in
-- production — users batch-submitting 4 small jobs would sequentially run
-- one at a time, with the 4th waiting ~12h+ behind their own queue. The new
-- split lets small jobs from the same user run concurrently, while keeping
-- the database-level safety net for big jobs where capacity overlap matters.

drop index if exists public.one_active_per_user;

create unique index if not exists one_active_big_per_user
  on public.jobs(user_id)
  where state = 'PROGRESS' and gpu_count >= 8;
