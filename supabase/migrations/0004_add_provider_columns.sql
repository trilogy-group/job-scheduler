-- 0004_add_provider_columns.sql
-- Add provider-aware columns to jobs table for multi-provider routing.
-- Maintains backward compatibility with legacy fireworks_payload.

-- Add provider column (default 'fireworks' for existing jobs)
alter table public.jobs add column if not exists provider text not null default 'fireworks'
  check (provider in ('fireworks', 'primeintellect'));

-- Add provider-specific payload (nullable; falls back to fireworks_payload for legacy)
alter table public.jobs add column if not exists provider_payload jsonb;

-- Add provider job ID for tracking remote job handles
alter table public.jobs add column if not exists provider_job_id text;

-- Rename the partial unique index to include provider for per-provider concurrency
-- (user can have 1 PROGRESS job per provider)
drop index if exists one_active_per_user;
create unique index one_active_per_user_provider
  on public.jobs(user_id, provider) where state = 'PROGRESS';

-- Index for per-provider FIFO admission scans
create index if not exists jobs_provider_state_created_at_idx
  on public.jobs(provider, state, created_at);

-- Index for looking up jobs by provider job ID
create index if not exists jobs_provider_job_id_idx
  on public.jobs(provider_job_id) where provider_job_id is not null;

-- Update the jobs_kind_immutable trigger to also enforce provider immutability
-- (a job admitted to one provider cannot switch)
create or replace function public.jobs_kind_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'jobs.kind is immutable (tried: % -> %)', old.kind, new.kind;
  end if;
  if new.provider is distinct from old.provider then
    raise exception 'jobs.provider is immutable (tried: % -> %)', old.provider, new.provider;
  end if;
  return new;
end;
$$;
