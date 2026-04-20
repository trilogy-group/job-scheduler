// scheduler-tick Edge Function.
// Invoked by pg_cron every 30s with header X-Scheduler-Secret.

import { dbClient } from "../_shared/db.ts";
import { error, json } from "../_shared/response.ts";
import {
  FireworksClient,
  isFireworksError,
  isTerminal,
} from "../_shared/fireworks.ts";
import type { Kind } from "../_shared/fireworks.ts";
import { runAdmission, QueuedJob } from "./admission.ts";

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("SCHEDULER_SECRET");
  if (!secret || req.headers.get("x-scheduler-secret") !== secret) {
    return error(401, "unauthorized");
  }

  const apiKey = Deno.env.get("FIREWORKS_API_KEY");
  if (!apiKey) return error(500, "FIREWORKS_API_KEY missing");

  const db = dbClient();
  const fw = new FireworksClient(apiKey);

  // Try to acquire the tick-wide advisory lock. If another tick holds it,
  // bail out cleanly — whatever work we'd do will be done by the holder.
  const { data: lockOk, error: lockErr } = await db.rpc("scheduler_try_lock");
  if (lockErr) return error(500, "lock RPC failed", { detail: lockErr.message });
  if (!lockOk) return json({ skipped: true });

  try {
    const summary = {
      reconciled: 0,
      admitted: 0,
      submission_failed: 0,
      queued_remaining: 0,
      fw_available: 0,
      fw_quota_name: "" as string,
      by_kind: { SFT: 0, DPO: 0 } as Record<Kind, number>,
    };

    // --- Reconcile PROGRESS jobs against Fireworks ----------------------
    const { data: progressRows, error: progressErr } = await db
      .from("jobs")
      .select("id, kind, fireworks_job_name")
      .eq("state", "PROGRESS")
      .not("fireworks_job_name", "is", null);
    if (progressErr) throw progressErr;

    for (const row of progressRows ?? []) {
      try {
        const fwJob = await fw.getJob(row.kind as Kind, row.fireworks_job_name);
        if (!isTerminal(fwJob.state)) continue;
        const terminal = mapFireworksTerminal(fwJob.state);
        await db
          .from("jobs")
          .update({
            state: terminal.state,
            completed_at: new Date().toISOString(),
            error: terminal.errorText(fwJob),
          })
          .eq("id", row.id)
          .eq("state", "PROGRESS");
        summary.reconciled++;
      } catch (e) {
        // Fireworks returns 404 when the resource is gone — which happens
        // when someone cancels externally via firectl/UI, since Fireworks
        // DELETE removes the job entirely. Treat as CANCELLED so the row
        // doesn't get stuck at PROGRESS forever (which would also block
        // the user via the partial unique index).
        if (isFireworksError(e) && e.status === 404) {
          await db
            .from("jobs")
            .update({
              state: "CANCELLED",
              completed_at: new Date().toISOString(),
              error: "cancelled externally (Fireworks returned 404)",
            })
            .eq("id", row.id)
            .eq("state", "PROGRESS");
          summary.reconciled++;
          continue;
        }
        // Network / 5xx / unknown-shape — leave the job alone, try next tick.
        console.warn("reconcile failed for", row.id, e);
      }
    }

    // --- Discover live GPU headroom via /quotas -------------------------
    let fwAvailable = 0;
    try {
      const q = await fw.getTrainingGpuQuota();
      fwAvailable = Math.max(0, q.maxValue - q.usage);
      summary.fw_quota_name = q.name;
    } catch (e) {
      console.warn("getTrainingGpuQuota failed; skipping admission", e);
      return json({ ...summary, skipped_admission: true });
    }
    summary.fw_available = fwAvailable;

    // --- Admit queued jobs ----------------------------------------------
    const [{ data: queuedRows, error: queuedErr }, { data: activeRows, error: activeErr }] =
      await Promise.all([
        db
          .from("jobs")
          .select("id, user_id, kind, gpu_count, created_at")
          .eq("state", "QUEUED")
          .order("created_at", { ascending: true }),
        db.from("jobs").select("user_id").eq("state", "PROGRESS"),
      ]);
    if (queuedErr) throw queuedErr;
    if (activeErr) throw activeErr;

    summary.queued_remaining = queuedRows?.length ?? 0;
    const activeUsers = new Set((activeRows ?? []).map((r) => r.user_id));
    const queued = (queuedRows ?? []) as QueuedJob[];

    const steps = await runAdmission(
      queued,
      activeUsers,
      fwAvailable,
      async (job) => {
        try {
          const { fireworks_payload: payload } = await fetchPayload(db, job.id);
          const fwJob = await fw.createJob(job.kind, payload);
          const name = fwJob.name ?? "";
          return { ok: true as const, fireworks_job_name: name };
        } catch (e) {
          if (isFireworksError(e) && e.isQuotaError) {
            return { ok: false as const, kind: "quota" as const };
          }
          if (isFireworksError(e)) {
            return {
              ok: false as const,
              kind: "client_error" as const,
              status: e.status,
              body: e.body,
            };
          }
          throw e;
        }
      },
    );

    // Persist the outcomes of each step.
    for (const step of steps) {
      if (step.outcome.status === "admit") {
        const { data, error: updErr } = await db
          .from("jobs")
          .update({
            state: "PROGRESS",
            started_at: new Date().toISOString(),
            fireworks_job_name: step.outcome.fireworks_job_name,
          })
          .eq("id", step.job.id)
          .eq("state", "QUEUED")
          .select("id")
          .maybeSingle();
        if (updErr) {
          console.error("admit update failed", step.job.id, updErr);
          continue;
        }
        if (data) {
          summary.admitted++;
          summary.by_kind[step.job.kind]++;
        }
      } else if (step.outcome.status === "submit_failed") {
        await db
          .from("jobs")
          .update({
            state: "FAIL",
            completed_at: new Date().toISOString(),
            error:
              `Fireworks ${step.outcome.status_code}: ${step.outcome.body}`,
          })
          .eq("id", step.job.id)
          .eq("state", "QUEUED");
        summary.submission_failed++;
      }
      // skip_user_active / stop_insufficient_gpu / submit_quota_error: no-op
    }

    return json(summary);
  } finally {
    const { error: unlockErr } = await db.rpc("scheduler_unlock");
    if (unlockErr) console.error("scheduler_unlock failed", unlockErr);
  }
});

async function fetchPayload(
  db: ReturnType<typeof dbClient>,
  jobId: string,
): Promise<{ fireworks_payload: unknown }> {
  const { data, error: e } = await db
    .from("jobs")
    .select("fireworks_payload")
    .eq("id", jobId)
    .single();
  if (e) throw e;
  return data;
}

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
    errorText: (job) =>
      (typeof job.error === "string" && job.error) ||
      (typeof job.message === "string" && job.message) ||
      null,
  };
}
