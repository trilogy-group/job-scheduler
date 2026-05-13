// Fireworks provider adapter implementing ProviderClient.
//
// Refactored from the original FireworksClient to conform to the unified
// ProviderClient interface while preserving all existing behaviour.

import {
  type Kind,
  type ProviderClient,
  type ProviderJob,
  type ProviderComputeCapacity,
  type TerminalMapping,
  extractGpuCount,
} from "./providers.ts";

export const FIREWORKS_BASE =
  "https://api.fireworks.ai/v1/accounts/trilogy";

const ENDPOINT: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};

// Each endpoint's list-response wraps jobs under a kind-specific array key.
const LIST_KEY: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};

// Fireworks uses protobuf-style state enums prefixed with JOB_STATE_.
export const FW_TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
]);

export interface FireworksError {
  status: number;
  body: string;
  isQuotaError: boolean;
}

export class FireworksProvider implements ProviderClient {
  readonly name = "fireworks";
  readonly apiKey: string;
  readonly fetchImpl: typeof fetch;
  readonly base: string;

  constructor(
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
    base: string = FIREWORKS_BASE,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.base = base;
  }

  private url(kind: Kind, ...parts: string[]): string {
    const tail = parts.length ? "/" + parts.join("/") : "";
    return `${this.base}/${ENDPOINT[kind]}${tail}`;
  }

  private async request(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  /** Submit a job. Throws a FireworksError on non-2xx. */
  async submitJob(kind: Kind, payload: unknown): Promise<ProviderJob> {
    const res = await this.request(this.url(kind), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await toError(res);
    const fwJob = await res.json() as Record<string, unknown>;
    return fireworksToProviderJob(fwJob);
  }

  async getJobStatus(kind: Kind, provider_job_id: string): Promise<ProviderJob> {
    const res = await this.request(
      this.url(kind, shortName(provider_job_id)),
    );
    if (!res.ok) throw await toError(res);
    const fwJob = await res.json() as Record<string, unknown>;
    return fireworksToProviderJob(fwJob);
  }

  /** Returns every non-terminal job on the given endpoint. */
  async listActiveJobs(kind?: Kind): Promise<ProviderJob[]> {
    const kinds = kind ? [kind] : (["SFT", "DPO", "RFT"] as Kind[]);
    const all: ProviderJob[] = [];
    for (const k of kinds) {
      const res = await this.request(this.url(k));
      if (!res.ok) throw await toError(res);
      const body = await res.json() as Record<string, unknown>;
      const arr = (body[LIST_KEY[k]] ?? body.jobs ?? []) as Array<
        Record<string, unknown>
      >;
      for (const fwJob of arr) {
        const pj = fireworksToProviderJob(fwJob);
        if (!isFwTerminal(pj.state)) all.push(pj);
      }
    }
    return all;
  }

  /**
   * Cancel a job.
   *
   * - SFT / DPO: no `:cancel` endpoint exists. We use DELETE.
   * - RFT:       has a documented POST :cancel.
   */
  async cancelJob(kind: Kind, provider_job_id: string): Promise<void> {
    const init: RequestInit = kind === "RFT"
      ? { method: "POST" }
      : { method: "DELETE" };
    const path = kind === "RFT"
      ? this.url(kind, `${shortName(provider_job_id)}:cancel`)
      : this.url(kind, shortName(provider_job_id));
    const res = await this.request(path, init);
    if (!res.ok) throw await toError(res);
  }

  /**
   * Fetch live GPU quota ceiling.
   *
   * Returns {totalGpus, usedGpus: 0}.  The scheduler tick computes actual
   * used GPUs from its own DB PROGRESS rows to avoid over-counting external
   * or orphaned jobs.  Calling listActiveJobs() here was causing Edge
   * Function timeouts because it fans out to 3 Fireworks endpoints.
   */
  async getComputeCapacity(_kind?: Kind): Promise<ProviderComputeCapacity> {
    const res = await this.request(`${this.base}/quotas`);
    if (!res.ok) throw await toError(res);
    const body = await res.json() as {
      quotas?: Array<
        { name?: string; value?: string; maxValue?: string; usage?: number }
      >;
    };
    const list = body.quotas ?? [];
    const namePattern = /training.*h200|h200.*training/i;
    const match = list.find((q) => q.name && namePattern.test(q.name));
    if (!match || !match.name) {
      throw new Error(
        `no quota matching ${namePattern} in ${
          list.map((q) => q.name).join(",") || "(empty)"
        }`,
      );
    }
    const totalGpus = parseInt(match.maxValue ?? match.value ?? "0", 10);
    return { totalGpus, usedGpus: 0 };
  }
}

/** Map Fireworks terminal state to scheduler terminal state. */
export function mapFireworksTerminal(state: string): TerminalMapping {
  if (state === "JOB_STATE_COMPLETED") {
    return { state: "SUCCESS", errorText: () => null };
  }
  if (state === "JOB_STATE_CANCELLED") {
    return { state: "CANCELLED", errorText: () => null };
  }
  // JOB_STATE_FAILED, JOB_STATE_EXPIRED, JOB_STATE_EARLY_STOPPED
  return {
    state: "FAIL",
    errorText: (job: ProviderJob) =>
      (typeof job.error === "string" && job.error) ||
      (typeof job.message === "string" && job.message) ||
      null,
  };
}

/** Convert a Fireworks API job record to ProviderJob. */
function fireworksToProviderJob(fwJob: Record<string, unknown>): ProviderJob {
  const name = typeof fwJob.name === "string" ? fwJob.name : "";
  const state = typeof fwJob.state === "string" ? fwJob.state : "";
  const gpuCount = extractGpuCount(fwJob as ProviderJob, 4);
  return { provider_job_id: name, state, gpuCount, ...fwJob };
}

/** Check if a Fireworks state string is terminal. */
function isFwTerminal(state: string | undefined): boolean {
  return !!state && FW_TERMINAL_STATES.has(state);
}

/** Extracts the trailing segment of `accounts/trilogy/<endpoint>/<id>`. */
function shortName(full: string): string {
  const idx = full.lastIndexOf("/");
  return idx >= 0 ? full.slice(idx + 1) : full;
}

/**
 * Fireworks surfaces quota exhaustion as a 4xx (usually 429) with a body
 * like `training-h200-count for account trilogy, in use: 8, quota: 8`.
 */
export function isQuotaExhaustion(status: number, body: string): boolean {
  if (status < 400 || status >= 500) return false;
  const m = body.match(/in use:\s*(\d+),\s*quota:\s*(\d+)/i);
  if (!m) return false;
  const inUse = parseInt(m[1], 10);
  const quota = parseInt(m[2], 10);
  return quota > 0 && inUse >= quota;
}

async function toError(res: Response): Promise<FireworksError> {
  const body = await res.text();
  return {
    status: res.status,
    body,
    isQuotaError: isQuotaExhaustion(res.status, body),
  };
}

export function isFireworksError(e: unknown): e is FireworksError {
  return !!e && typeof e === "object" && "status" in (e as object) &&
    "body" in (e as object);
}
