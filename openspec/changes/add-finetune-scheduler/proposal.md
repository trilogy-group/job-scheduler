## Why

A team of ~10 trainers currently submits fine-tuning jobs (SFT and DPO) directly against Fireworks. They self-enforce "at most one *in-progress* fine-tuning job per person" (queue depth is unlimited) and the 8-H200 global quota, but agent non-determinism means these rules get violated. We need a mechanical scheduler that owns job submission, guarantees per-user fairness, and respects the live Fireworks GPU budget across both fine-tuning endpoints.

## What Changes

- Introduce a Supabase-backed queue for Fireworks fine-tuning jobs with states `QUEUED`, `PROGRESS`, `SUCCESS`, `FAIL` (plus `CANCELLED` for user-initiated stops).
- A single `jobs` table with a `kind` column (`SFT` or `DPO`) — unified queue, unified scheduling, separate Fireworks endpoints under the hood.
- Add HTTP endpoints (Supabase Edge Functions) for `POST /jobs` (enqueue), `GET /jobs` (list/status), `GET /jobs/:id`, and `DELETE /jobs/:id` (dequeue/cancel).
- Accept the raw Fireworks SFT or DPO request body as the job payload — the scheduler passes it through verbatim when launching.
- Authenticate trainers with per-user API keys stored (hashed) in Supabase. Issue keys out-of-band for the initial 10 users.
- Add a scheduler tick (Edge Function driven by `pg_cron` every ~30s) that:
  1. Reconciles `PROGRESS` jobs against the corresponding Fireworks endpoint (`/supervisedFineTuningJobs` for SFT, `/dpoJobs` for DPO), transitioning to `SUCCESS` / `FAIL`.
  2. Computes live GPU availability by listing active jobs on **both** Fireworks endpoints and summing.
  3. Among `QUEUED` jobs whose user has no active job and whose GPU need ≤ available, selects the earliest `created_at` and submits it to the correct Fireworks endpoint using a shared service account key.
- Ship a simple CLI/HTTP client example so existing agents can switch from calling Fireworks directly to calling the scheduler.

## Capabilities

### New Capabilities

- `finetune-job-queue`: user-facing HTTP API and persisted job records for SFT and DPO jobs (enqueue, list, status, cancel).
- `fair-scheduler`: the pg_cron-driven tick that enforces FIFO, per-user concurrency = 1 (across SFT and DPO), and GPU-budget admission against live Fireworks state on both endpoints.
- `user-api-keys`: per-user API keys (issue, hash-at-rest, verify, revoke) used to authenticate trainer requests.

### Modified Capabilities

_None — greenfield repo._

## Impact

- New Supabase project with tables `users`, `api_keys`, `jobs`, and `pg_cron` jobs calling the scheduler tick function.
- New Deno-based Edge Functions under `supabase/functions/` for `jobs-api` and `scheduler-tick`.
- New env/secret `FIREWORKS_API_KEY` (service-account Fireworks key) stored as a Supabase secret.
- Trainers' agents must switch from direct Fireworks fine-tuning create calls (SFT *and* DPO) to `POST /jobs` on the scheduler. Polling Fireworks for job status is replaced by `GET /jobs/:id`.
- No changes to existing Fireworks datasets or deployments — this change is strictly additive at the fine-tuning-job layer.
