// Pure admission logic, separated so Node tests can cover the scheduler's
// decisions without a Postgres instance or a live Fireworks.
//
// See openspec/changes/add-finetune-scheduler/specs/fair-scheduler/spec.md
// for the invariants this function maintains.

import type { Kind } from "../_shared/fireworks.ts";

// Concurrency cap on "big" jobs: jobs using BIG_JOB_GPU_THRESHOLD or more GPUs
// are limited to MAX_BIG_JOBS_ACTIVE concurrent runs across the whole account.
// Rationale: prevents large jobs from monopolising the quota and starving the
// pool of small-job slots. Cap is enforced as a per-class skip (not a global
// stop), so smaller jobs queued behind a capped big-job can still admit —
// same shape as `skip_user_active`.
export const BIG_JOB_GPU_THRESHOLD = 8;
export const MAX_BIG_JOBS_ACTIVE = 2;

export interface QueuedJob {
  id: string;
  user_id: string;
  kind: Kind;
  gpu_count: number;
  created_at: string; // ISO-8601; rows arrive already ordered
}

export type AdmitOutcome =
  | { status: "skip_user_active" }
  | { status: "skip_big_cap" } // queued big-job blocked by MAX_BIG_JOBS_ACTIVE; smaller queued jobs may still admit
  | { status: "stop_insufficient_gpu" } // earliest eligible candidate didn't fit → stop this tick
  | { status: "admit"; fireworks_job_name: string }
  | { status: "submit_quota_error" }
  | { status: "submit_failed"; status_code: number; body: string };

export interface AdmissionStep {
  job: QueuedJob;
  outcome: AdmitOutcome;
}

export interface SubmitFn {
  (job: QueuedJob): Promise<
    | { ok: true; fireworks_job_name: string }
    | { ok: false; kind: "quota" }
    | { ok: false; kind: "client_error"; status: number; body: string }
  >;
}

/**
 * Drive the admission loop over the FIFO-ordered queue snapshot.
 *
 * Caller responsibilities:
 *   - pass `queued` already ordered by created_at ASC
 *   - pass `activeUsers` containing user_ids currently in PROGRESS
 *   - pass `bigJobsActive` = count of PROGRESS jobs with gpu_count >= BIG_JOB_GPU_THRESHOLD
 *   - pass `fwAvailable` derived from live Fireworks state
 *   - perform the DB state transitions after each step in `admit`/`submit_failed`
 */
export async function runAdmission(
  queued: QueuedJob[],
  activeUsers: Set<string>,
  bigJobsActive: number,
  fwAvailable: number,
  submit: SubmitFn,
): Promise<AdmissionStep[]> {
  const steps: AdmissionStep[] = [];
  let budget = fwAvailable;
  const active = new Set(activeUsers);
  let bigActive = bigJobsActive;

  for (const job of queued) {
    if (active.has(job.user_id)) {
      steps.push({ job, outcome: { status: "skip_user_active" } });
      continue;
    }
    if (
      job.gpu_count >= BIG_JOB_GPU_THRESHOLD &&
      bigActive >= MAX_BIG_JOBS_ACTIVE
    ) {
      // Big-job cap is per-class, not a global resource shortage — skip this
      // candidate so smaller queued jobs behind it can still be considered.
      steps.push({ job, outcome: { status: "skip_big_cap" } });
      continue;
    }
    if (job.gpu_count > budget) {
      // Earliest eligible (user-free) candidate doesn't fit. Per spec:
      // we MUST NOT reorder smaller later jobs ahead of this one, so stop.
      steps.push({ job, outcome: { status: "stop_insufficient_gpu" } });
      break;
    }

    const result = await submit(job);
    if (result.ok) {
      active.add(job.user_id);
      budget -= job.gpu_count;
      if (job.gpu_count >= BIG_JOB_GPU_THRESHOLD) bigActive++;
      steps.push({
        job,
        outcome: {
          status: "admit",
          fireworks_job_name: result.fireworks_job_name,
        },
      });
      continue;
    }
    if (result.kind === "quota") {
      steps.push({ job, outcome: { status: "submit_quota_error" } });
      break;
    }
    // Non-quota 4xx: mark FAIL and keep going.
    steps.push({
      job,
      outcome: {
        status: "submit_failed",
        status_code: result.status,
        body: result.body,
      },
    });
  }

  return steps;
}
