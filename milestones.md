# Provider-Agnostic Queue — Implementation Milestones

## Goal
Make the job queue provider-agnostic, supporting **Fireworks** (managed fine-tuning API) as the primary provider and **Prime Intellect** (GPU cloud / pod provisioning) as a fallback. The system should transparently route jobs to the best available provider based on GPU capacity, while preserving all existing FIFO + per-user-cap + GPU-budget invariants.

---

## Milestone 1: Provider Adapter Interface & Fireworks Adapter Extraction

**What:** Create the `ProviderAdapter` abstraction and refactor the existing Fireworks-specific code into a `FireworksAdapter` that implements it. No behavior changes — this is pure structural refactoring to create the plugin point for new providers.

**Why:** The current codebase has Fireworks hardcoded in the scheduler, API, and tests. Before adding Prime Intellect, we need a clean interface so the rest of the system talks to "a provider" rather than "Fireworks."

**Files to create/modify:**
- `supabase/functions/_shared/providers/adapter.ts` — new interface
- `supabase/functions/_shared/providers/fireworks-adapter.ts` — new adapter
- `supabase/functions/_shared/providers/index.ts` — registry/factory
- `supabase/functions/_shared/fireworks.ts` — add deprecation comment, keep for compat
- `supabase/functions/scheduler-tick/admission.ts` — use adapter in SubmitFn
- `supabase/functions/scheduler-tick/index.ts` — use adapter factory
- `supabase/functions/jobs-api/index.ts` — use adapter for cancel

**Tests to write:**
- `tests/providers/adapter-interface.test.js` — verify interface contracts
- `tests/providers/fireworks-adapter.test.js` — verify FireworksAdapter delegates correctly
- `tests/scheduler-tick.provider-agnostic.test.js` — scheduler uses adapter, not direct FireworksClient

**Acceptance criteria:**
- [ ] `ProviderAdapter` interface defined with 5 methods
- [ ] `FireworksAdapter` implements all methods, delegating to `FireworksClient`
- [ ] Scheduler uses adapter factory, no direct `FireworksClient` references
- [ ] API cancel uses adapter, no direct `FireworksClient` references
- [ ] All existing tests still pass (fireworks.test.js, admission.test.js, jobs-api.validate.test.js)

**Prompt for coding worker:**
> Create a provider-adapter abstraction layer.
> 1. Define `ProviderAdapter` interface in `_shared/providers/adapter.ts` with: `checkAvailability`, `submitJob`, `getJobStatus`, `cancelJob`, `listActiveJobs`.
> 2. Create `FireworksAdapter` in `_shared/providers/fireworks-adapter.ts` wrapping the existing `FireworksClient`.
> 3. Create a `ProviderRegistry` factory in `_shared/providers/index.ts`.
> 4. Refactor `scheduler-tick/index.ts` and `jobs-api/index.ts` to use the registry.
> 5. Keep `fireworks.ts` unchanged but mark deprecated.
> 6. Update `admission.ts` `SubmitFn` to accept a `ProviderAdapter`.
> 7. Write unit tests for the adapter interface and FireworksAdapter delegation.
> Do NOT add Prime Intellect code. Do NOT change DB schema.

---

## Milestone 2: DB Schema Migration — Add Provider Columns

**What:** Add `provider`, `provider_job_id`, and `provider_payload` columns to the `jobs` table. Add a `model_resolutions` lookup table. Keep old `fireworks_payload` and `fireworks_job_name` for backward compatibility.

**Why:** The scheduler needs to know which provider is running a job and what its provider-specific ID is. The API needs to store provider-agnostic payloads. Model resolution lets users say "llama-3.1-8b" and we resolve it to the correct ID per provider.

**Migration:**
- `0004_provider_agnostic_schema.sql`
  - `ALTER TABLE jobs ADD COLUMN provider text;`
  - `ALTER TABLE jobs ADD COLUMN provider_job_id text;`
  - `ALTER TABLE jobs ADD COLUMN provider_payload jsonb;`
  - `CREATE TABLE model_resolutions (base_model text primary key, fireworks_model_id text, primeintellect_model_id text, updated_at timestamptz default now());`
  - Index on `jobs(provider, state)`

**Files to create/modify:**
- `supabase/migrations/0004_provider_agnostic_schema.sql`
- `supabase/functions/jobs-api/validate.ts` — accept `provider_payload`
- `supabase/functions/jobs-api/index.ts` — store `provider_payload`
- `supabase/functions/scheduler-tick/index.ts` — write `provider` and `provider_job_id` on admission

**Tests to write:**
- `tests/db-schema.test.js` — migration applies cleanly, columns exist
- `tests/jobs-api.provider-payload.test.js` — API stores/reads provider_payload

**Acceptance criteria:**
- [ ] Migration adds all new columns and table
- [ ] Scheduler writes `provider='fireworks'` and `provider_job_id` on admission
- [ ] API stores `provider_payload` on enqueue
- [ ] API falls back to `fireworks_payload` for backward compatibility
- [ ] All existing tests pass after migration

**Prompt for coding worker:**
> Write a DB schema migration and update the code to use it.
> 1. Create `supabase/migrations/0004_provider_agnostic_schema.sql` adding `provider`, `provider_job_id`, `provider_payload` to `jobs`, and `model_resolutions` table.
> 2. Update `jobs-api/validate.ts` to accept `provider_payload` (preferred) or `fireworks_payload` (fallback).
> 3. Update `jobs-api/index.ts` `handleCreate` to store `provider_payload`.
> 4. Update `scheduler-tick/index.ts` to write `provider` and `provider_job_id` on admission, and read them during reconciliation (with fallback to old columns).
> 5. Update `jobs-api/index.ts` cancel to read `provider_job_id` (with fallback).
> 6. Write tests verifying schema migration and payload storage.
> Do NOT remove old columns. Do NOT add Prime Intellect code.

---

## Milestone 3: Prime Intellect Adapter Implementation

**What:** Implement `PrimeIntellectAdapter` and `PrimeIntellectClient` for the Prime Intellect API. Support GPU availability checks, pod provisioning, status polling, and cancellation. Only RFT-style jobs for now.

**Why:** This is the new provider. Prime Intellect works differently from Fireworks — it's pod-based, uses TOML configs, and has a real-time GPU availability API. We need a complete adapter before wiring it into the scheduler.

**Files to create:**
- `supabase/functions/_shared/providers/primeintellect-client.ts` — low-level HTTP client
- `supabase/functions/_shared/providers/primeintellect-adapter.ts` — implements `ProviderAdapter`

**Key behaviors:**
- `checkAvailability`: Calls `GET /api/v1/availability/gpus?gpu_type=H100_80GB&gpu_count=N`. Returns `available=true` if any offer has `stockStatus === 'Available'`.
- `submitJob`: Creates a pod via `POST /api/v1/pods/` with `gpuType`, `gpuCount`, training image, and TOML config built from `hyperparameters` in `provider_payload`.
- `getJobStatus`: Polls pod status. Maps: `provisioning` → `QUEUED`, `running` → `RUNNING`, `stopped` → `FAILED` (conservative).
- `cancelJob`: Deletes the pod.
- `listActiveJobs`: Lists pods, filters non-terminal.

**Tests to write:**
- `tests/providers/primeintellect-client.test.js` — mock all API calls
- `tests/providers/primeintellect-adapter.test.js` — verify interface compliance

**Acceptance criteria:**
- [ ] `PrimeIntellectAdapter` implements all `ProviderAdapter` methods
- [ ] `checkAvailability` correctly interprets Prime Intellect availability API
- [ ] `submitJob` provisions a pod with correct TOML config
- [ ] `getJobStatus` maps pod states to `UnifiedJobStatus`
- [ ] `cancelJob` deletes the pod
- [ ] All methods have unit tests with mocked fetch

**Prompt for coding worker:**
> Implement the Prime Intellect provider adapter.
> 1. Create `primeintellect-client.ts` with methods: `checkGpuAvailability`, `createPod`, `getPod`, `listPods`, `deletePod`. Use `https://api.primeintellect.ai` and `PI_API_KEY` env var.
> 2. Create `primeintellect-adapter.ts` implementing `ProviderAdapter`:
>    - `checkAvailability(gpuCount, gpuType='H100_80GB')`: call availability API, return available if stockStatus==='Available'.
>    - `submitJob(job, payload)`: extract `base_model` and `hyperparameters` from payload, build TOML config, call `createPod`, return podId.
>    - `getJobStatus`: call `getPod`, map states to UnifiedJobStatus.
>    - `cancelJob`: call `deletePod`.
>    - `listActiveJobs`: call `listPods`, filter active.
> 3. Update `ProviderRegistry` to support `primeintellect`.
> 4. Write comprehensive unit tests with mocked fetch for all client and adapter methods.
> Do NOT wire into scheduler yet. Do NOT change API.

---

## Milestone 4: Provider Selection Strategy in Scheduler

**What:** Extend the scheduler admission loop to try multiple providers. Implement a configurable strategy (Fireworks-first with Prime Intellect fallback). Update GPU budgeting to aggregate across providers.

**Why:** This is the core integration. The scheduler must decide, for each job, which provider to use based on real-time availability. It must preserve FIFO, per-user cap, and GPU budget invariants across providers.

**Files to modify:**
- `supabase/functions/scheduler-tick/admission.ts` — try multiple providers per job
- `supabase/functions/scheduler-tick/index.ts` — initialize both adapters, build availability map
- `supabase/functions/_shared/providers/index.ts` — add strategy config

**Strategy logic (MVP):**
1. For each eligible job (FIFO order, user not active):
   a. Try Fireworks first. Check `checkAvailability(job.gpu_count)`. If available, submit.
   b. If Fireworks quota exhausted (quota error or insufficient GPU), try Prime Intellect.
   c. If Prime Intellect available, submit there.
   d. If neither available, stop admission (do not skip to smaller jobs).
2. Deduct from the chosen provider's budget. Record `provider` and `provider_job_id`.

**Env var:** `PROVIDER_STRATEGY=fireworks-first` (default). Future: `primeintellect-first`, `round-robin`, `cheapest`.

**Tests to write:**
- `tests/admission.multi-provider.test.js` — all multi-provider admission scenarios
- `tests/scheduler-tick.provider-selection.test.js` — integration with mocked adapters

**Acceptance criteria:**
- [ ] Fireworks-first strategy tries Fireworks then Prime Intellect
- [ ] GPU budgeting aggregates across providers
- [ ] Per-user cap works across all providers
- [ ] FIFO preserved regardless of provider
- [ ] Fireworks quota error does not block PI admission for same job
- [ ] Scheduler writes correct `provider` and `provider_job_id` for each outcome
- [ ] Reconciliation dispatches to correct adapter based on `provider` column

**Prompt for coding worker:**
> Integrate multi-provider selection into the scheduler.
> 1. Update `admission.ts` `runAdmission` to accept an array of `{provider, adapter, available}` and try each provider in order for each job.
> 2. Add `provider` field to the `admit` outcome.
> 3. Update `scheduler-tick/index.ts`:
>    - Initialize both `FireworksAdapter` and `PrimeIntellectAdapter`.
>    - Compute `fwAvailable` from Fireworks quota + active jobs.
>    - Compute `piAvailable` from Prime Intellect availability API.
>    - Build provider array ordered by `PROVIDER_STRATEGY` env var (default `fireworks-first`).
>    - Pass to `runAdmission`.
>    - On admission, write `provider` and `provider_job_id` to DB.
>    - On reconciliation, read `provider` from DB and use correct adapter.
> 4. Write unit tests:
>    - Fireworks available → admit via Fireworks.
>    - Fireworks exhausted, PI available → admit via PI.
>    - Both exhausted → stop.
>    - FIFO preserved across providers.
>    - Per-user cap enforced across providers.
> Do NOT change the jobs-api yet.

---

## Milestone 5: API Updates for Provider-Agnostic Enqueue & Cancel

**What:** Update the jobs-api to accept provider-agnostic payloads (`provider_payload` with `base_model`, `hyperparameters`, `dataset`) and optional `preferred_provider`. Cancel works across all providers.

**Why:** Users need to enqueue jobs without knowing which provider will run them. The API must validate the provider-agnostic format, store it, and let the scheduler decide. Cancel must work regardless of where the job is running.

**Request format (POST /jobs):**
```json
{
  "kind": "RFT",
  "display_name": "my run",
  "gpu_count": 4,
  "preferred_provider": null,
  "provider_payload": {
    "base_model": "llama-3.1-8b",
    "dataset": "my-dataset",
    "hyperparameters": {
      "learning_rate": 1e-5,
      "epochs": 3,
      "batch_size": 64,
      "max_steps": 100,
      "lora_alpha": 16
    }
  }
}
```

**Backward compatibility:** If `provider_payload` is missing but `fireworks_payload` is present, accept it and implicitly set `preferred_provider='fireworks'`.

**Files to modify:**
- `supabase/functions/jobs-api/validate.ts` — validate `provider_payload`, `preferred_provider`
- `supabase/functions/jobs-api/index.ts` — store new fields, dispatch cancel to correct adapter

**Tests to write:**
- `tests/jobs-api.provider-agnostic.test.js` — enqueue with provider_payload
- `tests/jobs-api.cancel.test.js` — cancel for each provider and not-yet-admitted jobs

**Acceptance criteria:**
- [ ] POST /jobs accepts `provider_payload` with `base_model`, `hyperparameters`, `dataset`
- [ ] POST /jobs accepts optional `preferred_provider`
- [ ] POST /jobs validates `base_model` exists in `model_resolutions`
- [ ] GET /jobs returns `provider` and `provider_job_id`
- [ ] DELETE /jobs/:id dispatches cancel to correct adapter based on `provider` column
- [ ] Cancel works for not-yet-admitted jobs (provider=null)
- [ ] Backward compatibility with `fireworks_payload` preserved

**Prompt for coding worker:**
> Update the jobs-api for full provider agnosticism.
> 1. Update `validate.ts`:
>    - Accept `provider_payload` (preferred) or `fireworks_payload` (fallback).
>    - `provider_payload` must have `base_model` (string, non-empty) and optional `hyperparameters` (object).
>    - Accept optional `preferred_provider: 'fireworks' | 'primeintellect'`.
>    - If only `fireworks_payload` present, set `preferred_provider='fireworks'` implicitly.
> 2. Update `jobs-api/index.ts` `handleCreate`:
>    - Store `provider_payload` and `preferred_provider` in DB.
>    - Do NOT resolve model IDs at enqueue time.
> 3. Update `handleCancel`:
>    - Read `provider` and `provider_job_id` from DB.
>    - If `provider === null` (not admitted), mark CANCELLED directly.
>    - If `provider === 'fireworks'`, use `FireworksAdapter.cancelJob`.
>    - If `provider === 'primeintellect'`, use `PrimeIntellectAdapter.cancelJob`.
>    - Remove hardcoded `FIREWORKS_API_KEY` check — use registry.
> 4. Update `handleGetOne` and `handleList` to include `provider` and `provider_job_id`.
> 5. Write tests for provider-agnostic enqueue, backward-compatible enqueue, and cancel for each provider.
> Do NOT change scheduler admission logic.

---

## Milestone 6: Model Resolution & Hyperparameter Mapping

**What:** Implement the model resolution layer (base_model → provider-specific IDs) and hyperparameter normalization (same params → Fireworks JSON vs Prime Intellect TOML).

**Why:** Users should not need to know provider-specific model IDs or config formats. "llama-3.1-8b" should work everywhere. Hyperparameters like `epochs` need conversion because Fireworks uses epochs while Prime Intellect uses `max_steps`.

**Files to create/modify:**
- `supabase/functions/_shared/model-resolution.ts` — query `model_resolutions` table
- `supabase/functions/_shared/hyperparameters.ts` — normalize for Fireworks and PI
- `supabase/functions/_shared/providers/fireworks-adapter.ts` — use resolution + normalization
- `supabase/functions/_shared/providers/primeintellect-adapter.ts` — use resolution + normalization
- `supabase/migrations/0005_seed_model_resolutions.sql` — seed initial mappings

**Conversion rules:**
- Fireworks: `learning_rate` → `trainingConfig.learningRate`, `epochs` → `trainingConfig.epochs`, `batch_size` → `trainingConfig.batchSize`, `model` → resolved fireworks_model_id
- Prime Intellect: `learning_rate` → `learning_rate`, `batch_size` → `batch_size`, `lora_alpha` → `lora_alpha`, `max_steps` → `max_steps` (or compute from `epochs * dataset_size / batch_size` if dataset_size known), `model` → resolved pi_model_id

**Tests to write:**
- `tests/model-resolution.test.js` — lookup, cache, not-found error
- `tests/hyperparameters.test.js` — all conversions, edge cases

**Acceptance criteria:**
- [ ] `resolveModel('llama-3.1-8b', 'fireworks')` returns correct Fireworks model ID
- [ ] `resolveModel('llama-3.1-8b', 'primeintellect')` returns correct PI model ID
- [ ] Unknown `base_model` throws `ModelNotFoundError`
- [ ] `normalizeForFireworks` builds correct JSON payload
- [ ] `normalizeForPrimeIntellect` builds correct TOML string
- [ ] `epochs → max_steps` conversion works when `dataset_size` provided
- [ ] Seed migration populates known mappings

**Prompt for coding worker:**
> Build the model resolution and hyperparameter mapping layer.
> 1. Create `model-resolution.ts`:
>    - `resolveModel(baseModel, provider)` queries `model_resolutions` table, returns provider-specific ID.
>    - Throws `ModelNotFoundError` if unknown.
>    - Caches results in-memory for the tick.
> 2. Create `hyperparameters.ts`:
>    - `normalizeForFireworks(params, resolvedModel, dataset)` → Fireworks JSON payload.
>    - `normalizeForPrimeIntellect(params, resolvedModel, datasetSize?)` → TOML string.
>    - Handle `epochs` → `max_steps` conversion when dataset size known.
> 3. Update `FireworksAdapter.submitJob` to use both helpers.
> 4. Update `PrimeIntellectAdapter.submitJob` to use both helpers.
> 5. Create `0005_seed_model_resolutions.sql` with initial mappings (verify IDs against docs).
> 6. Update `jobs-api/validate.ts` to check `base_model` exists at enqueue time.
> 7. Write unit tests for resolution and all normalization paths.
> Do NOT change scheduler admission logic. Do NOT change API response shapes.

---

## Milestone 7: End-to-End Integration Tests & Documentation

**What:** Write comprehensive E2E tests covering the full provider-agnostic lifecycle. Update README and provider adapter docs. Final review for regressions.

**Why:** This is the final validation milestone. E2E tests prove the system works as a whole — enqueue, admission with provider selection, reconciliation, cancel — without relying on live provider APIs (all mocked).

**E2E test scenarios:**
1. **Fireworks-only path:** Enqueue SFT → scheduler admits via Fireworks → reconcile to SUCCESS → verify DB.
2. **Prime Intellect fallback:** Enqueue RFT with Fireworks quota=0 → scheduler admits via PI → reconcile to terminal → verify `provider='primeintellect'`.
3. **Cancel Fireworks job:** In-progress Fireworks job → cancel → verify `cancelJob` called + DB CANCELLED.
4. **Cancel PI job:** In-progress PI job → cancel → verify `deletePod` called + DB CANCELLED.
5. **Per-user cap across providers:** User has Fireworks job in PROGRESS → second job cannot admit to PI either.
6. **FIFO with fallback:** Job A (large GPU) queued first, Fireworks exhausted → admit Job A to PI, Job B (small GPU) stays queued because A was first.

**Files to create/modify:**
- `tests/e2e/provider-agnostic.test.js`
- `tests/e2e/fireworks-only.test.js`
- `tests/e2e/primeintellect-fallback.test.js`
- `README.md`
- `supabase/functions/_shared/providers/README.md`

**Acceptance criteria:**
- [ ] All 6 E2E scenarios pass
- [ ] All unit tests from M1-M6 still pass
- [ ] No regressions in existing Fireworks-only behavior
- [ ] README documents architecture, supported providers, configuration
- [ ] Provider adapter README documents how to add a new provider
- [ ] Code review: no hardcoded Fireworks references outside adapters

**Prompt for coding worker:**
> Write end-to-end integration tests and documentation.
> 1. Create `tests/e2e/provider-agnostic.test.js` with mocked adapters and mock DB client. Test full lifecycle: enqueue → tick → reconcile → cancel. Verify all DB state transitions and provider fields.
> 2. Create `tests/e2e/fireworks-only.test.js` — regression test for existing behavior.
> 3. Create `tests/e2e/primeintellect-fallback.test.js` — specifically test fallback when Fireworks is exhausted.
> 4. Update `README.md` with architecture overview, supported providers, env vars, model resolution, and "adding a new provider" guide.
> 5. Create `supabase/functions/_shared/providers/README.md` with adapter development guide.
> 6. Run ALL tests (unit + e2e) and ensure 100% pass.
> 7. Do a final grep for hardcoded Fireworks references outside adapter files.
> This is the final milestone — no new features, only tests and docs.

---

## Dependency Graph

```
M1 ──→ M2 ──→ M4 ──→ M5 ──→ M7
  │      │      ↑
  └────→ M3 ────┘      └────→ M6 ──→ M7
```

- **M1** (Adapter Interface) is the foundation for everything.
- **M2** (DB Schema) and **M3** (PI Adapter) are independent after M1.
- **M4** (Provider Selection) depends on both M2 and M3.
- **M5** (API Updates) depends on M4.
- **M6** (Model Resolution) depends on M3 and M5.
- **M7** (E2E Tests) depends on all prior milestones.

---

## Open Questions

1. **Prime Intellect SFT/DPO support?** Their docs focus on RFT/reinforcement learning with TOML configs. SFT/DPO may require custom training scripts inside pods — defer to Phase 2.
2. **Dataset upload to Prime Intellect?** Fireworks uses pre-uploaded datasets by name. Prime Intellect may require dataset upload to pod or use of their dataset hub. Need to verify API.
3. **Exact Prime Intellect model IDs?** Research used examples from docs but they may not be exact. Verify before finalizing seed migration.
4. **Prime Intellect training image?** What docker image or hosted training environment should be used when creating pods? Verify with PI docs.
5. **Prime Intellect billing model?** Per-hour GPU rental or per-token? Affects future cost-based provider selection.
6. **Provider payload `kind` field?** Should `provider_payload` include `kind` or is that still at the jobs table level? Current design keeps `kind` on the table.
7. **Relax per-user cap for different providers?** Recommendation: keep the constraint — it's a user-level cap, not provider-level.
8. **Prime Intellect pod provisioning failures?** What if a pod fails during provisioning (out of stock after availability check)? Need retry/backoff logic — possibly a new milestone.
9. **Backfill existing jobs?** Do we need a migration to set `provider='fireworks'` for existing in-progress jobs? Yes — handle in code with fallback reads or add a one-time migration.
