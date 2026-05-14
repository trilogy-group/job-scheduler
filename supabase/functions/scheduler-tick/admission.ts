// Pure admission logic, separated so Node tests can cover the scheduler's
// decisions without a Postgres instance or a live Fireworks.
//
// See openspec/changes/add-finetune-scheduler/specs/fair-scheduler/spec.md
// for the invariants this function maintains.

import type { Kind } from "../_shared/fireworks.ts";

// Size thresholds and concurrency caps.
// "Big" = gpu_count >= BIG_JOB_GPU_THRESHOLD. Each user may have at most
// MAX_BIG_JOBS_PER_USER concurrent big jobs and MAX_SMALL_JOBS_PER_USER
// concurrent small jobs. There is no system-wide big-job cap — admission
// is naturally limited by quota budget + BIG_JOB_HEADROOM_RESERVE.
export const BIG_JOB_GPU_THRESHOLD = 8;
export const MAX_BIG_JOBS_PER_USER = 1;
export const MAX_SMALL_JOBS_PER_USER = 2;
// A big-job admission must leave at least this many GPUs of headroom so a
// small job can fit immediately after. Prevents big admissions from zeroing
// out the account-wide budget.
export const BIG_JOB_HEADROOM_RESERVE = 4;

export interface QueuedJob {
  id: string;
  user_id: string;
  kind: Kind;
  gpu_count: number;
  created_at: string; // ISO-8601; rows arrive already ordered
}

export type AdmitOutcome =
  | { status: "skip_user_small_cap" } // user already at MAX_SMALL_JOBS_PER_USER concurrent small
  | { status: "skip_user_big_cap" }   // user already at MAX_BIG_JOBS_PER_USER concurrent big
  | { status: "skip_big_headroom" }   // admit would leave < BIG_JOB_HEADROOM_RESERVE free GPUs
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

function bumpCount(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/**
 * Drive the admission loop over the FIFO-ordered queue snapshot.
 *
 * Caller responsibilities:
 *   - pass `queued` already ordered by created_at ASC
 *   - pass `smallActiveByUser` / `bigActiveByUser`: counts of each user's
 *     currently-PROGRESS jobs split by size bucket
 *   - pass `fwAvailable` derived from live Fireworks state
 *   - perform the DB state transitions after each step in `admit`/`submit_failed`
 */
export async function runAdmission(
  queued: QueuedJob[],
  smallActiveByUser: Map<string, number>,
  bigActiveByUser: Map<string, number>,
  fwAvailable: number,
  submit: SubmitFn,
): Promise<AdmissionStep[]> {
  const steps: AdmissionStep[] = [];
  let budget = fwAvailable;
  // Local copies so we can mutate as we admit within this tick.
  const smallByUser = new Map(smallActiveByUser);
  const bigByUser = new Map(bigActiveByUser);

  for (const job of queued) {
    const isBig = job.gpu_count >= BIG_JOB_GPU_THRESHOLD;

    if (isBig) {
      if ((bigByUser.get(job.user_id) ?? 0) >= MAX_BIG_JOBS_PER_USER) {
        steps.push({ job, outcome: { status: "skip_user_big_cap" } });
        continue;
      }
      // Headroom rule: don't admit a big job that would drain the account
      // below the reserve. Smaller queued jobs may still be considered.
      if (budget - job.gpu_count < BIG_JOB_HEADROOM_RESERVE) {
        steps.push({ job, outcome: { status: "skip_big_headroom" } });
        continue;
      }
    } else {
      if ((smallByUser.get(job.user_id) ?? 0) >= MAX_SMALL_JOBS_PER_USER) {
        steps.push({ job, outcome: { status: "skip_user_small_cap" } });
        continue;
      }
    }

    if (job.gpu_count > budget) {
      // Earliest eligible candidate doesn't fit. Per spec: we MUST NOT
      // reorder smaller later jobs ahead of this one, so stop.
      steps.push({ job, outcome: { status: "stop_insufficient_gpu" } });
      break;
    }

    const result = await submit(job);
    if (result.ok) {
      budget -= job.gpu_count;
      if (isBig) bumpCount(bigByUser, job.user_id);
      else bumpCount(smallByUser, job.user_id);
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
