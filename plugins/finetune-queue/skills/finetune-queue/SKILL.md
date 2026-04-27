---
name: finetune-queue
description: Submit, list, monitor, and cancel Fireworks fine-tuning jobs (SFT, DPO, RFT) for the Trilogy team via the fair-scheduler queue. ALWAYS use this instead of calling the Fireworks fine-tuning API directly or running `firectl supervised-fine-tuning-job ...`, `firectl dpoj ...`, or `firectl rft-job ...`.
disable-model-invocation: false
argument-hint: [enqueue|list|status|cancel] [--kind SFT|DPO|RFT] [--id <job-id>]
---

# Fireworks Fine-Tuning Scheduler

A fair-FIFO queue in front of the Fireworks `trilogy` account. Enforces at most **one in-progress fine-tuning job per user** (queue depth is unlimited) and respects the live Fireworks GPU quota.

## RULE 0 — Route all fine-tuning jobs through this scheduler

**DO NOT** call the Fireworks fine-tuning HTTP API directly for any mutation.
**DO NOT** run `firectl supervised-fine-tuning-job create|cancel|resume|get|list`.
**DO NOT** run `firectl dpoj create|cancel|resume|list`.
**DO NOT** run `firectl rft-job create|cancel|resume|list` or POST to `/reinforcementFineTuningJobs` directly.

The whole point of this scheduler is that agents running in parallel would otherwise violate fairness rules non-deterministically. Direct access breaks the guarantee.

**Allowed direct Fireworks access:**
- `firectl dataset *` — dataset ops are not scheduled (see `fireworks-datasets` skill).
- `firectl deployment *` — model serving / inference is separate (see `fireworks-training` skill's Deployment section).
- `GET /v1/accounts/trilogy/supervisedFineTuningJobs/{id}` for **read-only metrics URL retrieval** when the scheduler doesn't proxy a metric you need.
- Inference calls (`/inference/v1/chat/completions`) — unrelated to fine-tuning jobs.

Anything else — stop and use the scheduler.

## Prerequisites

- `SFTQ_API_KEY` in your environment (starts with `sftq_`). Ask Anirudh if you don't have one yet.
- `SUPABASE_URL=https://mteiejqiocldpdaxjmra.supabase.co` (constant for the team).

Quick setup:

```bash
export SUPABASE_URL=https://mteiejqiocldpdaxjmra.supabase.co
# Put your token in .env (NEVER commit) or export per-shell:
export SFTQ_API_KEY=sftq_...
```

## API surface

All paths are under `$SUPABASE_URL/functions/v1/jobs-api`. Auth is `Authorization: Bearer $SFTQ_API_KEY` on every call. The scheduler identifies you from the key — you cannot submit or see jobs on behalf of another user.

### Enqueue a job — `POST /jobs`

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer $SFTQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "SFT",
    "display_name": "<human-readable name>",
    "gpu_count": 4,
    "fireworks_payload": { /* the exact body you would have sent to Fireworks */ }
  }'
```

Fields:
- `kind` (required): `"SFT"`, `"DPO"`, or `"RFT"` — selects which Fireworks endpoint the scheduler submits to (`/supervisedFineTuningJobs`, `/dpoJobs`, `/reinforcementFineTuningJobs` respectively).
- `fireworks_payload` (required): the **verbatim** Fireworks request body. The scheduler passes it through on admission. Build it exactly as if you were calling Fireworks directly — see the `fireworks-training` skill for proven parameter values.
- `display_name` (optional): shows up in `list`/`status` output.
- `gpu_count` (optional, default 4): your best estimate of GPUs this job will use. Used for admission gating; live `usage` is re-read from Fireworks on every scheduler tick, so this doesn't need to be perfect.

Response:
```json
{ "id": "<uuid>", "kind": "SFT", "state": "QUEUED", "created_at": "..." }
```

### List your jobs — `GET /jobs`

```bash
# all of your jobs, newest first
curl -sS -H "Authorization: Bearer $SFTQ_API_KEY" "$SUPABASE_URL/functions/v1/jobs-api/jobs"

# filter:
curl -sS -H "Authorization: Bearer $SFTQ_API_KEY" "$SUPABASE_URL/functions/v1/jobs-api/jobs?state=PROGRESS"
curl -sS -H "Authorization: Bearer $SFTQ_API_KEY" "$SUPABASE_URL/functions/v1/jobs-api/jobs?kind=DPO"
```

Returns an array of:
```json
{
  "id": "<uuid>",
  "kind": "SFT" | "DPO",
  "state": "QUEUED" | "PROGRESS" | "SUCCESS" | "FAIL" | "CANCELLED",
  "display_name": "...",
  "gpu_count": 4,
  "created_at": "...",
  "started_at": "..." | null,
  "completed_at": "..." | null,
  "error": "..." | null,
  "fireworks_job_name": "accounts/trilogy/supervisedFineTuningJobs/..." | null
}
```

### Status of one job — `GET /jobs/:id`

```bash
curl -sS -H "Authorization: Bearer $SFTQ_API_KEY" "$SUPABASE_URL/functions/v1/jobs-api/jobs/<id>"
```

Returns `404` if the id doesn't exist OR isn't yours (we don't leak existence).

### Cancel a job — `DELETE /jobs/:id`

```bash
curl -sS -X DELETE -H "Authorization: Bearer $SFTQ_API_KEY" "$SUPABASE_URL/functions/v1/jobs-api/jobs/<id>"
```

Behaviour:
- `state=QUEUED` → flips to `CANCELLED` immediately. No Fireworks call is needed.
- `state=PROGRESS` → calls Fireworks `DELETE` on the underlying job (Fireworks removes the resource), then flips us to `CANCELLED`.
- `state=SUCCESS|FAIL|CANCELLED` → `409 Conflict`. Repeat cancels are idempotent in the sense that they don't change anything; they just return an error.

## States

| State       | Meaning |
|-------------|---------|
| `QUEUED`    | Accepted; waiting for an eligible slot (per-user cap + GPU budget). |
| `PROGRESS`  | Submitted to Fireworks; training (or about to). |
| `SUCCESS`   | Fireworks reported `JOB_STATE_COMPLETED`. |
| `FAIL`      | Fireworks reported `JOB_STATE_FAILED` / `_EXPIRED` / `_EARLY_STOPPED`, OR submission 4xx'd (e.g., bad payload). Check `error` for details. |
| `CANCELLED` | User cancelled via `DELETE /jobs/:id`, OR the Fireworks job was deleted externally and we reconciled. |

Transitions are strict: `QUEUED → PROGRESS → {SUCCESS | FAIL}`, plus `QUEUED → CANCELLED` and `PROGRESS → CANCELLED`. No backwards moves.

## Scheduling semantics you should know

- **FIFO by `created_at`** across SFT and DPO combined.
- **Per-user cap = 1 PROGRESS job.** If you enqueue 3 jobs, only the earliest gets admitted; the others wait. Queue depth itself has no limit.
- **GPU budget is live.** Before admission the scheduler reads `GET /v1/accounts/trilogy/quotas` and computes `maxValue - usage`. A job is admitted only if `gpu_count ≤ available`.
- **Strict FIFO, no backfill.** If the earliest eligible (user-free) candidate doesn't fit, the tick stops — smaller later jobs do NOT jump ahead of it.
- **Cadence:** the scheduler tick runs every 30 seconds via `pg_cron`. So queue→PROGRESS takes up to 30s after the prior job frees up budget.

## Typical patterns

### Fire and forget (agent)

```bash
resp=$(curl -sS -X POST "$SUPABASE_URL/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer $SFTQ_API_KEY" -H "Content-Type: application/json" \
  -d "$(cat <<'JSON'
{
  "kind": "SFT",
  "display_name": "qwen3-14b baseline",
  "gpu_count": 4,
  "fireworks_payload": {
    "baseModel": "accounts/fireworks/models/qwen3-14b",
    "dataset": "accounts/trilogy/datasets/edullm-ela-sft-v3-thinking",
    "displayName": "qwen3-14b baseline",
    "outputModel": "accounts/trilogy/models/edullm-ela-qwen3-14b-baseline-v1",
    "evaluationDataset": "accounts/trilogy/datasets/edullm-ela-sft-val-v2",
    "epochs": 3,
    "learningRate": 0.0002,
    "loraRank": 32,
    "maxContextLength": 8192,
    "learningRateWarmupSteps": 10,
    "batchSize": 65536,
    "gradientAccumulationSteps": 1
  }
}
JSON
)")
job_id=$(echo "$resp" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "enqueued: $job_id"
```

### Poll until terminal

```bash
while true; do
  state=$(curl -sS -H "Authorization: Bearer $SFTQ_API_KEY" \
    "$SUPABASE_URL/functions/v1/jobs-api/jobs/$job_id" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["state"])')
  echo "$(date -Iseconds) $state"
  case "$state" in SUCCESS|FAIL|CANCELLED) break;; esac
  sleep 60
done
```

### Python

```python
import os, json, urllib.request

BASE = f"{os.environ['SUPABASE_URL'].rstrip('/')}/functions/v1/jobs-api"
H = {"Authorization": f"Bearer {os.environ['SFTQ_API_KEY']}", "Content-Type": "application/json"}

def _req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=H, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def enqueue(kind, fireworks_payload, *, display_name=None, gpu_count=4):
    body = {"kind": kind, "fireworks_payload": fireworks_payload, "gpu_count": gpu_count}
    if display_name: body["display_name"] = display_name
    return _req("POST", "/jobs", body)

def status(job_id):      return _req("GET",    f"/jobs/{job_id}")
def list_jobs(**q):      return _req("GET",    "/jobs" + ("?" + "&".join(f"{k}={v}" for k,v in q.items()) if q else ""))
def cancel(job_id):      return _req("DELETE", f"/jobs/{job_id}")
```

## Troubleshooting

- **`401 unauthorized`** — `SFTQ_API_KEY` missing, wrong, or revoked. Get a fresh one.
- **`400 fireworks_payload is required`** — you forgot the outer shape. Body must be `{kind, fireworks_payload, ...}`, not just the Fireworks request.
- **Job stays `QUEUED` for a long time** — either (a) you already have a `PROGRESS` job, or (b) GPU budget is exhausted. Run `GET /jobs` to check your own `PROGRESS` jobs; check `usage` via `firectl quota list` if you want to see cluster-wide state.
- **Job flipped to `FAIL` within seconds** — Fireworks rejected the payload at submission. Read the `error` field — it contains the Fireworks response body verbatim.

## Payload reference (Fireworks body shapes)

All three kinds accept the full Fireworks request body inside `fireworks_payload`. Refer to the `fireworks-training` skill for proven parameters:

- **SFT** (`/supervisedFineTuningJobs`): flat shape. `baseModel`, `dataset`, `outputModel`, `evaluationDataset` (optional), `epochs`, `learningRate`, `loraRank`, `maxContextLength`, `learningRateWarmupSteps`, `batchSize`, `gradientAccumulationSteps`.
- **DPO** (`/dpoJobs`): nested. `dataset`, `lossConfig.method = "DPO"`, `trainingConfig.{warmStartFrom, outputModel, epochs, learningRate, loraRank, maxContextLength, ...}`.
- **RFT** (`/reinforcementFineTuningJobs`): nested. **Required**: `dataset`, `evaluator` (resource name of a reward function). Optional: `displayName`, `evaluationDataset`, `trainingConfig.{baseModel, learningRate, loraRank, epochs, batchSize}`, `lossConfig.{method (default GRPO; one of GRPO, DPO, ORPO, DAPO, GSPO_TOKEN), klBeta}`, `inferenceParameters.{maxOutputTokens, temperature, topP, responseCandidatesCount (≥ 2 required)}`, `nodeCount`, `maxConcurrentRollouts`, `maxConcurrentEvaluations`, `wandbConfig`.

Example RFT payload:
```json
{
  "kind": "RFT",
  "display_name": "math-rft-grpo-v1",
  "fireworks_payload": {
    "displayName": "math-rft-grpo-v1",
    "dataset": "accounts/trilogy/datasets/math-grpo-prompts-v1",
    "evaluator": "accounts/trilogy/evaluators/math-correct-v1",
    "trainingConfig": {
      "baseModel": "accounts/fireworks/models/qwen3-14b",
      "learningRate": 1e-5,
      "loraRank": 32,
      "epochs": 1,
      "batchSize": 64
    },
    "lossConfig": { "method": "GRPO", "klBeta": 0.1 },
    "inferenceParameters": {
      "maxOutputTokens": 1024,
      "temperature": 0.7,
      "topP": 0.9,
      "responseCandidatesCount": 4
    }
  }
}
```

**RFT-specific gotchas:**
- `evaluator` is required and must reference an existing Fireworks evaluator. Forgetting it 400s.
- `inferenceParameters.responseCandidatesCount` must be ≥ 2 (RFT needs multiple rollouts to compute preferences).
- Default `lossConfig.method` is `GRPO`. Don't assume `DPO`.
- All three kinds (SFT + DPO + RFT) share the same `training-h200-count` quota and the same per-user-cap-of-1 rule.

The scheduler does **not** validate Fireworks-specific field names — it passes them through. A bad shape will fail at Fireworks submission time and the job will go to `FAIL`.

## Cancellation semantics under the hood

When you `DELETE /jobs/:id` (our endpoint), the scheduler translates that to the right Fireworks call based on `kind`:
- **SFT, DPO**: `DELETE /...Jobs/{name}` — Fireworks removes the resource entirely. Subsequent `GET` on Fireworks returns 404.
- **RFT**: `POST /reinforcementFineTuningJobs/{name}:cancel` — Fireworks transitions the job to `JOB_STATE_CANCELLED` but preserves the resource. (RFT is the only kind with a documented `:cancel` endpoint.)

This asymmetry is hidden from the API user — you always call `DELETE /jobs/:id`.

## What NOT to do (recap)

- ❌ `curl -X POST https://api.fireworks.ai/v1/accounts/trilogy/supervisedFineTuningJobs ...`
- ❌ `curl -X POST https://api.fireworks.ai/v1/accounts/trilogy/dpoJobs ...`
- ❌ `curl -X POST https://api.fireworks.ai/v1/accounts/trilogy/reinforcementFineTuningJobs ...`
- ❌ `firectl supervised-fine-tuning-job create|cancel|resume`
- ❌ `firectl dpoj create|cancel|resume`
- ❌ `firectl rft-job create|cancel|resume`
- ❌ Using a teammate's API key (each key is per-user; the scheduler derives `user_id` from it).

Every one of those violates the fairness guarantee. Always go through `jobs-api`.
