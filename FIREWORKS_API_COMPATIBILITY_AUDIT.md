# Fireworks API Compatibility Audit Report

**Date:** 2026-05-12
**Auditor:** Agent (job-scheduler)
**API Version Checked:** Fireworks Gateway REST API v4.259.0
**Scope:** All Fireworks API calls in the job-scheduler codebase (SFT, DPO, RFT fine-tuning jobs, quota checking)

---

## Executive Summary

**Overall Status: ✅ MOSTLY COMPATIBLE with minor issues**

The codebase is largely aligned with Fireworks' current API (v4.259.0). Most endpoints, request shapes, and response handling are correct. However, I identified **4 compatibility issues** that need attention — ranging from missing terminal states to deprecated field handling and a potential RFT cancel endpoint change.

---

## 1. Critical: Missing Terminal States in TERMINAL_STATES

**Files:** `supabase/functions/_shared/fireworks.ts` (line 33), `supabase/functions/jobs-api/validate.ts` (line 4)

**Current Code:**
```typescript
// fireworks.ts line 33
export const TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
]);
```

**Fireworks API v4.259.0 Job States (complete enum):**
```
JOB_STATE_UNSPECIFIED
JOB_STATE_CREATING
JOB_STATE_RUNNING
JOB_STATE_COMPLETED
JOB_STATE_FAILED
JOB_STATE_CANCELLED
JOB_STATE_DELETING
JOB_STATE_WRITING_RESULTS
JOB_STATE_VALIDATING
JOB_STATE_DELETING_CLEANING_UP
JOB_STATE_PENDING
JOB_STATE_EXPIRED
JOB_STATE_RE_QUEUEING
JOB_STATE_CREATING_INPUT_DATASET
JOB_STATE_IDLE
JOB_STATE_CANCELLING
JOB_STATE_EARLY_STOPPED
JOB_STATE_PAUSED        ← MISSING from our TERMINAL_STATES
JOB_STATE_DELETED       ← MISSING from our TERMINAL_STATES
```

**Impact:** 
- Jobs that reach `JOB_STATE_PAUSED` (account suspension/manual intervention) or `JOB_STATE_DELETED` will NOT be recognized as terminal by `isTerminal()`. 
- This means the scheduler's reconciliation loop (`scheduler-tick/index.ts` line 54) will leave these jobs stuck in `PROGRESS` state indefinitely.
- The partial unique index on `(user_id, state)` will block that user from submitting new jobs.

**Fix Required:**
```typescript
export const TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
  "JOB_STATE_PAUSED",   // ADD
  "JOB_STATE_DELETED",  // ADD
]);
```

**Also update:** `jobs-api/validate.ts` has its own `TERMINAL_STATES` for user-facing terminal states — ensure it stays in sync if it needs to match Fireworks states.

---

## 2. Medium: Deprecated Fields in SFT Payload — `nodes`, `mtpEnabled`, `mtpNumDraftTokens`, `mtpFreezeBaseModel`

**Files:** `examples/enqueue_sft.sh`, `examples/enqueue_dpo.sh`, `README.md`, `plugins/finetune-queue/skills/finetune-queue/SKILL.md`

**Current Documentation/Samples:** The examples and skill docs show payloads that may include these fields (or don't warn against them).

**Fireworks API Documentation Says:**
- `nodes`: *"Deprecated: multi-node scheduling is now handled by the cookbook orchestrator in V2 workflows. This field is ignored for V2 jobs and will be removed in a future release."*
- `mtpEnabled`: *"Deprecated: MTP is not supported in V2 training. These fields are retained for V1 Helm-based SFT backward compatibility only."*
- `mtpNumDraftTokens`: *"Deprecated: see mtp_enabled."*
- `mtpFreezeBaseModel`: *"Deprecated: see mtp_enabled."*

**Impact:** 
- Low immediate impact — Fireworks currently ignores these fields for V2 jobs.
- Risk if Fireworks removes them in a future release and our payloads still include them (could cause validation errors).
- Our scheduler stores arbitrary `fireworks_payload` with no validation, so users could include these deprecated fields.

**Fix Recommended:**
- Add a warning/deprecation note in `plugins/finetune-queue/skills/finetune-queue/SKILL.md` and `README.md`
- Consider adding a lightweight payload sanitizer that strips known-deprecated fields before submission (optional, future-proofing)

---

## 3. Medium: RFT Cancel Endpoint — Verify `POST :cancel` Still Works

**File:** `supabase/functions/_shared/fireworks.ts` (lines 116-130)

**Current Code:**
```typescript
async cancelJob(kind: Kind, name: string): Promise<void> {
  const init: RequestInit = kind === "RFT"
    ? { method: "POST" }
    : { method: "DELETE" };
  const path = kind === "RFT"
    ? this.url(kind, `${shortName(name)}:cancel`)
    : this.url(kind, shortName(name));
  // ...
}
```

**Fireworks Current Docs (v4.259.0):**
- `POST /v1/accounts/{account_id}/reinforcementFineTuningJobs/{id}:cancel` — ✅ **Still documented and exists**
- Request body schema: `GatewayCancelReinforcementFineTuningJobBody` (type: object, no required fields)

**Status:** ✅ **CORRECT** — The `:cancel` endpoint is still the documented way to cancel RFT jobs.

**However:** The current code sends `POST` with an empty body. The docs show the endpoint accepts a request body (empty object schema). This is fine — an empty body matches the schema. But we should verify this continues to work, as the docs now explicitly define a body schema where previously it may have been body-less.

**Recommendation:** Add `body: JSON.stringify({})` to the RFT cancel request to be explicit:
```typescript
const init: RequestInit = kind === "RFT"
  ? { method: "POST", body: JSON.stringify({}) }
  : { method: "DELETE" };
```

---

## 4. Low: DPO Job Structure — `trainingConfig` Wrapper vs Flat Fields

**Files:** `examples/enqueue_dpo.sh`, `plugins/finetune-queue/skills/finetune-queue/SKILL.md`

**Current API/Docs Observation:**
The DPO job schema in Fireworks v4.259.0 has a `trainingConfig` object containing:
- `outputModel`, `baseModel`, `warmStartFrom`, `jinjaTemplate`
- `learningRate`, `maxContextLength`, `loraRank`, `epochs`, `batchSize`
- `gradientAccumulationSteps`, `learningRateWarmupSteps`, `batchSizeSamples`
- `optimizerWeightDecay`, `trainerShardingScheme`, `loraAlpha`, `loraDropout`, `loraTargetModules`

**Our Code:** The scheduler passes through `fireworks_payload` verbatim — no transformation. This is correct as long as users format their DPO payloads correctly with the `trainingConfig` wrapper.

**Impact:** None — we pass through payloads. But our examples/README should reflect the correct nested structure.

**Recommendation:** Verify the examples in `examples/enqueue_dpo.sh` use the `trainingConfig` wrapper:
```json
{
  "fireworks_payload": {
    "dataset": "my-dataset",
    "trainingConfig": {
      "baseModel": "accounts/fireworks/models/...",
      "epochs": 3,
      "learningRate": 1e-5
    },
    "lossConfig": { "method": "DPO" }
  }
}
```

---

## 5. Low: SFT Flat Parameters vs `trainingConfig` Wrapper

**Observation:** The current SFT schema supports BOTH flat parameters (`epochs`, `learningRate`, `batchSize`, etc. at the top level) AND the `trainingConfig` wrapper (implied by DPO/RFT structure).

**Fireworks SFT Schema (v4.259.0):** The SFT job schema has many fields at the top level:
- `dataset`, `baseModel`, `epochs`, `learningRate`, `batchSize`, `loraRank`, etc.

But notably, it does NOT have a `trainingConfig` wrapper — those fields are flat on the SFT job object itself.

**Our Code:** Passes through verbatim. ✅ Correct.

**Note for Future Multi-Provider Work:** The `milestones.md` / `plan.json` mentions normalizing hyperparameters into a provider-agnostic format. Be aware that SFT uses flat fields while DPO uses `trainingConfig` wrapper — any normalization layer must handle this asymmetry.

---

## 6. Low: Quota API — `value` vs `maxValue` Field

**File:** `supabase/functions/_shared/fireworks.ts` (lines 145-175)

**Current Code:**
```typescript
const maxValue = parseInt(match.maxValue ?? match.value ?? "0", 10);
```

**Fireworks API Schema:**
```yaml
gatewayQuota:
  properties:
    value:
      type: string
      format: int64
      description: "The value of the quota being enforced. This may be lower than the max_value if the user manually lowers it."
    maxValue:
      type: string
      format: int64
      description: "The maximum approved value."
    usage:
      type: number
      format: double
```

**Status:** ✅ **CORRECT** — The code correctly prefers `maxValue` over `value`, which is the right choice (we want the account ceiling, not a manually lowered value).

---

## 7. Low: `gpuCount` Field Extraction — May Need Update for New Fields

**File:** `supabase/functions/_shared/fireworks.ts` (lines 145-175)

**Current Code:**
```typescript
export function extractGpuCount(job: FireworksJob, fallback = 4): number {
  const candidates = [
    (job as Record<string, unknown>).gpuCount,
    (job as Record<string, unknown>).gpu_count,
    (job as Record<string, unknown>)["trainingConfig"] &&
      ((job as Record<string, Record<string, unknown>>).trainingConfig)
        ?.gpuCount,
  ];
  // ...
}
```

**Fireworks API Changes:** The RFT schema now includes:
- `nodeCount`: *"The number of nodes to use for the fine-tuning job. If not specified, the default is 1."*
- `acceleratorSeconds`: *"Accelerator seconds used by the job, keyed by accelerator type (e.g., 'NVIDIA_H100_80GB')."*

**Impact:** The current code doesn't use `nodeCount` to compute GPU count. For RFT jobs, if a user specifies `nodeCount: 2` with default GPUs per node, our scheduler would under-count by 2x.

**Current Behavior:** The code falls back to `4` (the typical H200-per-job default) when `gpuCount` is absent. This is a reasonable heuristic but may be inaccurate for multi-node RFT jobs.

**Recommendation:** Consider adding `nodeCount` as a candidate multiplier:
```typescript
const candidates = [
  job.gpuCount,
  job.gpu_count,
  job.trainingConfig?.gpuCount,
  job.nodeCount ? job.nodeCount * 4 : undefined, // heuristic: 4 GPUs per node
];
```

---

## 8. Info: API Version / Base URL

**File:** `supabase/functions/_shared/fireworks.ts` (line 11)

**Current Code:**
```typescript
export const FIREWORKS_BASE =
  "https://api.fireworks.ai/v1/accounts/trilogy";
```

**Fireworks Docs:** All endpoints are documented under `https://api.fireworks.ai` with paths like `/v1/accounts/{account_id}/...`

**Status:** ✅ **CORRECT** — Base URL and version match.

---

## 9. Info: Endpoint Paths

**File:** `supabase/functions/_shared/fireworks.ts` (lines 16-24)

**Current Code:**
```typescript
const ENDPOINT: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};
```

**Fireworks Docs (v4.259.0):**
- `GET/POST /v1/accounts/{account_id}/supervisedFineTuningJobs` ✅
- `GET/POST /v1/accounts/{account_id}/dpoJobs` ✅
- `GET/POST /v1/accounts/{account_id}/reinforcementFineTuningJobs` ✅

**Status:** ✅ **CORRECT** — All endpoint paths match.

---

## 10. Info: List Response Keys

**File:** `supabase/functions/_shared/fireworks.ts` (lines 26-34)

**Current Code:**
```typescript
const LIST_KEY: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};
```

**Fireworks Docs Response Schemas:**
- `gatewayListSupervisedFineTuningJobsResponse` → `supervisedFineTuningJobs` array ✅
- `gatewayListDpoJobsResponse` → `dpoJobs` array ✅
- `gatewayListReinforcementFineTuningJobsResponse` → `reinforcementFineTuningJobs` array ✅

**Status:** ✅ **CORRECT** — Response keys match.

---

## Summary Table

| # | Issue | Severity | File(s) | Action Needed |
|---|-------|----------|---------|---------------|
| 1 | Missing `JOB_STATE_PAUSED` and `JOB_STATE_DELETED` from `TERMINAL_STATES` | **Critical** | `fireworks.ts:33`, `validate.ts:4` | Add both states to `TERMINAL_STATES` |
| 2 | Deprecated SFT fields (`nodes`, `mtpEnabled`, etc.) not warned | Low | `README.md`, `SKILL.md`, examples | Add deprecation notes |
| 3 | RFT cancel `POST` body should be explicit empty object | Low | `fireworks.ts:116-130` | Add `body: JSON.stringify({})` |
| 4 | DPO `trainingConfig` wrapper structure | Info | Examples, docs | Verify examples use correct structure |
| 5 | SFT flat vs DPO nested params asymmetry | Info | Future normalization layer | Document for multi-provider work |
| 6 | Quota `maxValue` fallback logic | ✅ OK | `fireworks.ts:145-175` | No change needed |
| 7 | RFT `nodeCount` not used for GPU counting | Low | `fireworks.ts` (extractGpuCount) | Consider adding nodeCount heuristic |
| 8 | Base URL / API version | ✅ OK | `fireworks.ts:11` | No change needed |
| 9 | Endpoint paths | ✅ OK | `fireworks.ts:16-24` | No change needed |
| 10 | List response keys | ✅ OK | `fireworks.ts:26-34` | No change needed |

---

## Recommended Priority Order

1. **Fix Issue #1 immediately** — Add `JOB_STATE_PAUSED` and `JOB_STATE_DELETED` to `TERMINAL_STATES`. This prevents jobs from getting stuck.
2. **Fix Issue #3** — Add explicit empty body to RFT cancel POST for spec compliance.
3. **Address Issue #7** — Consider `nodeCount` in GPU extraction for RFT accuracy.
4. **Address Issue #2** — Add deprecation warnings in documentation.
5. **Verify Issue #4** — Check DPO examples use `trainingConfig` wrapper.

---

## Files Referenced in This Audit

- `supabase/functions/_shared/fireworks.ts` — Main Fireworks client
- `supabase/functions/jobs-api/validate.ts` — Validation (has its own TERMINAL_STATES)
- `supabase/functions/jobs-api/index.ts` — API handlers
- `supabase/functions/scheduler-tick/index.ts` — Scheduler reconciliation
- `tests/fireworks.test.js` — Unit tests
- `examples/enqueue_sft.sh` — SFT example
- `examples/enqueue_dpo.sh` — DPO example
- `examples/enqueue_rft.sh` — RFT example
- `README.md` — Project documentation
- `plugins/finetune-queue/skills/finetune-queue/SKILL.md` — Skill documentation
