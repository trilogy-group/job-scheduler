## Context

Fireworks hosts our fine-tuning jobs — both supervised (SFT, `/supervisedFineTuningJobs`) and preference (DPO, `/dpoJobs`) — on the `trilogy` account (8 × H200, 4 GPUs per job). A team of ~10 trainers triggers jobs from agents and local scripts. Today each caller is supposed to honor "one in-progress fine-tuning job per user" and the global GPU quota, but agents behave non-deterministically and occasionally collide: duplicate per-user jobs, or simultaneous submissions that trip `training-h200-count in use: 8, quota: 8`.

We want a single choke point that owns submission: trainers enqueue, the scheduler admits jobs when it is safe to do so, and Fireworks only ever sees traffic from one service account.

Supabase already hosts other team data. Using Edge Functions + Postgres + pg_cron lets us avoid operating a separate worker.

## Goals / Non-Goals

**Goals**
- Enforce "≤1 in-progress job per user (across SFT and DPO combined)" and "GPU need ≤ live Fireworks availability" as hard invariants.
- FIFO fairness by `created_at` among eligible jobs, regardless of whether the job is SFT or DPO.
- Let trainers enqueue jobs with the exact Fireworks SFT *or* DPO body they would have used directly (pass-through).
- Observable states: `QUEUED`, `PROGRESS`, `SUCCESS`, `FAIL`, plus `CANCELLED` for user-initiated cancels.
- Minimal ops surface: no long-running worker — everything runs on Supabase.

**Non-Goals (v1)**
- Priority tiers, preemption, or deadline scheduling.
- Resumption of cancelled/failed jobs.
- A UI. V1 is HTTP + optional tiny CLI wrapper.
- Admin console for issuing API keys — bootstrap via a seed SQL script.
- Cost accounting or usage reports.

## Decisions

### D1. Runtime: Supabase Edge Functions + `pg_cron`

The HTTP API (`jobs-api`) and the scheduler loop (`scheduler-tick`) are both Deno Edge Functions. `pg_cron` calls `scheduler-tick` every 30s via `net.http_post` to the function URL with a shared secret.

- Alternatives considered: standalone Node/Python worker on Fly — rejected for v1 because it doubles the ops footprint for a loop that runs for milliseconds every 30s. Single Node server — rejected for the same reason.
- Consequence: scheduler tick runtime must stay well under the Edge Function timeout (current Supabase limit is generous for this workload — one Fireworks list call plus a handful of DB writes).

### D2. Auth: per-user API keys, hashed at rest

Each user gets one or more keys of the form `sftq_<32-bytes-base64url>`. We store only `sha256(key)` in `api_keys.key_hash` (unique index). Middleware extracts `Authorization: Bearer sftq_...`, hashes, looks up the row, and resolves `user_id`. Revocation is a soft delete (`revoked_at`).

- Alternatives considered: Supabase Auth JWTs. Rejected for v1 because the primary callers are non-interactive agents; a bearer token that doesn't expire is less friction than a magic-link login flow. JWT support can be added later without breaking API keys.
- Consequence: we own key issuance. V1 ships a `seed_users.sql` and a small `issue_key.ts` utility; keys are printed once at creation time.

### D3. Scheduler algorithm

The scheduler is **kind-agnostic**: SFT and DPO are interleaved in the same FIFO queue, share one per-user cap, and contend for the same GPU budget. Only the endpoint called differs.

Let `endpoint_for(kind)` be `/supervisedFineTuningJobs` for `SFT` and `/dpoJobs` for `DPO`.

Every tick (single Edge Function invocation):

1. **Reconcile active jobs.** For each row where `state = 'PROGRESS'` and `fireworks_job_name IS NOT NULL`, `GET {BASE}/{endpoint_for(job.kind)}/{name}`. Map Fireworks `state`:
   - `COMPLETED` → `SUCCESS`, set `completed_at`.
   - `FAILED` / `CANCELLED` → `FAIL`, set `completed_at`, store any error string.
   - anything else → leave as `PROGRESS`.
2. **Discover live GPU availability.** Hit **both** endpoints — `GET {BASE}/supervisedFineTuningJobs` *and* `GET {BASE}/dpoJobs` — filter each to non-terminal states (`CREATED`, `PENDING`, `RUNNING`, …), sum `gpu_count` across the union (fallback: 4 per job if the field is absent), subtract from configurable `FIREWORKS_GPU_QUOTA` (default 8). This is `fw_available`.
3. **Admit queued jobs.** Open a transaction. Execute:
   ```sql
   SELECT j.*
   FROM jobs j
   WHERE j.state = 'QUEUED'
     AND NOT EXISTS (
       SELECT 1 FROM jobs a
       WHERE a.user_id = j.user_id AND a.state = 'PROGRESS'
     )
   ORDER BY j.created_at ASC
   FOR UPDATE SKIP LOCKED;
   ```
   Iterate the cursor. For each candidate: if `gpu_count <= fw_available`, call Fireworks `POST {endpoint_for(j.kind)}` with the stored payload; on 200 set `state='PROGRESS'`, `started_at = now()`, `fireworks_job_name` = returned name; decrement `fw_available`. If Fireworks returns a quota error, leave the job QUEUED and bail out of admission for this tick. If Fireworks returns 4xx (bad payload), mark `FAIL` with the error body so the user can see it. Commit.

- `FOR UPDATE SKIP LOCKED` on `jobs` guarantees two overlapping ticks won't launch the same row. Users' per-user constraint is enforced by the `NOT EXISTS` subquery *inside* the same transaction plus a deferred constraint — see D4.
- Alternatives considered: polling Fireworks only at enqueue time. Rejected — we need PROGRESS → SUCCESS/FAIL transitions to surface to the user without them polling Fireworks themselves.

### D4. Data model

- `users(id uuid pk, email text unique not null, created_at timestamptz default now())`
- `api_keys(id uuid pk, user_id uuid not null references users(id), key_hash text unique not null, label text, created_at timestamptz default now(), last_used_at timestamptz, revoked_at timestamptz)`
- `jobs(id uuid pk, user_id uuid not null references users(id), kind text not null check (kind in ('SFT','DPO')), state text not null check (state in ('QUEUED','PROGRESS','SUCCESS','FAIL','CANCELLED')), display_name text, gpu_count int not null default 4 check (gpu_count > 0), fireworks_payload jsonb not null, fireworks_job_name text, error text, created_at timestamptz default now(), started_at timestamptz, completed_at timestamptz)`
- Partial unique index to enforce "at most one active job per user":
  ```sql
  CREATE UNIQUE INDEX one_active_per_user ON jobs(user_id) WHERE state = 'PROGRESS';
  ```
- Index on `(state, created_at)` for the scheduler's FIFO scan.

The partial unique index is a belt to the scheduler's suspenders: even if a race in tick logic tried to promote two jobs for the same user, the insert of the second `PROGRESS` update would fail and get rolled back.

### D5. Cancellation semantics

`DELETE /jobs/:id` behavior depends on current state:
- `QUEUED`: set `state='CANCELLED'` immediately.
- `PROGRESS`: call `POST {endpoint_for(kind)}/{name}:cancel` (SFT or DPO variant). If the endpoint does not support cancel or errors, store intent and let the reconcile step observe the cancellation. Set `state='CANCELLED'` once Fireworks confirms.
- `SUCCESS` / `FAIL` / `CANCELLED`: 409 Conflict.

### D6. Scheduler tick lock

pg_cron could double-fire if a previous tick was slow. We use a Postgres advisory lock at the top of the tick function: `pg_try_advisory_lock(7312001)`. If not acquired, return early.

### D7. Scheduler tick auth

`scheduler-tick` requires a `X-Scheduler-Secret` header equal to a Supabase-stored secret. pg_cron's `net.http_post` includes it; the function rejects requests without it. This prevents internet callers from forcing ticks.

## Risks / Trade-offs

- **Fireworks API changes.** Field names (`state`, `gpu_count`) are not versioned; SFT and DPO response shapes may drift independently. → Mitigation: parse defensively, treat unknown states as non-terminal, and alert (log) when a job stays in an unknown state for > 1h.
- **Supabase Edge Function cold starts.** Cold start on every 30s tick adds small latency. → Mitigation: acceptable at this cadence; pg_cron at 30s means ≤30s added latency from queue to submit, which is a rounding error against multi-hour training jobs.
- **pg_cron availability.** pg_cron must be enabled on the Supabase project. → Mitigation: verify during setup; if unavailable, fall back to GitHub Actions cron hitting the tick URL.
- **API key leakage.** Long-lived keys printed at creation are vulnerable to accidental commits. → Mitigation: document prefix `sftq_` so secret-scanners can match; revoke-by-id endpoint; log `last_used_at`.
- **Quota constant drift.** `FIREWORKS_GPU_QUOTA=8` is an env constant. If Fireworks grants more, we stay under-utilized until an admin updates it. → Mitigation: env var, documented in README; consider fetching quota from Fireworks if their API exposes it (currently it only surfaces it in error strings).
- **Payload pass-through trust.** Trainers can set `outputModel` or other fields to anything, potentially stomping on each other's model names. → Mitigation: v1 accepts this risk; optionally enforce a `outputModel` prefix of `accounts/trilogy/models/<user-slug>-` in a later rev.

## Migration Plan

1. Create Supabase project (or use existing), enable `pg_cron`, `pgcrypto`, and `http` extensions.
2. Run migration `0001_init.sql` (users, api_keys, jobs, indexes).
3. Seed the 10 users via `seed_users.sql` (emails only) and issue API keys via `scripts/issue_key.ts`.
4. Deploy Edge Functions `jobs-api` and `scheduler-tick`; set secrets `FIREWORKS_API_KEY`, `SCHEDULER_SECRET`, `FIREWORKS_GPU_QUOTA`.
5. Register a pg_cron job hitting the `scheduler-tick` URL every 30s.
6. Share API keys and sample `curl`/client snippet with the team. Ask everyone to switch their agent code over.
7. Rollback: delete the pg_cron job (stops admission); trainers can fall back to calling Fireworks directly while we debug.

## Open Questions

- Do Fireworks' `supervisedFineTuningJobs` and `dpoJobs` GET endpoints return a `gpu_count` on each job, or do we hardcode "4 per job"? Verify during implementation, separately for each endpoint.
- Does `POST {job}:cancel` work reliably on Fireworks SFT and DPO? The `fireworks-training` skill notes resume is unreliable; cancel may be similar. If not, document that `DELETE /jobs/:id` on a PROGRESS job marks intent and relies on the human to cancel via firectl as a backup.
- Should `gpu_count` be inferred from the payload (e.g., `baseModel` for SFT, `warmStartFrom` for DPO) instead of being user-provided? Defer until we see the range of models submitted.
- Should the API infer `kind` from payload shape (presence of `lossConfig` ⇒ DPO, else SFT) or require an explicit `kind` field? Current plan: require explicit `kind` on `POST /jobs` to avoid guessing.
