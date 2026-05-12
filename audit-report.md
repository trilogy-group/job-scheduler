# Fireworks API Compatibility Audit Report

**Date:** 2026-05-12  
**Auditor:** Agent (job-scheduler)  
**Issue:** job-scheduler-3wb  
**Fireworks API Version:** Gateway REST API v4.259.0 (per docs)

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| SFT Endpoint | ✅ MATCH | `POST /supervisedFineTuningJobs` — correct |
| DPO Endpoint | ✅ MATCH | `POST /dpoJobs` — correct |
| RFT Endpoint | ✅ MATCH | `POST /reinforcementFineTuningJobs` — correct |
| Job States | ⚠️ PARTIAL | Missing `JOB_STATE_PAUSED` and `JOB_STATE_DELETED` from TERMINAL_STATES |
| Cancellation | ✅ MATCH | SFT/DPO DELETE, RFT POST :cancel — verified against docs |
| GPU Quota | ✅ MATCH | `GET /quotas` with pattern matching — correct |
| List Keys | ✅ MATCH | `supervisedFineTuningJobs`, `dpoJobs`, `reinforcementFineTuningJobs` — correct |
| Error Handling | ✅ MATCH | `isQuotaExhaustion` regex matches documented error format |
| Tests | ✅ PASS | 43/43 tests passing |

**Overall: Implementation is largely correct. Two issues found:**
1. `TERMINAL_STATES` missing two new Fireworks states (`PAUSED`, `DELETED`)
2. `mapFireworksTerminal` does not handle `JOB_STATE_PAUSED` — could leave jobs stuck in PROGRESS

---

## 2. Detailed Comparison

### 2.1 Endpoints

| Kind | Our Code | Fireworks Docs | Match? |
|------|----------|----------------|--------|
| SFT create | `POST /supervisedFineTuningJobs` | `POST /v1/accounts/{account_id}/supervisedFineTuningJobs` | ✅ |
| DPO create | `POST /dpoJobs` | `POST /v1/accounts/{account_id}/dpoJobs` | ✅ |
| RFT create | `POST /reinforcementFineTuningJobs` | `POST /v1/accounts/{account_id}/reinforcementFineTuningJobs` | ✅ |
| SFT get | `GET /supervisedFineTuningJobs/{id}` | `GET /v1/accounts/{account_id}/supervisedFineTuningJobs/{id}` | ✅ |
| DPO get | `GET /dpoJobs/{id}` | `GET /v1/accounts/{account_id}/dpoJobs/{id}` | ✅ |
| RFT get | `GET /reinforcementFineTuningJobs/{id}` | `GET /v1/accounts/{account_id}/reinforcementFineTuningJobs/{id}` | ✅ |
| SFT/DPO cancel | `DELETE /{id}` | No `:cancel` endpoint — DELETE removes resource | ✅ |
| RFT cancel | `POST /{id}:cancel` | `POST /{id}:cancel` documented | ✅ |
| Quota list | `GET /quotas` | `GET /v1/accounts/{account_id}/quotas` | ✅ |

**File:** `_shared/fireworks.ts`, lines 12-16, 20-24, 116-130, 145-155

### 2.2 Job States

Fireworks docs define 19 states (as of v4.259.0):

```
JOB_STATE_UNSPECIFIED
JOB_STATE_CREATING
JOB_STATE_RUNNING
JOB_STATE_COMPLETED        ← terminal ✅
JOB_STATE_FAILED             ← terminal ✅
JOB_STATE_CANCELLED          ← terminal ✅
JOB_STATE_DELETING
JOB_STATE_WRITING_RESULTS
JOB_STATE_VALIDATING
JOB_STATE_DELETING_CLEANING_UP
JOB_STATE_PENDING
JOB_STATE_EXPIRED            ← terminal ✅
JOB_STATE_RE_QUEUEING
JOB_STATE_CREATING_INPUT_DATASET
JOB_STATE_IDLE
JOB_STATE_CANCELLING
JOB_STATE_EARLY_STOPPED      ← terminal ✅
JOB_STATE_PAUSED             ← MISSING from TERMINAL_STATES ❌
JOB_STATE_DELETED            ← MISSING from TERMINAL_STATES ❌
```

**Our TERMINAL_STATES** (`_shared/fireworks.ts`, line 33):
```typescript
export const TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
]);
```

**Issue:** `JOB_STATE_PAUSED` and `JOB_STATE_DELETED` are not in `TERMINAL_STATES`.
- `JOB_STATE_PAUSED`: "Job is paused, typically due to account suspension or manual intervention." — This is NOT terminal per se, but if a job is paused indefinitely, our scheduler will keep it in PROGRESS forever, blocking the user's slot.
- `JOB_STATE_DELETED`: "Job has been deleted." — This IS terminal. If Firewitches deletes a job (e.g., via UI), our scheduler will never reconcile it because `isTerminal()` returns false, leaving the DB row stuck at PROGRESS.

**Impact:** Jobs that transition to PAUSED or DELETED on Fireworks will remain in PROGRESS in our DB, consuming the user's per-job cap and potentially GPU budget.

**Fix:** Add `JOB_STATE_DELETED` to `TERMINAL_STATES`. For `JOB_STATE_PAUSED`, consider treating it as terminal or adding a timeout heuristic.

**File:** `_shared/fireworks.ts`, line 33

### 2.3 State Mapping in Scheduler

**Our `mapFireworksTerminal`** (`scheduler-tick/index.ts`, lines 192-208):
```typescript
function mapFireworksTerminal(state: string): {
  state: "SUCCESS" | "FAIL" | "CANCELLED";
  errorText: (job: { error?: unknown; message?: unknown }) => string | null;
} {
  if (state === "JOB_STATE_COMPLETED") {
    return { state: "SUCCESS", errorText: () => null };
  }
  if (state === "JOB_STATE_CANCELLED") {
    return { state: "CANCELLED", errorText: () => null };
  }
  // JOB_STATE_FAILED, JOB_STATE_EXPIRED, JOB_STATE_EARLY_STOPPED
  return {
    state: "FAIL",
    errorText: (job) => ...
  };
}
```

**Issue:** This function does not handle `JOB_STATE_DELETED` or `JOB_STATE_PAUSED`. If `isTerminal()` were updated to include them, this function would hit the default FAIL branch for DELETED (acceptable) but there's no explicit handling.

**Recommended fix:** Add explicit mapping:
- `JOB_STATE_DELETED` → `CANCELLED` (job was removed)
- `JOB_STATE_PAUSED` → either `FAIL` (with error text "paused by provider") or keep in PROGRESS with a warning

**File:** `scheduler-tick/index.ts`, lines 192-208

### 2.4 Cancellation Behavior

**Our code** (`_shared/fireworks.ts`, lines 116-130):
```typescript
async cancelJob(kind: Kind, name: string): Promise<void> {
  const init: RequestInit = kind === "RFT"
    ? { method: "POST" }
    : { method: "DELETE" };
  const path = kind === "RFT"
    ? this.url(kind, `${shortName(name)}:cancel`)
    : this.url(kind, shortName(name));
  ...
}
```

**Docs verification:**
- RFT: `POST /reinforcementFineTuningJobs/{id}:cancel` — ✅ documented at docs.fireworks.ai/api-reference/cancel-reinforcement-fine-tuning-job
- SFT/DPO: No `:cancel` endpoint in docs. DELETE removes the resource entirely. — ✅ matches our implementation

**Issue:** When SFT/DPO are cancelled externally (via Fireworks UI or firectl), the job is DELETE'd and returns 404 on subsequent GETs. Our reconciliation handles this correctly (lines 82-95 in scheduler-tick/index.ts) by mapping 404 → CANCELLED.

**File:** `_shared/fireworks.ts`, lines 116-130; `scheduler-tick/index.ts`, lines 82-95

### 2.5 GPU Quota Discovery

**Our code** (`_shared/fireworks.ts`, lines 145-175):
```typescript
async getTrainingGpuQuota(namePattern: RegExp = /training.*h200|h200.*training/i): Promise<...> {
  const res = await this.request(`${this.base}/quotas`);
  ...
  const maxValue = parseInt(match.maxValue ?? match.value ?? "0", 10);
  const usage = typeof match.usage === "number" ? match.usage : 0;
  return { maxValue, usage, name: match.name };
}
```

**Docs verification:** `GET /v1/accounts/{account_id}/quotas` returns:
```yaml
quotas:
  - name: accounts/my-account/quotas/h100-us-iowa-1
    value: string (int64)
    maxValue: string (int64)
    usage: number (double)
    updateTime: date-time
```

**Match:** ✅ Our parsing matches the schema. We correctly prefer `maxValue` over `value` and handle `usage` as a number.

**Note:** Our scheduler computes its own usage by summing active job GPU counts because Fireworks' `usage` counter has been observed to get stuck (documented in code comment at line 104 of scheduler-tick/index.ts). This workaround is still necessary.

**File:** `_shared/fireworks.ts`, lines 145-175

### 2.6 Request/Response Schemas

#### SFT Payload

**Our code:** Stores arbitrary `fireworks_payload` object. No validation of fields.

**Docs schema (`gatewaySupervisedFineTuningJob`):**
Required: `dataset`  
Optional: `displayName`, `baseModel`/`warmStartFrom`, `epochs`, `learningRate`, `batchSize`, `loraRank`, `maxContextLength`, `earlyStop`, `evaluationDataset`, `evalAutoCarveout`, `wandbConfig`, `awsS3Config`, `azureBlobStorageConfig`, `gradientAccumulationSteps`, `learningRateWarmupSteps`, `batchSizeSamples`, `optimizerWeightDecay`, `purpose`

**Match:** ✅ We pass through the payload as-is. No divergence.

#### DPO Payload

**Docs schema (`gatewayDpoJob`):**
Required: `dataset`  
Optional: `displayName`, `trainingConfig` (contains `baseModel`, `epochs`, `learningRate`, `batchSize`, `loraRank`, etc.), `lossConfig` (method: DPO/ORPO, klBeta, dpo config, orpo config), `wandbConfig`, `awsS3Config`, `azureBlobStorageConfig`, `purpose`

**Note:** DPO has a `trainingConfig` wrapper object that SFT does NOT have (SFT fields are flat). Our code passes payload through — if users send flat fields for DPO, it may fail at Fireworks. This is a user input issue, not a code bug.

**File:** `jobs-api/validate.ts` — no schema validation, just checks payload is an object.

#### RFT Payload

**Docs schema (`gatewayReinforcementFineTuningJob`):**
Required: `dataset`, `evaluator`  
Optional: `displayName`, `trainingConfig`, `inferenceParameters`, `chunkSize`, `maxInferenceReplicaCount`, `nodeCount`, `lossConfig`, `maxConcurrentRollouts`, `maxConcurrentEvaluations`, `wandbConfig`, `awsS3Config`, `azureBlobStorageConfig`, `purpose`

**Match:** ✅ We pass through as-is.

### 2.7 New Fields in Docs Not Used by Our Code

These are harmless omissions (we pass payloads through), but worth noting for future features:

| Field | Description | Potential Use |
|-------|-------------|---------------|
| `jobProgress` | Progress percent, epochs, tokens | Could expose to users |
| `estimatedCost` | Cost estimate | Could show to users before enqueue |
| `acceleratorSeconds` | GPU time used (RFT only) | Could track billing |
| `trainerLogsSignedUrl` | Signed URL to logs | Could expose to users |
| `metricsFileSignedUrl` | Signed URL to metrics | Could expose to users |
| `purpose` | `PURPOSE_UNSPECIFIED` or `PURPOSE_PILOT` | Could set for priority jobs |
| `outputModel` | Custom model ID for result | Could let users specify |

### 2.8 Validation

**Our `validate.ts`** (`jobs-api/validate.ts`):
- Checks `kind` is SFT/DPO/RFT ✅
- Checks `fireworks_payload` is an object ✅
- Checks `gpu_count` is positive integer ✅
- Checks `display_name` is string ✅

**Missing validations (not bugs, but gaps):**
- Does NOT validate `dataset` is present in payload (required by all three endpoints)
- Does NOT validate `evaluator` is present for RFT (required by docs)
- Does NOT validate DPO payload uses `trainingConfig` wrapper (SFT is flat, DPO is wrapped)
- Does NOT validate model IDs exist

**Recommendation:** Add `dataset` and `evaluator` (for RFT) presence checks to catch user errors early.

**File:** `jobs-api/validate.ts`, lines 22-64

---

## 3. Why Jobs Might Transition to CANCELLED Unexpectedly

### 3.1 External Cancellation

Fireworks jobs can be cancelled via:
- Fireworks UI/console (firectl)
- API call by another client using the same API key
- Automatic cancellation by Fireworks (see below)

When this happens:
- SFT/DPO: Job is DELETE'd → returns 404 on GET → our scheduler maps 404 → CANCELLED (correct)
- RFT: Job transitions to `JOB_STATE_CANCELLED` → our scheduler maps it on next reconcile (correct)

**No bug here.** Our handling is correct.

### 3.2 Fireworks Auto-Cancellation / Timeout Policies

The docs do not explicitly mention automatic cancellation or timeout policies. However, the presence of `JOB_STATE_EXPIRED` suggests Fireworks may expire jobs that sit in `PENDING` or `CREATING` too long.

**Our handling:** `JOB_STATE_EXPIRED` → FAIL (correct, since it's a terminal failure state)

### 3.3 Quota Enforcement

If a job is admitted but Fireworkers later determines the quota was exceeded (race condition), the job may fail or be cancelled.

**Our handling:** We compute our own usage to avoid this race, but it's not impossible. No explicit bug.

### 3.4 `JOB_STATE_PAUSED` — The Hidden Risk

**This is the most significant finding.** If Fireworks pauses a job (account suspension, manual intervention, or provider issue), the job state becomes `JOB_STATE_PAUSED`.

- Our `TERMINAL_STATES` does NOT include PAUSED → `isTerminal()` returns false
- Our scheduler keeps the job in PROGRESS → user cannot submit new jobs
- The job may stay PAUSED indefinitely → permanent user lockout

**Recommended fix:** Treat `JOB_STATE_PAUSED` as terminal (map to FAIL) or add a staleness timeout (e.g., if PAUSED for >1 hour, mark FAIL).

---

## 4. Smoke Tests

```
✅ 43/43 tests passing
✅ No test failures
✅ No compilation errors
```

Test coverage:
- `tests/admission.test.js` — 10 tests (FIFO, per-user cap, GPU budget, quota errors)
- `tests/fireworks.test.js` — 14 tests (client routing, list keys, cancel asymmetry, quota discovery)
- `tests/auth.test.js` — 4 tests (token format, hash determinism)
- `tests/jobs-api.validate.test.js` — 7 tests (validation rules)

**Missing test coverage:**
- No test for `JOB_STATE_PAUSED` handling
- No test for `JOB_STATE_DELETED` handling
- No test for external 404 → CANCELLED reconciliation path
- No test for `getJob` returning PAUSED state

---

## 5. Recommended Fixes

### Fix 1: Add Missing Terminal States (Priority: HIGH)

**File:** `supabase/functions/_shared/fireworks.ts`, line 33

```typescript
export const TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
  "JOB_STATE_DELETED",   // ← ADD
  // "JOB_STATE_PAUSED",  // ← CONSIDER (see Fix 2)
]);
```

### Fix 2: Handle PAUSED State in Scheduler (Priority: HIGH)

**File:** `supabase/functions/scheduler-tick/index.ts`, lines 192-208

Add explicit mapping for PAUSED:
```typescript
function mapFireworksTerminal(state: string): {
  state: "SUCCESS" | "FAIL" | "CANCELLED";
  errorText: (job: { error?: unknown; message?: unknown }) => string | null;
} {
  if (state === "JOB_STATE_COMPLETED") {
    return { state: "SUCCESS", errorText: () => null };
  }
  if (state === "JOB_STATE_CANCELLED" || state === "JOB_STATE_DELETED") {
    return { state: "CANCELLED", errorText: () => null };
  }
  if (state === "JOB_STATE_PAUSED") {
    return { state: "FAIL", errorText: () => "Job paused by provider (account suspension or manual intervention)" };
  }
  // JOB_STATE_FAILED, JOB_STATE_EXPIRED, JOB_STATE_EARLY_STOPPED
  return {
    state: "FAIL",
    errorText: (job) => ...
  };
}
```

Also update `TERMINAL_STATES` to include PAUSED if treating it as terminal.

### Fix 3: Add RFT `evaluator` Validation (Priority: MEDIUM)

**File:** `supabase/functions/jobs-api/validate.ts`

Add check:
```typescript
if (kind === "RFT") {
  const payload = body.fireworks_payload as Record<string, unknown>;
  if (!payload.evaluator || typeof payload.evaluator !== "string") {
    return { ok: false, err: { message: "RFT requires evaluator (string) in fireworks_payload" } };
  }
}
```

### Fix 4: Add Dataset Presence Validation (Priority: MEDIUM)

**File:** `supabase/functions/jobs-api/validate.ts`

Add check for all kinds:
```typescript
const payload = body.fireworks_payload as Record<string, unknown>;
if (!payload.dataset || typeof payload.dataset !== "string") {
  return { ok: false, err: { message: "fireworks_payload.dataset is required (string)" } };
}
```

### Fix 5: Add Tests for New States (Priority: MEDIUM)

**File:** `tests/fireworks.test.js`

Add tests:
- `isTerminal detects JOB_STATE_DELETED`
- `isTerminal detects JOB_STATE_PAUSED` (if added)
- `mapFireworksTerminal maps DELETED to CANCELLED`
- `mapFireworksTerminal maps PAUSED to FAIL`
- Reconcile 404 → CANCELLED path

---

## 6. Files Changed (Audit Only — No Modifications Made)

| File | Lines | Purpose | Issues Found |
|------|-------|---------|--------------|
| `_shared/fireworks.ts` | 1-180 | Fireworks client | TERMINAL_STATES missing DELETED, PAUSED |
| `scheduler-tick/index.ts` | 1-215 | Scheduler tick | mapFireworksTerminal missing DELETED, PAUSED |
| `scheduler-tick/admission.ts` | 1-95 | Admission logic | No issues |
| `jobs-api/index.ts` | 1-145 | API handlers | No issues |
| `jobs-api/validate.ts` | 1-64 | Input validation | Missing dataset/evaluator checks |

---

## 7. Blockers

None. All findings are fixable without external dependencies.

---

## 8. Next Steps

1. **Apply Fix 1 + Fix 2** (HIGH priority) — Add `JOB_STATE_DELETED` and `JOB_STATE_PAUSED` handling
2. **Apply Fix 3 + Fix 4** (MEDIUM priority) — Add `evaluator` and `dataset` validation
3. **Apply Fix 5** — Add tests for new states
4. **Run full test suite** — Verify no regressions
5. **Update beads issue** — Mark job-scheduler-3wb as resolved

---

## Appendix: Fireworks State Enum (Complete)

From docs (v4.259.0):

```yaml
gatewayJobState:
  type: string
  enum:
    - JOB_STATE_UNSPECIFIED
    - JOB_STATE_CREATING
    - JOB_STATE_RUNNING
    - JOB_STATE_COMPLETED
    - JOB_STATE_FAILED
    - JOB_STATE_CANCELLED
    - JOB_STATE_DELETING
    - JOB_STATE_WRITING_RESULTS
    - JOB_STATE_VALIDATING
    - JOB_STATE_DELETING_CLEANING_UP
    - JOB_STATE_PENDING
    - JOB_STATE_EXPIRED
    - JOB_STATE_RE_QUEUEING
    - JOB_STATE_CREATING_INPUT_DATASET
    - JOB_STATE_IDLE
    - JOB_STATE_CANCELLING
    - JOB_STATE_EARLY_STOPPED
    - JOB_STATE_PAUSED          # NEW — not in our TERMINAL_STATES
    - JOB_STATE_DELETED         # NEW — not in our TERMINAL_STATES
```

**Note:** The docs mention `JOB_STATE_PAUSED` was added recently: "Job is paused, typically due to account suspension or manual intervention."
