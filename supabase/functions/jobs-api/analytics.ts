// Analytics handlers for the jobs-api. Pure handlers (no Deno-specific APIs)
// so Node tests can import them directly. The `db` parameter is a Supabase
// PostgrestClient-like builder; tests inject a thenable mock.

import { json, error } from "../_shared/response.ts";
import { TERMINAL_STATES } from "./validate.ts";

interface QueuedRow {
  id: string;
  display_name: string | null;
  kind: string;
  gpu_count: number;
  created_at: string;
}

interface ProgressRow {
  id: string;
  display_name: string | null;
  kind: string;
  gpu_count: number;
  started_at: string | null;
  fireworks_job_name: string | null;
}

interface SummaryRow {
  id: string;
  kind: string;
  state: string;
  display_name: string | null;
  gpu_count: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

/** Whole-second diff between two ISO timestamps, or null if either is missing. */
function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

export async function handleAnalyticsQueue(db, userId: string): Promise<Response> {
  // 1. Caller's PROGRESS job (at most one by DB invariant).
  const { data: progressRow, error: progErr } = await db
    .from("jobs")
    .select("id, display_name, kind, gpu_count, started_at, fireworks_job_name")
    .eq("user_id", userId)
    .eq("state", "PROGRESS")
    .maybeSingle();
  if (progErr) return error(500, "analytics fetch failed", { detail: progErr.message });
  const your_progress_job = (progressRow as ProgressRow | null) ?? null;

  // 2. Caller's QUEUED jobs, FIFO order.
  const { data: queuedRows, error: queuedErr } = await db
    .from("jobs")
    .select("id, display_name, kind, gpu_count, created_at")
    .eq("user_id", userId)
    .eq("state", "QUEUED")
    .order("created_at", { ascending: true });
  if (queuedErr) return error(500, "analytics fetch failed", { detail: queuedErr.message });
  const yourQueued = (queuedRows as QueuedRow[] | null) ?? [];

  // 3. For each queued job, count QUEUED jobs not owned by user with an
  //    earlier created_at — an approximation of FIFO position.
  const your_queued_jobs = await Promise.all(
    yourQueued.map(async (j) => {
      const { count, error: cErr } = await db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("state", "QUEUED")
        .neq("user_id", userId)
        .lt("created_at", j.created_at);
      if (cErr) throw new Error(`queue position count failed: ${cErr.message}`);
      return {
        id: j.id,
        display_name: j.display_name,
        kind: j.kind,
        gpu_count: j.gpu_count,
        created_at: j.created_at,
        queue_position: count ?? 0,
      };
    }),
  );

  // 4. Global queue depth (all QUEUED).
  const { count: globalQueueDepth, error: gqErr } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("state", "QUEUED");
  if (gqErr) return error(500, "analytics fetch failed", { detail: gqErr.message });

  // 5. Global PROGRESS jobs — count + GPU sum (sum in JS).
  const { data: progressAll, error: gpErr } = await db
    .from("jobs")
    .select("gpu_count")
    .eq("state", "PROGRESS");
  if (gpErr) return error(500, "analytics fetch failed", { detail: gpErr.message });
  const progressList = (progressAll as { gpu_count: number }[] | null) ?? [];
  const global_progress_count = progressList.length;
  const global_gpu_in_use = progressList.reduce((s, r) => s + (r.gpu_count ?? 0), 0);

  return json({
    your_progress_job,
    your_queued_jobs,
    global_queue_depth: globalQueueDepth ?? 0,
    global_progress_count,
    global_gpu_in_use,
  });
}

export async function handleAnalyticsSummary(db, userId: string): Promise<Response> {
  // Pull every job for the user. Reasonable: a single user's lifetime job
  // count is bounded and this lets us compute all aggregates in JS without
  // multiple round-trips.
  const { data, error: dbErr } = await db
    .from("jobs")
    .select("id, kind, state, display_name, gpu_count, started_at, completed_at, error")
    .eq("user_id", userId);
  if (dbErr) return error(500, "analytics fetch failed", { detail: dbErr.message });
  const rows = (data as SummaryRow[] | null) ?? [];

  const by_state: Record<string, number> = {
    QUEUED: 0,
    PROGRESS: 0,
    SUCCESS: 0,
    FAIL: 0,
    CANCELLED: 0,
  };
  const by_kind: Record<string, number> = { SFT: 0, DPO: 0, RFT: 0 };

  let terminalCount = 0;
  let successCount = 0;
  let successDurationSum = 0;
  let successDurationN = 0;
  let totalGpuHours = 0;

  for (const r of rows) {
    if (r.state in by_state) by_state[r.state]++;
    if (r.kind in by_kind) by_kind[r.kind]++;
    if (TERMINAL_STATES.has(r.state)) terminalCount++;
    if (r.state === "SUCCESS") {
      successCount++;
      const d = durationSeconds(r.started_at, r.completed_at);
      if (d !== null) {
        successDurationSum += d;
        successDurationN++;
        totalGpuHours += (r.gpu_count * d) / 3600;
      }
    }
  }

  const success_rate = terminalCount > 0 ? successCount / terminalCount : null;
  const avg_run_duration_seconds =
    successDurationN > 0 ? Math.round(successDurationSum / successDurationN) : null;

  // Most recent 10 FAIL jobs (completed_at DESC, falling back to nothing if
  // completed_at is somehow null — FAIL jobs should always have it set).
  const { data: failData, error: failErr } = await db
    .from("jobs")
    .select("id, display_name, kind, gpu_count, error, completed_at")
    .eq("user_id", userId)
    .eq("state", "FAIL")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(10);
  if (failErr) return error(500, "analytics fetch failed", { detail: failErr.message });
  const recent_failures = ((failData as {
    id: string;
    display_name: string | null;
    kind: string;
    gpu_count: number;
    error: string | null;
    completed_at: string | null;
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    display_name: r.display_name,
    kind: r.kind,
    gpu_count: r.gpu_count,
    error: r.error,
    failed_at: r.completed_at,
  }));

  return json({
    total: rows.length,
    by_state,
    by_kind,
    success_rate,
    avg_run_duration_seconds,
    total_gpu_hours: totalGpuHours,
    recent_failures,
  });
}

export async function handleJobAnalytics(id: string, db, userId: string): Promise<Response> {
  const { data, error: dbErr } = await db
    .from("jobs")
    .select(
      "id, user_id, kind, state, display_name, gpu_count, fireworks_job_name, created_at, started_at, completed_at, error",
    )
    .eq("id", id)
    .maybeSingle();
  if (dbErr) return error(500, "analytics fetch failed", { detail: dbErr.message });
  if (!data || data.user_id !== userId) return error(404, "not found");

  const job = data as {
    id: string;
    user_id: string;
    kind: string;
    state: string;
    display_name: string | null;
    gpu_count: number;
    fireworks_job_name: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
  };

  const queue_wait_seconds = durationSeconds(job.created_at, job.started_at);
  const run_duration_seconds = durationSeconds(job.started_at, job.completed_at);
  const gpu_hours =
    run_duration_seconds !== null ? (job.gpu_count * run_duration_seconds) / 3600 : null;

  return json({
    id: job.id,
    display_name: job.display_name,
    kind: job.kind,
    state: job.state,
    gpu_count: job.gpu_count,
    fireworks_job_name: job.fireworks_job_name,
    timeline: {
      queued_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    },
    queue_wait_seconds,
    run_duration_seconds,
    gpu_hours,
    error: job.error,
  });
}
