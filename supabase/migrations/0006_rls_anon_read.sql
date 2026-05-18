-- 0006_rls_anon_read.sql
-- Adds anon-read (SELECT) RLS policies on jobs and users so the
-- dashboard can fetch live data using the JWT anon key (client-side).
-- No data exposure risk: dashboard is already public-facing; the
-- service role key was previously baking this same data into static HTML.

-- Enable RLS (idempotent for both tables)
alter table public.jobs enable row level security;
alter table public.users enable row level security;
alter table public.api_keys enable row level security;

-- Allow anonymous reads on jobs and users
create policy anon_read_jobs
  on public.jobs
  for select
  to anon
  using (true);

create policy anon_read_users
  on public.users
  for select
  to anon
  using (true);

-- api_keys: deny all anon access (key_hash must never be exposed)
-- (no policy = default deny once RLS is enabled)
