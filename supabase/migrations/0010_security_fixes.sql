-- 0010_security_fixes.sql
-- Addresses two Supabase linter ERROR-level security findings:
--
--   1. security_definer_view (0010_security_definer_view):
--      jobs_enriched was implicitly SECURITY DEFINER (run as view owner).
--      Recreated WITH (security_invoker = true) so the querying user's
--      RLS policies and privileges apply, not the owner's.
--
--   2. rls_disabled_in_public (0013_rls_disabled_in_public):
--      deployment_replica_audit is in the public schema but had no RLS.
--      Enabled RLS; no explicit policy is added because all writes are
--      from the deployment-guard Edge Function (service_role), which
--      bypasses RLS unconditionally.

-- ── 1. Recreate jobs_enriched as SECURITY INVOKER ────────────────────

drop view if exists public.jobs_enriched;

create or replace view public.jobs_enriched
  with (security_invoker = true)
as
select
  j.id,
  j.user_id,
  j.kind,
  j.state,
  j.display_name,
  j.gpu_count,
  j.fireworks_job_name,
  j.error,
  j.created_at,
  j.started_at,
  j.completed_at,
  -- base_model: the model being fine-tuned (kind-aware)
  case j.kind
    when 'SFT' then j.fireworks_payload->>'baseModel'
    when 'DPO' then j.fireworks_payload->'trainingConfig'->>'warmStartFrom'
    when 'RFT' then j.fireworks_payload->'trainingConfig'->>'baseModel'
    else null
  end as base_model,
  -- output_model: the artifact produced (kind-aware)
  case j.kind
    when 'SFT' then j.fireworks_payload->>'outputModel'
    when 'DPO' then j.fireworks_payload->'trainingConfig'->>'outputModel'
    when 'RFT' then j.fireworks_payload->'trainingConfig'->>'outputModel'
    else null
  end as output_model,
  -- dataset: top-level for all kinds
  j.fireworks_payload->>'dataset' as dataset,
  -- failure_class: parse prefix of error text (NULL for non-FAIL rows)
  case
    when j.state <> 'FAIL' then null
    when j.error like 'Fireworks 4%' then 'client_error'
    when j.error like 'Fireworks 5%' then 'server_error'
    when j.error like 'cancelled externally%' then 'external_cancel'
    when j.error is not null then 'other'
    else null
  end as failure_class,
  -- raw payload for pass-through access
  j.fireworks_payload
from public.jobs j;

-- ── 2. Enable RLS on deployment_replica_audit ────────────────────────

alter table public.deployment_replica_audit enable row level security;
