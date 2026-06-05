// deployment-guard Edge Function.
// Invoked by pg_cron every 30 min with header X-Scheduler-Secret.
//
// Lists all Fireworks deployments for account "trilogy", finds any in READY
// state with minReplicaCount > 0, and resets them to minReplicaCount=0 so an
// idle deployment can't keep a GPU replica warm (and billing) forever. Each
// successful reset is recorded in the deployment_replica_audit table.

import { dbClient } from "../_shared/db.ts";
import { error, json } from "../_shared/response.ts";

const FW_BASE = "https://api.fireworks.ai/v1/accounts/trilogy";

interface Deployment {
  name: string;
  state: string;
  minReplicaCount: number;
  maxReplicaCount: number;
  baseModel: string;
}

interface ListResponse {
  deployments?: Deployment[];
  nextPageToken?: string;
}

// The id is the last path segment of the fully-qualified deployment name,
// e.g. "accounts/trilogy/deployments/abc123" -> "abc123".
function deploymentId(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1];
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("SCHEDULER_SECRET");
  if (!secret || req.headers.get("x-scheduler-secret") !== secret) {
    return error(401, "unauthorized");
  }

  const apiKey = Deno.env.get("FIREWORKS_API_KEY");
  if (!apiKey) return error(500, "FIREWORKS_API_KEY missing");

  const db = dbClient();
  const authHeaders = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // --- List all deployments, paginating until nextPageToken is empty ------
  const deployments: Deployment[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${FW_BASE}/deployments`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: authHeaders });
    if (!res.ok) {
      const body = await res.text();
      return error(502, "fireworks list failed", {
        status: res.status,
        body,
      });
    }
    const page = (await res.json()) as ListResponse;
    for (const d of page.deployments ?? []) deployments.push(d);
    pageToken = page.nextPageToken && page.nextPageToken.length > 0
      ? page.nextPageToken
      : undefined;
  } while (pageToken);

  // --- Reset every READY deployment whose minReplicaCount > 0 -------------
  let reset = 0;
  let errors = 0;
  const details: Array<{ name: string; old_min: number; status: string }> = [];

  const candidates = deployments.filter(
    (d) => d.state === "READY" && d.minReplicaCount > 0,
  );

  for (const d of candidates) {
    try {
      const id = deploymentId(d.name);
      const res = await fetch(`${FW_BASE}/deployments/${id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          minReplicaCount: 0,
          maxReplicaCount: d.maxReplicaCount,
          baseModel: d.baseModel,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("patch failed for", d.name, res.status, body);
        errors++;
        details.push({ name: d.name, old_min: d.minReplicaCount, status: "error" });
        continue;
      }

      const { error: auditErr } = await db
        .from("deployment_replica_audit")
        .insert({
          deployment_name: d.name,
          old_min: d.minReplicaCount,
          new_min: 0,
          max_replica_count: d.maxReplicaCount,
          state: d.state,
        });
      if (auditErr) {
        // The reset itself succeeded; only the audit insert failed. Log and
        // continue so we don't double-count it as a failed reset.
        console.error("audit insert failed for", d.name, auditErr);
      }

      reset++;
      details.push({ name: d.name, old_min: d.minReplicaCount, status: "reset" });
    } catch (e) {
      console.error("reset failed for", d.name, e);
      errors++;
      details.push({ name: d.name, old_min: d.minReplicaCount, status: "error" });
    }
  }

  return json({
    checked: deployments.length,
    reset,
    errors,
    details,
  });
});
