# Second-Brain Handoff — job-scheduler

**Date:** 2026-05-20
**Project:** job-scheduler
**Scope:** Analytics endpoints sprint for `jobs-api` Edge Function

---

## What shipped

Three new authenticated analytics endpoints on the `jobs-api` Supabase Edge Function. All use the existing `sftq_*` API key auth pattern — no new auth surface.

- **`GET /analytics/queue`** — caller's in-PROGRESS job + caller's QUEUED jobs with FIFO positions + global queue depth and GPUs-in-use.
- **`GET /analytics/summary`** — per-user lifetime stats: `by_state`, `by_kind`, `success_rate`, `avg_run_duration_seconds`, `total_gpu_hours`, `recent_failures`.
- **`GET /jobs/:id/analytics`** — per-job timeline: `queue_wait_seconds`, `run_duration_seconds`, `gpu_hours`.

Status: committed locally at `3df7d3a`. Not pushed. Not deployed.

---

## Code map

- `supabase/functions/jobs-api/analytics.ts` — pure handlers, no Deno-specific APIs; fully exported so Node tests can import directly.
- `supabase/functions/jobs-api/index.ts` — routing wired for `GET /analytics/queue`, `GET /analytics/summary`, `GET /jobs/:id/analytics`.
- `tests/jobs-api.analytics.test.js` — 12 unit tests using Node's built-in test runner; mock db builder pattern.

---

## Tests

- `npm test`: **63 pass / 0 fail** (51 pre-existing + 12 new analytics).
- New coverage: empty state, queue positions, FIFO ordering, duration math, user isolation, null safety, error propagation, 401 auth paths.
- Runs under Node — no Deno runtime required for the unit layer.

---

## Still to do

Open Beads tickets:

- **`job-scheduler-ykza`** (A-pr) — push `feat/analytics-tests` branch + open PR.
- **`job-scheduler-o8dk`** (B-smoke) — live smoke test all 3 analytics endpoints against prod Supabase with a real `sftq_` key.
- **`job-scheduler-55mz`** (C-skill) — bump `finetune-queue` plugin to v0.3.0 and add analytics sub-commands to `SKILL.md`.
- **`job-scheduler-aym6`** (C-pr) — push `feat/skill-v0.3.0` branch + PR.

---

## Decisions / gotchas

- **Handlers extracted to `analytics.ts`** rather than inlined in `index.ts`. Reason: lets Node import the handlers for unit tests without spinning up Deno. Trade-off: small extra file, but unlocks fast local CI.
- **Queue position is an approximation.** Computed by counting QUEUED jobs from other users with an earlier `created_at` — not true slot/scheduler math. Sufficient for display; documented as approximate in the handler.
- **No new DB migrations.** All queries hit existing columns on the `jobs` table. Zero schema risk for this change.
- **Auth model unchanged.** Reuses the existing `sftq_*` API key middleware — no new key types, scopes, or RLS edits introduced by this sprint.

---

## Production gates

This change is **not live**. To ship:

1. **Push branch** — `git push origin feat/analytics-tests` (ticket `ykza`).
2. **Open PR** — review + merge to `main`.
3. **Redeploy Edge Function** — `supabase functions deploy jobs-api` against prod project. Analytics endpoints are inert until this runs.
4. **Live smoke** — exercise all 3 endpoints with a real `sftq_` key against prod (ticket `o8dk`). Confirm queue positions, summary math, and per-job timeline match expectations.
5. **Plugin + skill bump** — ship `finetune-queue` v0.3.0 with the new sub-commands (tickets `55mz`, `aym6`) so CLI users can hit the endpoints without curl.

Unrelated but adjacent gate worth remembering:

- **`0006_rls_anon_read.sql`** is on `main` but `supabase db push` is still **pending explicit user approval**. Not blocking analytics, but it lives in the same deploy surface — don't accidentally push it as part of an analytics rollout.

---

## Unaffected surfaces

- **Dashboard (Amplify)** — `https://main.d2y6yvvlxvd81b.amplifyapp.com` is live and untouched by this sprint.
- **Existing `jobs-api` endpoints** — no behavior change; only additive routes.
