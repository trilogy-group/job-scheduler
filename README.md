# job-scheduler

Fair FIFO scheduler for Fireworks fine-tuning jobs (SFT + DPO) on the `trilogy` account, backed by Supabase.

**Invariants the scheduler enforces:**

1. At most **one PROGRESS job per user** at any time (queue depth is unlimited).
2. Sum of active GPU usage across Fireworks SFT + DPO endpoints ≤ `FIREWORKS_GPU_QUOTA` (default 8).
3. Admission is **FIFO by `created_at`** over jobs whose user has no PROGRESS job and whose `gpu_count` fits the live Fireworks headroom.

Design lives in `openspec/changes/add-finetune-scheduler/`. Task tracking in beads (`bd list`).

## Architecture

```
      Trainers / agents
             │  POST /jobs, GET /jobs, DELETE /jobs/:id
             ▼
   Supabase Edge Function  jobs-api  (auth: sftq_* API keys)
             │  writes jobs table
             ▼
     ┌─────────────────┐
     │  Supabase  DB   │  users / api_keys / jobs
     └─────────────────┘
             ▲
             │  pg_cron every 30s → net.http_post
             │  (passes X-Scheduler-Secret)
             ▼
   Supabase Edge Function  scheduler-tick
             │ 1. Reconcile PROGRESS jobs via Fireworks GET
             │ 2. Compute fw_available from both /supervisedFineTuningJobs + /dpoJobs
             │ 3. Admit earliest-queued eligible jobs until budget exhausted
             ▼
      Fireworks API  (service account FIREWORKS_API_KEY)
```

## Prerequisites

- Supabase CLI (`brew install supabase/tap/supabase`)
- Node 18+ (for operator scripts)
- A Supabase project with `pg_cron`, `pgcrypto`, and `http` extensions available
- A Fireworks service-account API key for the `trilogy` account

## Setup

1. Copy env template and fill it in:

   ```bash
   cp .env.example .env
   # fill in FIREWORKS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCHEDULER_SECRET
   ```

2. Install operator-script deps:

   ```bash
   npm install
   ```

3. Link the local project to your Supabase project and push migrations:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. Seed users and issue API keys:

   ```bash
   node scripts/seed_users.js
   node scripts/issue_key.js --email alice@trilogy.com --label "alice-laptop"
   # → prints the plaintext sftq_* token once. Share it over a secure channel.
   ```

5. Set Edge Function secrets:

   ```bash
   supabase secrets set \
     FIREWORKS_API_KEY=$FIREWORKS_API_KEY \
     FIREWORKS_GPU_QUOTA=$FIREWORKS_GPU_QUOTA \
     SCHEDULER_SECRET=$SCHEDULER_SECRET
   ```

6. Deploy Edge Functions:

   ```bash
   supabase functions deploy jobs-api
   supabase functions deploy scheduler-tick
   ```

7. Register the pg_cron tick. See `supabase/migrations/0002_schedule_tick.sql` — after editing the URL + secret reference for your project, `supabase db push` it.

## Skill for teammates' Claude Code agents

This repo doubles as a Claude Code marketplace. Agents that install the `finetune-queue` plugin get a skill that routes fine-tuning calls through the scheduler (and refuses to use `firectl` / the Fireworks API directly).

```
/plugin marketplace add trilogy-group/job-scheduler
/plugin install finetune-queue@job-scheduler
```

Two env vars on the caller's machine: `SUPABASE_URL` (above) and `SFTQ_API_KEY` (per-user, ask Anirudh). See [`plugins/finetune-queue/README.md`](plugins/finetune-queue/README.md).

## Using the API

See `examples/` for full scripts. Quick shape:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer $SFTQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "SFT",
    "display_name": "qwen3-14b experiment",
    "gpu_count": 4,
    "fireworks_payload": { "baseModel": "accounts/fireworks/models/qwen3-14b", "dataset": "...", "outputModel": "...", "epochs": 3 }
  }'
```

Response: `{ "id": "<uuid>", "kind": "SFT", "state": "QUEUED", "created_at": "..." }`.

States: `QUEUED` → `PROGRESS` → `SUCCESS` | `FAIL`, plus `QUEUED → CANCELLED` or `PROGRESS → CANCELLED` via `DELETE /jobs/:id`.

## Runtime notes

- **Deno** is the runtime for Edge Functions (Supabase's default). You do not need Deno locally unless you want to run `deno test` on the shared modules; `supabase functions serve` ships its own Deno runtime.
- **Operator scripts** (`scripts/*.js`) are plain Node.

## Operating the scheduler

- Pause admission: `supabase db execute "SELECT cron.unschedule('scheduler-tick');"`. Resume by re-running `0002_schedule_tick.sql`.
- Inspect state: `node scripts/dump_state.js` (once §9 is implemented) or query `jobs` directly.
- Rotate a key: `node scripts/revoke_key.js --id <key-id>` then issue a fresh one.

## Failure modes

- **Fireworks unreachable** — tick leaves job state untouched; reconcile retries next tick.
- **pg_cron down** — no admissions happen; queue backs up; fix pg_cron or hit `scheduler-tick` manually with the secret.
- **Quota exhausted on Fireworks** — tick admits nothing and stops; catches up next tick once a job finishes.
- **Bad Fireworks payload** — job flips to `FAIL` with the Fireworks error body in `error`.
