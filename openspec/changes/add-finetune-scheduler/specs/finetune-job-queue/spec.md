## ADDED Requirements

### Requirement: Enqueue a fine-tuning job

The system SHALL expose `POST /jobs` that accepts an authenticated request carrying a fine-tuning job kind (`SFT` or `DPO`) plus the corresponding Fireworks request body, and persists it as a `QUEUED` job owned by the caller.

#### Scenario: Successful SFT enqueue

- **WHEN** an authenticated trainer `POST /jobs` with a JSON body `{ "kind": "SFT", "display_name": "...", "gpu_count": 4, "fireworks_payload": { ...valid SFT body... } }`
- **THEN** the system SHALL insert a row into `jobs` with `kind = 'SFT'`, `state = 'QUEUED'`, `user_id` set from the authenticated API key, `created_at = now()`, and return `201` with `{ "id": "<uuid>", "kind": "SFT", "state": "QUEUED", "created_at": "..." }`.

#### Scenario: Successful DPO enqueue

- **WHEN** an authenticated trainer `POST /jobs` with a JSON body `{ "kind": "DPO", "display_name": "...", "gpu_count": 4, "fireworks_payload": { ...valid DPO body with lossConfig, trainingConfig... } }`
- **THEN** the system SHALL insert a row into `jobs` with `kind = 'DPO'`, `state = 'QUEUED'`, and return `201` with `{ "id": "<uuid>", "kind": "DPO", "state": "QUEUED", "created_at": "..." }`.

#### Scenario: Missing or invalid auth

- **WHEN** a caller `POST /jobs` without an `Authorization: Bearer` header, or with a key that is unknown or revoked
- **THEN** the system SHALL respond `401 Unauthorized` and MUST NOT insert a job row.

#### Scenario: Invalid payload shape

- **WHEN** an authenticated trainer `POST /jobs` without `fireworks_payload`, with `gpu_count <= 0`, or with a `kind` that is not `SFT` or `DPO`
- **THEN** the system SHALL respond `400 Bad Request` with a human-readable error and MUST NOT insert a job row.

#### Scenario: Default GPU count

- **WHEN** an authenticated trainer `POST /jobs` omits `gpu_count`
- **THEN** the system SHALL default `gpu_count` to `4`.

### Requirement: List caller's jobs

The system SHALL expose `GET /jobs` that returns the authenticated caller's jobs, most recent first, across both kinds.

#### Scenario: Default listing

- **WHEN** an authenticated trainer `GET /jobs`
- **THEN** the system SHALL return `200` with an array of `{ id, kind, state, display_name, gpu_count, created_at, started_at, completed_at, error, fireworks_job_name }` for every job where `user_id` matches the caller, ordered by `created_at` descending.

#### Scenario: State filter

- **WHEN** an authenticated trainer `GET /jobs?state=QUEUED`
- **THEN** the system SHALL return only the caller's jobs in state `QUEUED`.

#### Scenario: Kind filter

- **WHEN** an authenticated trainer `GET /jobs?kind=DPO`
- **THEN** the system SHALL return only the caller's jobs with `kind = 'DPO'`.

### Requirement: Fetch a single job

The system SHALL expose `GET /jobs/:id` returning the job record if it belongs to the caller.

#### Scenario: Own job

- **WHEN** an authenticated trainer `GET /jobs/:id` for a job they own
- **THEN** the system SHALL return `200` with the job record including `kind`.

#### Scenario: Someone else's job

- **WHEN** an authenticated trainer `GET /jobs/:id` for a job whose `user_id` differs from the caller
- **THEN** the system SHALL return `404 Not Found` (not `403`, to avoid leaking existence).

### Requirement: Cancel a job

The system SHALL expose `DELETE /jobs/:id` that cancels the job if the caller owns it.

#### Scenario: Cancel a queued job

- **WHEN** an authenticated trainer `DELETE /jobs/:id` for a job they own in state `QUEUED`
- **THEN** the system SHALL set `state = 'CANCELLED'`, `completed_at = now()`, and return `200`.

#### Scenario: Cancel an in-progress job

- **WHEN** an authenticated trainer `DELETE /jobs/:id` for a job they own in state `PROGRESS`
- **THEN** the system SHALL call the Fireworks cancel endpoint that corresponds to the job's `kind` (SFT endpoint for SFT jobs, DPO endpoint for DPO jobs) for the associated `fireworks_job_name`, and on success set `state = 'CANCELLED'` and `completed_at = now()` and return `200`.

#### Scenario: Cancel a terminal job

- **WHEN** an authenticated trainer `DELETE /jobs/:id` for a job in state `SUCCESS`, `FAIL`, or `CANCELLED`
- **THEN** the system SHALL return `409 Conflict` and leave the row unchanged.

### Requirement: Job state machine

The system SHALL enforce a strict job state machine: `QUEUED → PROGRESS → {SUCCESS, FAIL}`, and `QUEUED → CANCELLED`, and `PROGRESS → CANCELLED`. This applies identically to `SFT` and `DPO` jobs.

#### Scenario: No backwards transitions

- **WHEN** any component attempts to transition a job from a terminal state (`SUCCESS`, `FAIL`, `CANCELLED`) to any other state
- **THEN** the update SHALL be rejected (application-level guard plus database check constraint).

#### Scenario: Persisted state is authoritative

- **WHEN** a client reads a job via the API
- **THEN** the returned `state` SHALL reflect the row in `jobs` at read time, not any cached or in-flight Fireworks state.

### Requirement: Job kind is immutable

Once persisted, a job's `kind` SHALL NOT change for the lifetime of the row.

#### Scenario: No kind mutation

- **WHEN** any component attempts to update a job row's `kind` field after insert
- **THEN** the update SHALL be rejected (database-level enforcement via trigger or omission of `kind` from the application's update path).
