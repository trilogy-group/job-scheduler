# Project Instructions for AI Agents — job-scheduler

This file provides context for AI agents working on the job-scheduler project.
**You are a Project Worker.** You receive high-level tasks from the Meta-Controller (the main Claude Code session) and execute them within this workspace. You do NOT orchestrate other agents, plan cross-project work, or interact directly with the user — the Meta-Controller handles all of that.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
bd dolt push          # Push beads state to remote
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files
- **Never** create or manage beads for other projects — only this project's `.beads` directory

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

---

## Your Role: Project Worker

**You are NOT the orchestrator.** The Meta-Controller (a separate Claude Code session) manages all projects and routes tasks to you. Your job:

1. **Receive tasks** via OpenClaw messages from the Meta-Controller
2. **Execute** within this workspace only (`~/Documents/Projects/job-scheduler`)
3. **Report results** back to the Meta-Controller concisely
4. **Track work** in this project's Beads database

**Boundaries:**
- Do NOT create or dispatch sub-agents. The Meta-Controller handles worker spawning.
- Do NOT send Telegram messages directly to the user. Report blockers to the Meta-Controller.
- Do NOT modify files outside this workspace. If a task requires touching another project, report it as a blocker.
- Do NOT assume the Meta-Controller knows project details. Include relevant context in your report.

---

## Architecture Overview

The job-scheduler is a **Supabase-based fine-tuning job queue** that manages Fireworks AI GPU training jobs (SFT, DPO, RFT) with fair-scheduler admission control.

### Key Components

| Component | Location | Technology | Purpose |
|-----------|----------|------------|---------|
| **Edge Functions** | `supabase/functions/` | TypeScript / Deno | Serverless API endpoints |
| `scheduler-tick` | `scheduler-tick/index.ts` | Deno + pg_cron | 30s cron job: reconcile jobs, admit queued jobs |
| `jobs-api` | `jobs-api/index.ts` | Deno | REST API: submit jobs, list status, cancel |
| `admission.ts` | `scheduler-tick/admission.ts` | Deno | FIFO admission with per-user limits |
| **Shared modules** | `supabase/functions/_shared/` | TypeScript | Auth, DB client, Fireworks client, response helpers |
| **Fireworks client** | `_shared/fireworks.ts` | TypeScript | SFT/DPO/RFT job submission, quota checking, GPU counting |
| **Database** | Supabase PostgreSQL | SQL | Jobs table, api_keys table, scheduler config |
| **Scripts** | `scripts/` | Node.js | `seed_users.js`, `issue_key.js`, `revoke_key.js`, `dump_state.js` |
| **Tests** | `tests/*.test.js` | Node.js --test | API and scheduler tests |

### Data Flow

```
User (sftq_ API key)
    │ POST /jobs
    ▼
jobs-api (Edge Function) ──► Supabase DB (jobs table, state=QUEUED)
    ▲                           │
    │                           ▼
    │◄────────────────── scheduler-tick (30s pg_cron)
    │    Reconcile PROGRESS → update terminal states
    │    Discover GPU headroom → admit queued jobs
    │    Update DB state, fireworks_job_name
    │
    ▼
Fireworks API
    GET/POST /supervisedFineTuningJobs
    GET/POST /dpoJobs
    GET/POST /reinforcementFineTuningJobs
```

### Key Database Tables

- `jobs` — id, user_id, kind (SFT/DPO/RFT), state (QUEUED/PROGRESS/SUCCESS/FAIL/CANCELLED), gpu_count, fireworks_job_name, created_at, started_at, completed_at
- `api_keys` — id, user_id, key_hash, created_at, revoked_at, last_used_at

---

## Build, Test & Deploy

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test                        # node --test "tests/*.test.js"

# Seed test users (local script)
node scripts/seed_users.js

# Issue an API key
node scripts/issue_key.js <user_id>

# Dump job state
node scripts/dump_state.js
```

### Supabase Edge Functions

```bash
# Start Supabase local stack
supabase start

# Serve functions locally (with env from .env)
supabase functions serve

# Deploy a specific function — BOTH require --no-verify-jwt
supabase functions deploy scheduler-tick --project-ref job-scheduler --no-verify-jwt
supabase functions deploy jobs-api --project-ref job-scheduler --no-verify-jwt

# List deployed functions with verify_jwt status
supabase functions list --project-ref job-scheduler -o json
```

### Important: JWT Verification

Both Edge Functions MUST be deployed with `--no-verify-jwt`. Each enforces its own auth in code:

- `jobs-api` checks the `sftq_`-prefixed bearer token against `api_keys`.
- `scheduler-tick` checks the `X-Scheduler-Secret` header against `SCHEDULER_SECRET`.

Do not assume `pg_cron`'s `net.http_post()` is "platform-authenticated" — it is not. With `verify_jwt=true`, every cron tick is rejected at the Supabase edge gateway with `401 UNAUTHORIZED_NO_AUTH_HEADER` before the function code runs, silently stalling the queue (verified incident 2026-05-13).

### Environment Variables (`.env`)

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
FIREWORKS_API_KEY=<fw_...>
SCHEDULER_SECRET=<random_secret_for_scheduler_tick>
```

---

## Conventions & Patterns

### Code Style

- **Deno** for Edge Functions (not Node.js). Use `import` maps in `supabase/functions/import_map.json`.
- Prefer `async/await` over callbacks.
- Use `dbClient()` from `_shared/db.ts` for Supabase connections.
- Use `error()` and `json()` from `_shared/response.ts` for consistent Edge Function responses.

### Database Patterns

- Always use **advisory locks** (`scheduler_try_lock` / `scheduler_unlock`) in `scheduler-tick` to prevent concurrent ticks.
- Use **partial unique indexes** for user-level constraints (e.g., one active job per user per kind).
- Jobs table has `fireworks_payload` (legacy) and `provider_payload` (new). Use `coalesce(provider_payload, fireworks_payload)` for backward compatibility.

### Error Handling

- Fireworks API errors wrap in `FireworksError` with `{ status, body, isQuotaError }`.
- Quota exhaustion (429 with `in use: X, quota: Y` pattern) is non-terminal — job stays QUEUED, tick skips admission.
- 404 on `getJob` during reconciliation means external cancellation → mark as CANCELLED.

### State Machine

```
QUEUED ──► PROGRESS ──► SUCCESS
              │
              ├─► FAIL (terminal)
              ├─► CANCELLED (terminal)
              └─► JOB_STATE_EXPIRED / EARLY_STOPPED → FAIL
```

- Terminal states: SUCCESS, FAIL, CANCELLED
- Fireworks terminal: JOB_STATE_COMPLETED, JOB_STATE_FAILED, JOB_STATE_CANCELLED, JOB_STATE_EXPIRED, JOB_STATE_EARLY_STOPPED

### Testing

- Tests are in `tests/*.test.js` using Node.js built-in test runner (`node --test`).
- Mock Supabase client for unit tests; use `scripts/dump_state.js` for integration verification.
- Run `npm test` before every commit.

---

## Common Tasks

### Add a new Edge Function

```bash
supabase functions new <name>
# Add to supabase/functions/<name>/index.ts
# Add shared types to _shared/types.ts if needed
# Update import_map.json if adding new deps
```

### Modify the scheduler

Key files:
- `scheduler-tick/index.ts` — main tick loop, lock acquisition, reconcile + admit
- `scheduler-tick/admission.ts` — `runAdmission()` and `SubmitFn` type
- `_shared/fireworks.ts` — `FireworksClient` with GPU quota helpers

### Add a database migration

```bash
supabase migration new <name>
# Edit supabase/migrations/<timestamp>_<name>.sql
supabase db reset  # apply locally
supabase db push   # apply to remote
```

### Rotate API keys

Use `scripts/revoke_key.js` and `scripts/issue_key.js` — never edit `api_keys` table directly.

---

## Blocker Reporting

If a task requires:
- Access to another project's workspace
- New environment variables or API keys
- Architecture decisions that affect other projects
- Changes to shared infrastructure (Supabase org, Fireworks account)

→ **Report as a blocker** to the Meta-Controller with:
```
BLOCKER: <one-line summary>
NEED: <specific ask>
CONTEXT: <why this blocks the current task>
SUGGESTED NEXT STEP: <what the Meta-Controller should do>
```
