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

#### Scenario: Per-user concurrency caps split by job size

- **WHEN** the tick considers a candidate job for user `U`
- **THEN** the tick MUST enforce two independent caps: at most 2 concurrent small (`gpu_count < 8`) jobs and at most 1 concurrent big (`gpu_count >= 8`) job per user. Big-job concurrency is also DB-enforced via a partial unique index. Hitting either cap produces `skip_user_small_cap` / `skip_user_big_cap` and the tick continues evaluating remaining candidates (smaller jobs from other users may still admit).

#### Scenario: GPU budget respected

- **WHEN** the tick considers a candidate job with `gpu_count = N`
- **THEN** the tick MUST verify `N <= fw_available`, where `fw_available = FIREWORKS_GPU_QUOTA - (sum of gpu_count of non-terminal Fireworks SFT jobs + sum of gpu_count of non-terminal Fireworks DPO jobs, both as reported live by Fireworks)`, before submitting it.

#### Scenario: Insufficient GPU budget

- **WHEN** the earliest eligible candidate has `gpu_count > fw_available`
- **THEN** the tick SHALL skip it and try the next candidate; it MUST NOT reorder smaller jobs ahead of strictly earlier eligible candidates *whose user has no active job*. Informally: smaller later jobs may fill remaining headroom only once the earlier candidate has been admitted or determined ineligible for non-GPU reasons.

#### Scenario: Big-job admission preserves small-job headroom

- **WHEN** the tick considers a big candidate (`gpu_count >= 8`)
- **THEN** the tick MUST verify that admitting it would leave at least `BIG_JOB_HEADROOM_RESERVE` (=4) GPUs of remaining headroom — i.e. `fw_available - candidate.gpu_count >= 4`. If not, the candidate is skipped with `skip_big_headroom` and the tick continues evaluating smaller queued jobs. This preserves at least one small-job slot at the moment of big-job admission. There is no system-wide cap on concurrent big jobs; admission is naturally limited by per-user cap + budget + headroom rule.

#### Scenario: Successful admission

- **WHEN** a candidate job passes all admission checks and the Fireworks submit call returns `200` with a job name — `POST /supervisedFineTuningJobs` for `kind = 'SFT'` or `POST /dpoJobs` for `kind = 'DPO'`
- **THEN** the tick SHALL, in a single transaction, set the row's `state = 'PROGRESS'`, `started_at = now()`, `fireworks_job_name` to the returned name, and decrement the in-memory `fw_available` counter by `gpu_count`.

#### Scenario: Fireworks rejects a submission with a quota error

- **WHEN** Fireworks returns a quota-exceeded error (e.g. `in use: 8, quota: 8`) on submission
- **THEN** the tick SHALL leave the job `QUEUED` and stop admitting further jobs for the remainder of this iteration.

#### Scenario: Fireworks rejects a submission with a client error

- **WHEN** Fireworks returns a `4xx` error that is not quota-related (e.g. invalid payload)
- **THEN** the tick SHALL set `state = 'FAIL'`, `completed_at = now()`, and `error` to the response body, and continue admitting other jobs.

### Requirement: Database-enforced big-job per-user invariant

The schema SHALL enforce at most one big-job (`gpu_count >= 8`) per user in state `PROGRESS` at any moment. Small-job concurrency is enforced in admission code only.

#### Scenario: Concurrent admission of two big jobs for one user is rejected

- **WHEN** two scheduler transactions concurrently attempt to set two different big jobs (`gpu_count >= 8`) of the same user to `PROGRESS`
- **THEN** exactly one transaction SHALL commit; the other SHALL be rejected by a partial unique index `unique(user_id) where state = 'PROGRESS' and gpu_count >= 8`.

### Requirement: Tick endpoint is only callable by the scheduler itself

The scheduler tick endpoint SHALL reject any request that does not present the configured shared secret.

#### Scenario: Unauthenticated tick call

- **WHEN** an external caller requests the tick endpoint without the `X-Scheduler-Secret` header (or with a wrong value)
- **THEN** the endpoint SHALL respond `401 Unauthorized` and MUST NOT perform any reconciliation or admission.
