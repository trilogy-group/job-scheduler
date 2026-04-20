// jobs-api Edge Function.
//
// Endpoints (all require Authorization: Bearer sftq_<token>):
//   POST   /jobs           enqueue a fine-tuning job (kind SFT or DPO)
//   GET    /jobs           list caller's jobs, newest first
//   GET    /jobs/:id       fetch a single job (404 if not owned)
//   DELETE /jobs/:id       cancel (QUEUED -> CANCELLED; PROGRESS -> Fireworks cancel)

import { dbClient } from "../_shared/db.ts";
import { authenticate } from "../_shared/auth.ts";
import { json, error } from "../_shared/response.ts";
import { FireworksClient, isFireworksError } from "../_shared/fireworks.ts";
import type { Kind } from "../_shared/fireworks.ts";
import { validateEnqueue, TERMINAL_STATES } from "./validate.ts";

Deno.serve(async (req: Request) => {
  const db = dbClient();
  const auth = await authenticate(db, req);
  if (!auth) return error(401, "unauthorized");

  const url = new URL(req.url);
  // Edge Function paths look like `/jobs-api/jobs[...]`; strip the function
  // prefix if present so routing is the same in local dev and prod.
  const path = url.pathname.replace(/^\/jobs-api/, "");
  const parts = path.split("/").filter(Boolean); // ["jobs"] or ["jobs","<id>"]
  if (parts[0] !== "jobs") return error(404, "not found");

  const id = parts[1];

  try {
    if (req.method === "POST" && !id) {
      return await handleCreate(req, db, auth.userId);
    }
    if (req.method === "GET" && !id) {
      return await handleList(url, db, auth.userId);
    }
    if (req.method === "GET" && id) {
      return await handleGetOne(id, db, auth.userId);
    }
    if (req.method === "DELETE" && id) {
      return await handleCancel(id, db, auth.userId);
    }
    return error(405, "method not allowed");
  } catch (e) {
    console.error("jobs-api error:", e);
    return error(500, "internal error");
  }
});

async function handleCreate(req: Request, db, userId: string): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error(400, "invalid JSON body");
  }
  const v = validateEnqueue(raw);
  if (!v.ok) return error(400, v.err.message);

  const { data, error: dbErr } = await db
    .from("jobs")
    .insert({
      user_id: userId,
      kind: v.value.kind,
      state: "QUEUED",
      display_name: v.value.display_name,
      gpu_count: v.value.gpu_count,
      fireworks_payload: v.value.fireworks_payload,
    })
    .select("id, kind, state, created_at")
    .single();

  if (dbErr) return error(500, "insert failed", { detail: dbErr.message });
  return json(data, 201);
}

async function handleList(url: URL, db, userId: string): Promise<Response> {
  let q = db
    .from("jobs")
    .select(
      "id, kind, state, display_name, gpu_count, created_at, started_at, completed_at, error, fireworks_job_name",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const state = url.searchParams.get("state");
  if (state) q = q.eq("state", state);
  const kind = url.searchParams.get("kind");
  if (kind) q = q.eq("kind", kind);

  const { data, error: dbErr } = await q;
  if (dbErr) return error(500, "list failed", { detail: dbErr.message });
  return json(data ?? []);
}

async function handleGetOne(id: string, db, userId: string): Promise<Response> {
  const { data, error: dbErr } = await db
    .from("jobs")
    .select(
      "id, kind, state, display_name, gpu_count, created_at, started_at, completed_at, error, fireworks_job_name, user_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (dbErr) return error(500, "fetch failed", { detail: dbErr.message });
  if (!data || data.user_id !== userId) return error(404, "not found");
  // strip user_id from the response
  const { user_id: _u, ...safe } = data;
  return json(safe);
}

async function handleCancel(id: string, db, userId: string): Promise<Response> {
  const { data: job, error: fetchErr } = await db
    .from("jobs")
    .select("id, kind, state, user_id, fireworks_job_name")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return error(500, "fetch failed", { detail: fetchErr.message });
  if (!job || job.user_id !== userId) return error(404, "not found");
  if (TERMINAL_STATES.has(job.state)) return error(409, `job already ${job.state.toLowerCase()}`);

  if (job.state === "QUEUED") {
    const { error: updErr } = await db
      .from("jobs")
      .update({ state: "CANCELLED", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("state", "QUEUED"); // guard against race with scheduler admission
    if (updErr) return error(500, "cancel failed", { detail: updErr.message });
    return json({ id, state: "CANCELLED" });
  }

  // job.state === 'PROGRESS'
  if (!job.fireworks_job_name) {
    return error(409, "in-progress job has no Fireworks handle yet; retry shortly");
  }
  const apiKey = Deno.env.get("FIREWORKS_API_KEY");
  if (!apiKey) return error(500, "FIREWORKS_API_KEY missing");
  const fw = new FireworksClient(apiKey);
  try {
    await fw.cancelJob(job.kind as Kind, job.fireworks_job_name);
  } catch (e) {
    if (isFireworksError(e)) {
      return error(502, "Fireworks cancel failed", { status: e.status, detail: e.body });
    }
    throw e;
  }
  const { error: updErr } = await db
    .from("jobs")
    .update({ state: "CANCELLED", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("state", "PROGRESS");
  if (updErr) return error(500, "cancel commit failed", { detail: updErr.message });
  return json({ id, state: "CANCELLED" });
}
