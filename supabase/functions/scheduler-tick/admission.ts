// Pure admission logic, separated so Node tests can cover the scheduler's
// decisions without a Postgres instance or a live provider.
//
// See openspec/changes/add-finetune-scheduler/specs/fair-scheduler/spec.md
// for the invariants this function maintains.

import type { Kind } from "../_shared/providers.ts";

export interface QueuedJob {
  id: string;
  user_id: string;
  kind: Kind;
  provider: string;
  gpu_count: number;
  created_at: string; // ISO-8601; rows arrive already ordered
}

export type AdmitOutcome =
  | { status: "skip_user_active" }
  | { status: "stop_insufficient_gpu" } // earliest eligible candidate didn't fit → stop this tick
  | { status: "admit"; provider_job_id: string }
  | { status: "submit_quota_error" }
  | { status: "submit_failed"; status_code: number; body: string };

export interface AdmissionStep {
  job: QueuedJob;
  outcome: AdmitOutcome;
}

export interface SubmitFn {
  (job: QueuedJob): Promise<
    | { ok: true; provider_job_id: string }
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
 *   - pass `available` derived from live provider state
 *   - perform the DB state transitions after each step in `admit`/`submit_failed`
 */
export async function runAdmission(
  queued: QueuedJob[],
  activeUsers: Set<string>,
  available: number,
  submit: SubmitFn,
): Promise<AdmissionStep[]> {
  const steps: AdmissionStep[] = [];
  let budget = available;
  const active = new Set(activeUsers);

  for (const job of queued) {
    if (active.has(job.user_id)) {
      steps.push({ job, outcome: { status: "skip_user_active" } });
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
      steps.push({
        job,
        outcome: {
          status: "admit",
          provider_job_id: result.provider_job_id,
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
