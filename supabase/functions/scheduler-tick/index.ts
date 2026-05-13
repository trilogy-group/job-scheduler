// scheduler-tick Edge Function.
// Invoked by pg_cron every 30s with header X-Scheduler-Secret.

import { dbClient } from "../_shared/db.ts";
import { error, json } from "../_shared/response.ts";
import {
  extractGpuCount,
  isFireworksError,
} from "../_shared/fireworks-provider.ts";
import { FireworksProvider } from "../_shared/fireworks-provider.ts";
import { mapFireworksTerminal } from "../_shared/fireworks-provider.ts";
import {
  isPrimeIntellectError,
  mapPrimeIntellectTerminal,
  PrimeIntellectProvider,
} from "../_shared/primeintellect-provider.ts";
import type { Kind } from "../_shared/providers.ts";
import { runAdmission, QueuedJob } from "./admission.ts";
import type { AdmissionStep } from "./admission.ts";

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("SCHEDULER_SECRET");
  if (!secret || req.headers.get("x-scheduler-secret") !== secret) {
    return error(401, "unauthorized");
  }

  const db = dbClient();

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
      by_provider: {} as Record<string, { available: number; admitted: number }>,
      by_kind: { SFT: 0, DPO: 0, RFT: 0 } as Record<Kind, number>,
    };

    // --- Build provider clients -----------------------------------------
    const fireworksKey = Deno.env.get("FIREWORKS_API_KEY");
    const primeKey = Deno.env.get("PRIME_API_KEY");
    const providers: Record<string, FireworksProvider | PrimeIntellectProvider> = {};
    if (fireworksKey) {
      providers["fireworks"] = new FireworksProvider(fireworksKey);
    }
    if (primeKey) {
      providers["primeintellect"] = new PrimeIntellectProvider(primeKey);
    }

    // --- Reconcile PROGRESS jobs against providers ----------------------
    const { data: progressRows, error: progressErr } = await db
      .from("jobs")
      .select("id, kind, provider, provider_job_id")
      .eq("state", "PROGRESS")
      .not("provider_job_id", "is", null);
    if (progressErr) throw progressErr;

    for (const row of progressRows ?? []) {
      const provider = providers[row.provider];
      if (!provider) {
        console.warn("no provider client for", row.provider, "job", row.id);
        continue;
      }

      try {
        const job = await provider.getJobStatus(row.kind as Kind, row.provider_job_id);
        const terminal = mapProviderTerminal(row.provider, job.state);
        if (!terminal) continue; // still running

        await db
          .from("jobs")
          .update({
            state: terminal.state,
            completed_at: new Date().toISOString(),
            error: terminal.errorText(job),
          })
          .eq("id", row.id)
          .eq("state", "PROGRESS");
        summary.reconciled++;
      } catch (e) {
        // Fireworks returns 404 when the resource is gone — treat as CANCELLED.
        if (isFireworksError(e) && e.status === 404) {
          await db
            .from("jobs")
            .update({
              state: "CANCELLED",
              completed_at: new Date().toISOString(),
              error: "cancelled externally (provider returned 404)",
            })
            .eq("id", row.id)
            .eq("state", "PROGRESS");
          summary.reconciled++;
          continue;
        }
        console.warn("reconcile failed for", row.id, e);
      }
    }

    // --- Fetch queued + active jobs for admission -----------------------
    const [{ data: queuedRows, error: queuedErr }, { data: activeRows, error: activeErr }] =
      await Promise.all([
        db
          .from("jobs")
          .select("id, user_id, kind, provider, gpu_count, created_at")
          .eq("state", "QUEUED")
          .order("created_at", { ascending: true }),
        db.from("jobs").select("user_id, provider, gpu_count").eq("state", "PROGRESS"),
      ]);
    if (queuedErr) throw queuedErr;
    if (activeErr) throw activeErr;

    summary.queued_remaining = queuedRows?.length ?? 0;

    // Group queued jobs by provider
    const queuedByProvider: Record<string, QueuedJob[]> = {};
    for (const row of queuedRows ?? []) {
      const p = row.provider ?? "fireworks";
      if (!queuedByProvider[p]) queuedByProvider[p] = [];
      queuedByProvider[p].push(row as QueuedJob);
    }

    // Track active users and DB-ground-truth used GPUs per provider.
    // We trust our own PROGRESS rows rather than provider.listActiveJobs()
    // because external/orphaned jobs would overcount and starve the queue.
    const activeUsersByProvider: Record<string, Set<string>> = {};
    const dbUsedGpusByProvider: Record<string, number> = {};
    for (const row of activeRows ?? []) {
      const p = row.provider ?? "fireworks";
      if (!activeUsersByProvider[p]) activeUsersByProvider[p] = new Set();
      activeUsersByProvider[p].add(row.user_id);
      dbUsedGpusByProvider[p] = (dbUsedGpusByProvider[p] ?? 0) + (row.gpu_count ?? 4);
    }

    // --- Discover per-provider GPU headroom -----------------------------
    const providerCapacity: Record<string, number> = {};
    for (const [name, provider] of Object.entries(providers)) {
      try {
        const cap = await provider.getComputeCapacity();
        const totalGpus = cap.totalGpus;
        const dbUsedGpus = dbUsedGpusByProvider[name] ?? 0;
        const available = Math.max(0, totalGpus - dbUsedGpus);
        providerCapacity[name] = available;
        summary.by_provider[name] = { available, admitted: 0 };
        if (cap.usedGpus !== dbUsedGpus) {
          console.warn(
            `capacity drift for ${name}: provider reports used=${cap.usedGpus}, db PROGRESS=${dbUsedGpus}`,
          );
        }
      } catch (e) {
        console.warn("getComputeCapacity failed for", name, e);
        providerCapacity[name] = 0;
        summary.by_provider[name] = { available: 0, admitted: 0 };
      }
    }

    // Run admission for each provider independently
    for (const [providerName, provider] of Object.entries(providers)) {
      const queued = queuedByProvider[providerName] ?? [];
      const activeUsers = activeUsersByProvider[providerName] ?? new Set();
      const available = providerCapacity[providerName] ?? 0;

      if (queued.length === 0 || available <= 0) continue;

      const steps = await runAdmission(
        queued,
        activeUsers,
        available,
        async (job) => {
          try {
            const payload = await fetchPayload(db, job.id);
            const providerJob = await provider.submitJob(job.kind, payload);
            return {
              ok: true as const,
              provider_job_id: providerJob.provider_job_id,
            };
          } catch (e) {
            if (isFireworksError(e) && e.isQuotaError) {
              return { ok: false as const, kind: "quota" as const };
            }
            if (isFireworksError(e) || isPrimeIntellectError(e)) {
              const status = isFireworksError(e) ? e.status : e.status;
              const body = isFireworksError(e) ? e.body : e.body;
              return {
                ok: false as const,
                kind: "client_error" as const,
                status,
                body,
              };
            }
            return {
              ok: false as const,
              kind: "client_error" as const,
              status: 500,
              body: e instanceof Error ? e.message : String(e),
            };
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
              provider_job_id: step.outcome.provider_job_id,
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
            summary.by_provider[providerName].admitted++;
          }
        } else if (step.outcome.status === "submit_failed") {
          await db
            .from("jobs")
            .update({
              state: "FAIL",
              completed_at: new Date().toISOString(),
              error: `${providerName} ${step.outcome.status_code}: ${step.outcome.body}`,
            })
            .eq("id", step.job.id)
            .eq("state", "QUEUED");
          summary.submission_failed++;
        }
        // skip_user_active / stop_insufficient_gpu / submit_quota_error: no-op
      }
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
): Promise<unknown> {
  const { data, error: e } = await db
    .from("jobs")
    .select("provider_payload, fireworks_payload")
    .eq("id", jobId)
    .single();
  if (e) throw e;
  // Use provider_payload if present, fall back to fireworks_payload for legacy
  return data.provider_payload ?? data.fireworks_payload;
}

function mapProviderTerminal(
  provider: string,
  state: string,
): { state: "SUCCESS" | "FAIL" | "CANCELLED"; errorText: (job: { error?: unknown; message?: unknown }) => string | null } | null {
  if (provider === "fireworks") {
    const mapping = mapFireworksTerminal(state);
    if (mapping.state === "SUCCESS") {
      return { state: "SUCCESS", errorText: () => null };
    }
    if (mapping.state === "CANCELLED") {
      return { state: "CANCELLED", errorText: () => null };
    }
    return {
      state: "FAIL",
      errorText: (job) =>
        (typeof job.error === "string" && job.error) ||
        (typeof job.message === "string" && job.message) ||
        null,
    };
  }
  if (provider === "primeintellect") {
    const mapping = mapPrimeIntellectTerminal(state);
    if (!mapping) return null;
    if (mapping.state === "SUCCESS") {
      return { state: "SUCCESS", errorText: () => null };
    }
    if (mapping.state === "CANCELLED") {
      return { state: "CANCELLED", errorText: () => null };
    }
    return {
      state: "FAIL",
      errorText: (job) =>
        (typeof job.error === "string" && job.error) ||
        (typeof job.message === "string" && job.message) ||
        null,
    };
  }
  // Unknown provider — assume non-terminal to avoid premature termination
  return null;
}
