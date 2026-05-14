## ADDED Requirements

### Requirement: Periodic scheduler tick

The system SHALL run a scheduler tick at least every 60 seconds that (a) reconciles `PROGRESS` jobs against Fireworks and (b) admits eligible `QUEUED` jobs.

#### Scenario: Tick cadence

- **WHEN** the scheduler has been deployed and `pg_cron` is configured
- **THEN** the tick Edge Function SHALL be invoked on a schedule of 60 seconds or less.

#### Scenario: Overlapping ticks are serialised

- **WHEN** a second tick begins while a previous tick is still running
- **THEN** the second tick SHALL acquire a Postgres advisory lock and, failing that, return immediately without performing admission or reconciliation.

### Requirement: Reconcile in-progress jobs with Fireworks

The tick SHALL update the state of every `PROGRESS` job by polling the Fireworks endpoint that matches the job's `kind` — `/supervisedFineTuningJobs/{name}` for `SFT`, `/dpoJobs/{name}` for `DPO`.

#### Scenario: SFT job reports completion

- **WHEN** a `PROGRESS` job with `kind = 'SFT'` has a Fireworks state of `COMPLETED`
- **THEN** the tick SHALL set `state = 'SUCCESS'` and `completed_at = now()`.

#### Scenario: DPO job reports completion

- **WHEN** a `PROGRESS` job with `kind = 'DPO'` has a Fireworks state of `COMPLETED`
- **THEN** the tick SHALL set `state = 'SUCCESS'` and `completed_at = now()`.

#### Scenario: Fireworks reports failure or cancellation

- **WHEN** a job in state `PROGRESS` (of any `kind`) has a Fireworks state of `FAILED` or `CANCELLED`
- **THEN** the tick SHALL set `state = 'FAIL'` (or `CANCELLED` if the cancellation originated from our `DELETE /jobs/:id` flow), `completed_at = now()`, and populate `error` with any error message from Fireworks.

#### Scenario: Fireworks is unreachable

- **WHEN** the Fireworks poll fails with a network or 5xx error
- **THEN** the tick SHALL leave job state unchanged and MUST NOT mark the job as `FAIL`.

### Requirement: Admit jobs using FIFO + fairness + GPU budget

The tick SHALL select at most one `QUEUED` job per eligible user per iteration, in FIFO order across both `SFT` and `DPO` kinds, and submit it to Fireworks only if GPU budget allows.

#### Scenario: FIFO selection is kind-agnostic

- **WHEN** multiple jobs are `QUEUED` and eligible — possibly mixing `SFT` and `DPO`
- **THEN** the tick SHALL consider them in ascending `created_at` order **regardless of `kind`** and admit whichever fits the available GPU budget first.

#### Scenario: Per-user concurrency limit spans kinds

- **WHEN** a user already has a job in state `PROGRESS` (of any `kind`)
- **THEN** the tick MUST NOT admit any further jobs belonging to that user in this iteration — including a job of a different `kind`.

#### Scenario: GPU budget respected

- **WHEN** the tick considers a candidate job with `gpu_count = N`
- **THEN** the tick MUST verify `N <= fw_available`, where `fw_available = FIREWORKS_GPU_QUOTA - (sum of gpu_count of non-terminal Fireworks SFT jobs + sum of gpu_count of non-terminal Fireworks DPO jobs, both as reported live by Fireworks)`, before submitting it.

#### Scenario: Insufficient GPU budget

- **WHEN** the earliest eligible candidate has `gpu_count > fw_available`
- **THEN** the tick SHALL skip it and try the next candidate; it MUST NOT reorder smaller jobs ahead of strictly earlier eligible candidates *whose user has no active job*. Informally: smaller later jobs may fill remaining headroom only once the earlier candidate has been admitted or determined ineligible for non-GPU reasons.

#### Scenario: Big-job concurrency cap

- **WHEN** the tick considers a candidate with `gpu_count >= 8` and at least `1` big-job (gpu_count >= 8) is already active on Fireworks
- **THEN** the tick MUST NOT admit the candidate; it SHALL skip it and continue evaluating the rest of the queue (smaller jobs may still admit). The cap is a per-class eligibility constraint, not a global resource shortage — it does not stop the admission loop. The big-job count is computed from live Fireworks state cross-referenced against the local jobs table: scheduler-submitted jobs contribute their DB `gpu_count`; jobs running on Fireworks with no matching DB row (out-of-band / `firectl` submissions) are conservatively treated as big-jobs.

#### Scenario: Successful admission

- **WHEN** a candidate job passes all admission checks and the Fireworks submit call returns `200` with a job name — `POST /supervisedFineTuningJobs` for `kind = 'SFT'` or `POST /dpoJobs` for `kind = 'DPO'`
- **THEN** the tick SHALL, in a single transaction, set the row's `state = 'PROGRESS'`, `started_at = now()`, `fireworks_job_name` to the returned name, and decrement the in-memory `fw_available` counter by `gpu_count`.

#### Scenario: Fireworks rejects a submission with a quota error

- **WHEN** Fireworks returns a quota-exceeded error (e.g. `in use: 8, quota: 8`) on submission
- **THEN** the tick SHALL leave the job `QUEUED` and stop admitting further jobs for the remainder of this iteration.

#### Scenario: Fireworks rejects a submission with a client error

- **WHEN** Fireworks returns a `4xx` error that is not quota-related (e.g. invalid payload)
- **THEN** the tick SHALL set `state = 'FAIL'`, `completed_at = now()`, and `error` to the response body, and continue admitting other jobs.

### Requirement: Database-enforced per-user concurrency invariant

The schema SHALL enforce that at most one job per user can be in state `PROGRESS` at any moment.

#### Scenario: Concurrent admission of two jobs for one user is rejected

- **WHEN** two scheduler transactions concurrently attempt to set two different jobs of the same user to `PROGRESS`
- **THEN** exactly one transaction SHALL commit; the other SHALL be rejected by a partial unique index `unique(user_id) where state = 'PROGRESS'`.

### Requirement: Tick endpoint is only callable by the scheduler itself

The scheduler tick endpoint SHALL reject any request that does not present the configured shared secret.

#### Scenario: Unauthenticated tick call

- **WHEN** an external caller requests the tick endpoint without the `X-Scheduler-Secret` header (or with a wrong value)
- **THEN** the endpoint SHALL respond `401 Unauthorized` and MUST NOT perform any reconciliation or admission.
