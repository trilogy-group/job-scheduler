## 1. Project scaffolding

- [ ] 1.1 Initialise `supabase/` project (`supabase init`) and commit `config.toml`
- [ ] 1.2 Add repo-root `README.md` with setup, run, and deploy steps
- [ ] 1.3 Add `.env.example` listing `FIREWORKS_API_KEY`, `FIREWORKS_GPU_QUOTA`, `SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 1.4 Add `.gitignore` covering `.env`, `supabase/.branches`, `node_modules`, Deno cache

## 2. Database schema

- [ ] 2.1 Write migration `supabase/migrations/0001_init.sql` creating `users`, `api_keys`, `jobs` (with `kind` column)
- [ ] 2.2 Add check constraints on `jobs.state` (`{QUEUED, PROGRESS, SUCCESS, FAIL, CANCELLED}`) and `jobs.kind` (`{SFT, DPO}`)
- [ ] 2.3 Add partial unique index `unique(user_id) where state = 'PROGRESS'` (spans kinds)
- [ ] 2.4 Add btree index on `jobs(state, created_at)` for the FIFO scan
- [ ] 2.5 Enable `pg_cron`, `pgcrypto`, `http` extensions in the migration
- [ ] 2.6 Add trigger or application guard preventing `kind` mutation after insert

## 3. User & API key management

- [ ] 3.1 Write `scripts/seed_users.ts` that inserts the initial 10 team emails
- [ ] 3.2 Write `scripts/issue_key.ts` (Deno or Node) that creates a random `sftq_...` token, inserts its sha256 hash, prints plaintext once
- [ ] 3.3 Write `scripts/revoke_key.ts` that sets `revoked_at = now()` for a key id
- [ ] 3.4 Unit-test the token-hash round-trip (token in → hash in DB → lookup resolves same user_id)

## 4. jobs-api Edge Function

- [ ] 4.1 Scaffold `supabase/functions/jobs-api/index.ts` with a tiny router (Hono or hand-rolled switch on path+method)
- [ ] 4.2 Implement `authMiddleware`: parse `Authorization: Bearer`, sha256, look up `api_keys`, reject revoked, update `last_used_at`
- [ ] 4.3 Implement `POST /jobs`: validate `kind in {SFT, DPO}`, validate body, insert `QUEUED`, return `{id, kind, state, created_at}`
- [ ] 4.4 Implement `GET /jobs` (optional `?state=` and `?kind=` filters) and `GET /jobs/:id` (404 for not-owned)
- [ ] 4.5 Implement `DELETE /jobs/:id` with state-machine guard (QUEUED → CANCELLED; PROGRESS → call Fireworks cancel *for matching kind* then CANCELLED; terminal → 409)
- [ ] 4.6 Integration tests against a local Supabase, hitting every endpoint (both `kind = SFT` and `kind = DPO`) and asserting 404/401 boundaries

## 5. Fireworks client

- [ ] 5.1 Write `supabase/functions/_shared/fireworks.ts` exposing `createJob(kind, payload)`, `getJob(kind, name)`, `listActiveJobs(kind)`, `cancelJob(kind, name)` — `kind` routes to `/supervisedFineTuningJobs` or `/dpoJobs`
- [ ] 5.2 Use `Authorization: Bearer ${FIREWORKS_API_KEY}` against `https://api.fireworks.ai/v1/accounts/trilogy/`
- [ ] 5.3 Parse `state` values defensively for both endpoints; define `TERMINAL_STATES = {COMPLETED, FAILED, CANCELLED}`
- [ ] 5.4 Implement GPU-need extraction with a fallback of 4 if Fireworks does not return per-job `gpu_count`; verify behaviour separately for SFT and DPO response shapes
- [ ] 5.5 Provide `listActiveJobsAllKinds()` that fans out to both endpoints and returns a combined list for GPU accounting
- [ ] 5.6 Unit-test each client method with `fetch` mocked; include fixtures for SFT + DPO success, SFT + DPO quota error, and cancel paths

## 6. scheduler-tick Edge Function

- [ ] 6.1 Scaffold `supabase/functions/scheduler-tick/index.ts`; require `X-Scheduler-Secret` header matching env
- [ ] 6.2 Acquire Postgres advisory lock (`pg_try_advisory_lock(7312001)`); on failure, return `200 {skipped:true}`
- [ ] 6.3 Reconcile loop: for each `PROGRESS` job, call `getJob(job.kind, …)`, map to `SUCCESS`/`FAIL`, update row
- [ ] 6.4 Compute `fw_available = FIREWORKS_GPU_QUOTA - sum(gpu_count across listActiveJobsAllKinds())`
- [ ] 6.5 Admission loop: open transaction, `SELECT ... FOR UPDATE SKIP LOCKED` on eligible QUEUED rows in FIFO order (ignoring `kind`), attempt each, commit
- [ ] 6.6 Submit via `createJob(job.kind, payload)`; on success set `PROGRESS` + `fireworks_job_name`; on quota-error stop iteration; on other 4xx set `FAIL`
- [ ] 6.7 Release advisory lock in `finally`; return structured JSON summary `{reconciled, admitted, skipped, by_kind: {SFT: …, DPO: …}}`
- [ ] 6.8 Integration test: mix SFT + DPO jobs across 3 users × 2 jobs each, simulate both Fireworks endpoints with a stub, verify admission order and per-user cap is respected across kinds

## 7. pg_cron wiring

- [ ] 7.1 Migration `0002_schedule_tick.sql` registering a `pg_cron` job that runs every 30s
- [ ] 7.2 The cron body uses `net.http_post` to the `scheduler-tick` URL with header `X-Scheduler-Secret`
- [ ] 7.3 Document how to pause the tick in prod (`cron.unschedule(...)`) in README

## 8. Client example & rollout

- [ ] 8.1 Write `examples/enqueue_sft.sh` — curl example that POSTs a real SFT body with `kind: "SFT"` using `SFTQ_API_KEY`
- [ ] 8.2 Write `examples/enqueue_dpo.sh` — curl example for `kind: "DPO"`
- [ ] 8.3 Write `examples/enqueue.py` — Python client covering both kinds, for agent integration
- [ ] 8.4 Update repo README with the rollout checklist (provision Supabase, apply migrations, deploy functions, issue keys, swap agents for *both* SFT and DPO paths)

## 9. Operational

- [ ] 9.1 Add `scripts/dump_state.ts` that prints the current `jobs` table (including `kind`) for oncall debugging
- [ ] 9.2 Add a metric/log line in `scheduler-tick` summarising `{queued, progress, succeeded, failed, fw_available, by_kind}` per tick
- [ ] 9.3 Document failure modes in README: Fireworks SFT or DPO down independently, pg_cron down, quota exhausted, bad payload
