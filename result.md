# Research: Provider-Agnostic Queue — Prime Intellect vs Fireworks

## Executive Summary

Prime Intellect and Fireworks are **fundamentally different paradigms**:
- **Fireworks**: Managed fine-tuning API (SFT/DPO/RFT). Submit a JSON payload → job runs on their infra → poll for state. GPU quota is account-based (`training-h200-count`).
- **Prime Intellect**: GPU cloud / pod provisioning. You provision a pod with GPUs, then run training yourself (or via their hosted training which uses TOML configs and runs inside pods). Their API is primarily: check GPU availability → create pod → run job → monitor pod/training run.

This means a "provider-agnostic queue" cannot simply swap one API call for another. We need an **abstraction layer** that:
1. Presents a unified job submission interface to users
2. Decides provider based on GPU availability + job requirements
3. Translates the unified request into provider-specific operations
4. Polls/monitoring provider-specific status and normalizes results

---

## 1. Fireworks API (Current Integration)

### Auth
- `Authorization: Bearer <FIREWORKS_API_KEY>`
- API key stored in `FIREWORKS_API_KEY` env var

### Base URL
- `https://api.fireworks.ai/v1/accounts/{account_id}`
- Account: `trilogy`

### Job Types & Endpoints
| Kind | Endpoint | List Key |
|------|----------|----------|
| SFT | `POST /supervisedFineTuningJobs` | `supervisedFineTuningJobs` |
| DPO | `POST /dpoJobs` | `dpoJobs` |
| RFT | `POST /reinforcementFineTuningJobs` | `reinforcementFineTuningJobs` |

### Job States (protobuf-style)
- `JOB_STATE_CREATING`, `JOB_STATE_PENDING`, `JOB_STATE_RUNNING`, `JOB_STATE_CANCELLING`
- Terminal: `JOB_STATE_COMPLETED`, `JOB_STATE_FAILED`, `JOB_STATE_CANCELLED`, `JOB_STATE_EXPIRED`, `JOB_STATE_EARLY_STOPPED`

### GPU Quota Discovery
- `GET /v1/accounts/{account_id}/quotas` → filter for training GPU quotas
- Returns `{ name, value, maxValue, usage }`
- Current code computes usage by summing `gpu_count` across active jobs (quota `usage` counter observed to get stuck)

### Job Submission Payload
- SFT: `{ displayName, dataset, trainingConfig: { learningRate, epochs, batchSize, ... }, model, ... }`
- DPO: similar structure with `trainingConfig`
- RFT: `{ displayName, dataset, evaluator, trainingConfig, ... }`

### Cancellation
- SFT/DPO: `DELETE /{kind}/{id}` (no :cancel endpoint)
- RFT: `POST /{kind}/{id}:cancel` or `DELETE`

### Result Format
- Job object with `state`, `status` (detailed message), `model` (trained model ID), `trainerLogsSignedUrl`

---

## 2. Prime Intellect API

### Auth
- `Authorization: Bearer <PI_API_KEY>`
- API key with appropriate permissions (Instances → Read and write for pod creation)

### Base URL
- `https://api.primeintellect.ai`

### Core Concepts
1. **GPU Availability API**: `GET /api/v1/availability/gpus?gpu_type=H100_80GB&regions=...&gpu_count=N`
   - Returns offers from multiple providers (hyperstack, etc.)
   - Each offer has: `cloudId`, `gpuType`, `provider`, `dataCenter`, `gpuCount`, `prices.onDemand`, `stockStatus`

2. **Pod Creation**: `POST /api/v1/pods/`
   - Request body: `{ pod: PodRequestConfig, provider: ProviderConfig, disks?, team? }`
   - Pod config includes: `gpuType`, `gpuCount`, `image`, `name`, etc.
   - Provider config includes: `providerName`, `dataCenter`, `cloudId`

3. **Hosted Training (RFT-like)**: Configured via `.toml` file
   - Model selection: HuggingFace model IDs (`Qwen/Qwen3.5-35B-A3B`, `meta-llama/Llama-3.2-1B-Instruct`, etc.)
   - Config fields: `model`, `max_steps`, `batch_size`, `rollouts_per_example`, `learning_rate`, `lora_alpha`
   - Environments: `[[env]]` blocks with `id` (e.g., `primeintellect/alphabet-sort`)
   - Billing: per-million-tokens pricing (input/output/train)

4. **Pod Monitoring**: `GET /api/v1/pods/` → list pods with status
   - Pod states: provisioning, running, stopped, etc.

5. **Training Run Monitoring**: `GET /api/v1/billing/runs/{run_id}/usage`
   - Returns token usage breakdown: training, inference, total cost

### GPU Types Available
- `H100_80GB` (primary)
- Others via availability API

### Pricing Model
- Per-million tokens (input, output, training separately)
- No fixed GPU quota like Fireworks — pay-as-you-go based on tokens used

---

## 3. Critical Differences & Conversion Challenges

### Paradigm Difference
| Aspect | Fireworks | Prime Intellect |
|--------|-----------|-----------------|
| **Unit of work** | Job (SFT/DPO/RFT) | Pod + Training Run |
| **GPU allocation** | Implicit via quota | Explicit via pod creation |
| **Job config** | JSON payload | TOML file for hosted training |
| **Monitoring** | Poll job state | Poll pod status + run usage |
| **Pricing** | Included in API cost | Per-token billing |
| **Cancellation** | DELETE / :cancel | Stop/delete pod |

### Data Format Differences

**Fireworks SFT payload example:**
```json
{
  "displayName": "my-sft-job",
  "dataset": "my-dataset",
  "trainingConfig": {
    "learningRate": 1e-5,
    "epochs": 3,
    "batchSize": 64
  },
  "model": "accounts/fireworks/models/llama-v3p1-8b-instruct"
}
```

**Prime Intellect hosted training TOML example:**
```toml
model = "Qwen/Qwen3.5-35B-A3B"
max_steps = 100
batch_size = 256
rollouts_per_example = 8
learning_rate = 1e-4
lora_alpha = 16

[sampling]
max_tokens = 512

[[env]]
id = "primeintellect/alphabet-sort"
```

### Hyperparameter Mapping (Approximate)
| Concept | Fireworks | Prime Intellect |
|---------|-----------|-----------------|
| Learning rate | `trainingConfig.learningRate` | `learning_rate` |
| Epochs | `trainingConfig.epochs` | implicit via `max_steps` + dataset size |
| Batch size | `trainingConfig.batchSize` | `batch_size` |
| Model | Fireworks model ID | HuggingFace model ID |
| LoRA | implicit | `lora_alpha` |

### Model ID Mapping
- Fireworks uses proprietary IDs: `accounts/fireworks/models/llama-v3p1-8b-instruct`
- Prime Intellect uses HuggingFace IDs: `meta-llama/Llama-3.2-1B-Instruct`
- **No automatic mapping exists** — we need a lookup table or let users specify base model names that we resolve per-provider.

---

## 4. GPU Availability Model

### Fireworks
- `GET /quotas` → `maxValue` minus computed active usage = available GPUs
- Quota names like `training-h200-count`
- Fixed account-level quota

### Prime Intellect
- `GET /api/v1/availability/gpus` → real-time offers from cloud providers
- Returns multiple offers with `stockStatus` (Available, OutOfStock, etc.)
- Must select an offer and create a pod
- No fixed quota — availability is dynamic market-based

### Provider Selection Logic
To select a provider based on GPU availability:
1. **Fireworks**: Check if `available_gpus >= job.gpu_count` via quota API
2. **Prime Intellect**: Check if any offer matches `gpu_type` and `gpu_count` with `stockStatus == "Available"`
3. **Selection strategy**:
   - Try Fireworks first (managed, simpler) if GPUs available
   - Fallback to Prime Intellect if Fireworks quota exhausted
   - Or: user preference / cost-optimization / latency-based
   - For MVP: simple priority — Fireworks first, then Prime Intellect

---

## 5. Implications for Provider-Agnostic Design

### Required Abstractions

```typescript
// Unified job request (user-facing)
interface TrainingJobRequest {
  kind: "SFT" | "DPO" | "RFT";
  display_name: string;
  gpu_count: number;
  // Provider-agnostic hyperparameters
  base_model: string;        // e.g., "llama-3.1-8b" — resolved per-provider
  dataset: string;
  hyperparameters: {
    learning_rate?: number;
    epochs?: number;
    batch_size?: number;
    max_steps?: number;
    lora_alpha?: number;
    // ... other common params
  };
}

// Provider adapter interface
interface ProviderAdapter {
  readonly name: "fireworks" | "primeintellect";
  
  // Check GPU availability for this job
  checkAvailability(gpuCount: number, gpuType?: string): Promise<AvailabilityResult>;
  
  // Submit a job
  submitJob(request: TrainingJobRequest): Promise<ProviderJobRef>;
  
  // Get job status
  getJobStatus(ref: ProviderJobRef): Promise<UnifiedJobStatus>;
  
  // Cancel a job
  cancelJob(ref: ProviderJobRef): Promise<void>;
  
  // List active jobs (for GPU budgeting)
  listActiveJobs(): Promise<ProviderJobRef[]>;
}

// Normalized status across providers
interface UnifiedJobStatus {
  state: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  provider_job_id: string;
  provider: string;
  details?: Record<string, unknown>;
}
```

### Database Changes Needed
- Add `provider` column to `jobs` table (nullable, populated on admission)
- Add `provider_job_id` column (e.g., Fireworks job name or Prime Intellect pod ID)
- Rename `fireworks_payload` → `provider_payload` or `job_request` (JSONB, provider-agnostic)
- Add `provider_payload` column for provider-specific submission data (optional)
- Add model resolution table (base_model → { fireworks_id, pi_id })

### Scheduler Changes Needed
- `runAdmission` must try multiple providers
- `SubmitFn` becomes `ProviderAdapter.submitJob`
- GPU budgeting must aggregate across providers
- Need provider selection strategy (configurable)

### Key Open Questions
1. Does Prime Intellect support SFT and DPO, or only RFT-style training?
   - Their docs focus on RFT/reinforcement learning with TOML configs
   - SFT/DPO may need custom implementation inside a pod
2. How do we upload datasets to Prime Intellect?
   - Fireworks: dataset referenced by name (pre-uploaded)
   - Prime Intellect: likely need to upload to pod or use their dataset hub
3. How do we map Fireworks `dataset` field to Prime Intellect?
   - Prime Intellect uses environment IDs (`primeintellect/alphabet-sort`) which are task definitions, not raw datasets
   - This is a significant impedance mismatch

---

## 6. Recommendation

### Phase 1: Fireworks-First with Prime Intellect Fallback
- Keep Fireworks as primary provider (full SFT/DPO/RFT support)
- Add Prime Intellect adapter for RFT-style jobs when Fireworks quota exhausted
- Prime Intellect adapter provisions a pod and submits a TOML config

### Phase 2: Full Provider Agnosticism
- Add SFT/DPO support on Prime Intellect (may require custom training scripts)
- Add dataset upload/management layer
- Add model ID resolution service

### Immediate Implementation Plan
1. Create `ProviderAdapter` interface
2. Implement `FireworksAdapter` (extract current code)
3. Implement `PrimeIntellectAdapter` (pod provisioning + hosted training)
4. Add provider selection to scheduler (`runAdmission`)
5. Update DB schema with provider columns
6. Update API to accept provider-agnostic payloads
7. Add model resolution mapping
8. Update tests

---

*Research completed 2026-05-12*
*Sources: docs.fireworks.ai, docs.primeintellect.ai, existing codebase in /supabase/functions/*
