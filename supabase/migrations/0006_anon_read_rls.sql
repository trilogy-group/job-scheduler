-- 0006_anon_read_rls.sql
-- Enable RLS and grant anon SELECT access to public-facing tables.
-- The dashboard is public-facing, so no row filtering is required.

-- ----------------------------------------------------------------------------
-- public.jobs
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_jobs" ON public.jobs;
CREATE POLICY "anon_read_jobs"
  ON public.jobs
  FOR SELECT
  TO anon
  USING (true);

-- ----------------------------------------------------------------------------
-- public.users
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_users" ON public.users;
CREATE POLICY "anon_read_users"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- ----------------------------------------------------------------------------
-- public.scheduler_ticks (kept consistent with the other public read tables)
-- ----------------------------------------------------------------------------
ALTER TABLE public.scheduler_ticks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_scheduler_ticks" ON public.scheduler_ticks;
CREATE POLICY "anon_read_scheduler_ticks"
  ON public.scheduler_ticks
  FOR SELECT
  TO anon
  USING (true);
