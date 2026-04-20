-- 0001_init.sql
-- Bootstraps the users, api_keys, and jobs tables for the Fireworks
-- fine-tuning scheduler, plus the partial unique index that guarantees
-- "≤1 PROGRESS job per user" at the database level.

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "http";

--
-- users
--
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

--
-- api_keys
-- Stores sha256(plaintext) only. The plaintext token is printed once at
-- issuance and never retrievable.
--
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key_hash text unique not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);

--
-- jobs
-- One row per enqueue. `kind` partitions SFT vs DPO submissions; the
-- scheduler routes to the corresponding Fireworks endpoint. The payload
-- is stored verbatim and replayed on admission.
--
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  kind text not null check (kind in ('SFT','DPO')),
  state text not null
    check (state in ('QUEUED','PROGRESS','SUCCESS','FAIL','CANCELLED')),
  display_name text,
  gpu_count int not null default 4 check (gpu_count > 0),
  fireworks_payload jsonb not null,
  fireworks_job_name text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Belt + suspenders: even if the scheduler code races, two concurrent
-- PROGRESS updates for the same user cannot both commit.
create unique index if not exists one_active_per_user
  on public.jobs(user_id) where state = 'PROGRESS';

-- Primary scan for the scheduler's FIFO admission loop.
create index if not exists jobs_state_created_at_idx
  on public.jobs(state, created_at);

-- Useful for per-user listings and the DELETE /jobs/:id ownership check.
create index if not exists jobs_user_id_idx on public.jobs(user_id);

--
-- `kind` is immutable. Guarantee it at the DB layer so application bugs
-- can't corrupt an already-admitted job by mutating its kind.
--
create or replace function public.jobs_kind_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'jobs.kind is immutable (tried: % -> %)', old.kind, new.kind;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_kind_immutable on public.jobs;
create trigger jobs_kind_immutable
  before update on public.jobs
  for each row execute function public.jobs_kind_immutable();

--
-- Advisory lock wrappers exposed as RPCs so Edge Functions can serialise
-- overlapping scheduler ticks via supabase-js.
--
create or replace function public.scheduler_try_lock() returns boolean
language sql security definer as $$
  select pg_try_advisory_lock(7312001);
$$;

create or replace function public.scheduler_unlock() returns void
language plpgsql security definer as $$
begin
  perform pg_advisory_unlock(7312001);
end;
$$;

revoke all on function public.scheduler_try_lock() from public;
revoke all on function public.scheduler_unlock() from public;
grant execute on function public.scheduler_try_lock() to service_role;
grant execute on function public.scheduler_unlock() to service_role;
