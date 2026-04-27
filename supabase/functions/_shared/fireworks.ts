// Fireworks fine-tuning client (SFT, DPO, RFT).
//
// The scheduler calls these helpers to submit jobs, reconcile state, and
// discover live GPU usage. `kind` selects the endpoint — most operations are
// symmetric. Cancellation is the lone exception: SFT/DPO have no :cancel
// endpoint (use DELETE), RFT does (POST :cancel; DELETE removes resource).

export type Kind = "SFT" | "DPO" | "RFT";

export const FIREWORKS_BASE =
  "https://api.fireworks.ai/v1/accounts/trilogy";

const ENDPOINT: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};

// Each endpoint's list-response wraps jobs under a kind-specific array key.
// SFT  → body.supervisedFineTuningJobs
// DPO  → body.dpoJobs
// RFT  → body.reinforcementFineTuningJobs
const LIST_KEY: Record<Kind, string> = {
  SFT: "supervisedFineTuningJobs",
  DPO: "dpoJobs",
  RFT: "reinforcementFineTuningJobs",
};

// Fireworks uses protobuf-style state enums prefixed with JOB_STATE_.
// Verified at docs.fireworks.ai/api-reference/get-supervised-fine-tuning-job
// and get-reinforcement-fine-tuning-job (identical enum).
export const TERMINAL_STATES = new Set([
  "JOB_STATE_COMPLETED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "JOB_STATE_EARLY_STOPPED",
]);

export interface FireworksJob {
  name: string;
  state: string;
  gpuCount?: number;
  [k: string]: unknown;
}

export interface FireworksError {
  status: number;
  body: string;
  isQuotaError: boolean;
}

export class FireworksClient {
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
  async createJob(kind: Kind, payload: unknown): Promise<FireworksJob> {
    const res = await this.request(this.url(kind), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await toError(res);
    return await res.json() as FireworksJob;
  }

  async getJob(kind: Kind, name: string): Promise<FireworksJob> {
    const res = await this.request(this.url(kind, shortName(name)));
    if (!res.ok) throw await toError(res);
    return await res.json() as FireworksJob;
  }

  /** Returns every non-terminal job on the given endpoint. */
  async listActiveJobs(kind: Kind): Promise<FireworksJob[]> {
    const res = await this.request(this.url(kind));
    if (!res.ok) throw await toError(res);
    const body = await res.json() as Record<string, unknown>;
    // Fireworks wraps the list under a kind-specific key. Fall back to `jobs`
    // for forward compatibility if they ever standardise the wrapper.
    const arr = (body[LIST_KEY[kind]] ?? body.jobs ?? []) as FireworksJob[];
    return arr.filter((j) => !isTerminal(j.state));
  }

  /** Fans out to all kinds; used for GPU budgeting. */
  async listActiveJobsAllKinds(): Promise<
    Array<{ kind: Kind; job: FireworksJob }>
  > {
    const [sft, dpo, rft] = await Promise.all([
      this.listActiveJobs("SFT"),
      this.listActiveJobs("DPO"),
      this.listActiveJobs("RFT"),
    ]);
    return [
      ...sft.map((job) => ({ kind: "SFT" as const, job })),
      ...dpo.map((job) => ({ kind: "DPO" as const, job })),
      ...rft.map((job) => ({ kind: "RFT" as const, job })),
    ];
  }

  /**
   * Cancel a job.
   *
   * - SFT / DPO: no `:cancel` endpoint exists (verified — docs return 404).
   *   We use DELETE, which removes the resource entirely; the job stops as
   *   a side effect of the resource going away.
   * - RFT:       has a documented POST :cancel that transitions the job to
   *   JOB_STATE_CANCELLED while preserving the resource. Use that. DELETE
   *   on RFT permanently removes the resource and is reserved for cleanup.
   *
   * See sherlock notes on /api-reference/cancel-reinforcement-fine-tuning-job
   * for the asymmetry.
   */
  async cancelJob(kind: Kind, name: string): Promise<void> {
    const init: RequestInit = kind === "RFT"
      ? { method: "POST" }
      : { method: "DELETE" };
    const path = kind === "RFT"
      ? this.url(kind, `${shortName(name)}:cancel`)
      : this.url(kind, shortName(name));
    const res = await this.request(path, init);
    if (!res.ok) throw await toError(res);
  }

  /**
   * Fetch live GPU quota + usage. Supersedes the FIREWORKS_GPU_QUOTA env
   * and the two listActiveJobs calls we used to aggregate.
   *
   * Returns {maxValue, usage} for the first quota whose name matches
   * `namePattern` (default: training H200). RFT, SFT, and DPO all draw
   * from the same `training-h200-count` bucket — verified live against
   * /v1/accounts/trilogy/quotas. See
   * docs.fireworks.ai/api-reference/list-quotas.
   */
  async getTrainingGpuQuota(
    namePattern: RegExp = /training.*h200|h200.*training/i,
  ): Promise<{ maxValue: number; usage: number; name: string }> {
    const res = await this.request(`${this.base}/quotas`);
    if (!res.ok) throw await toError(res);
    const body = await res.json() as {
      quotas?: Array<
        { name?: string; value?: string; maxValue?: string; usage?: number }
      >;
    };
    const list = body.quotas ?? [];
    const match = list.find((q) => q.name && namePattern.test(q.name));
    if (!match || !match.name) {
      throw new Error(
        `no quota matching ${namePattern} in ${
          list.map((q) => q.name).join(",") || "(empty)"
        }`,
      );
    }
    const maxValue = parseInt(match.maxValue ?? match.value ?? "0", 10);
    const usage = typeof match.usage === "number" ? match.usage : 0;
    return { maxValue, usage, name: match.name };
  }
}

/** Extracts the trailing segment of `accounts/trilogy/<endpoint>/<id>`. */
function shortName(full: string): string {
  const idx = full.lastIndexOf("/");
  return idx >= 0 ? full.slice(idx + 1) : full;
}

export function isTerminal(state: string | undefined): boolean {
  return !!state && TERMINAL_STATES.has(state);
}

/**
 * Pull the GPU footprint off a Fireworks job record. Fireworks does not
 * consistently expose this field, so we fall back to the caller-provided
 * default (typically 4, matching the 4-H200-per-fine-tune norm).
 *
 * RFT additionally exposes `nodeCount`; we don't try to translate that into
 * GPU count here because the multiplier varies by model. Trainers set
 * gpu_count at enqueue time if they want a non-default footprint.
 */
export function extractGpuCount(job: FireworksJob, fallback = 4): number {
  const candidates = [
    (job as Record<string, unknown>).gpuCount,
    (job as Record<string, unknown>).gpu_count,
    (job as Record<string, unknown>)["trainingConfig"] &&
      ((job as Record<string, Record<string, unknown>>).trainingConfig)
        ?.gpuCount,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0) return c;
  }
  return fallback;
}

/**
 * Fireworks surfaces quota exhaustion as a 4xx (usually 429) with a body
 * like `training-h200-count for account trilogy, in use: 8, quota: 8`.
 * This matcher is deliberately permissive — any "in use: X, quota: Y" hint
 * with X >= Y counts as quota exhaustion.
 */
export function isQuotaExhaustion(status: number, body: string): boolean {
  if (status < 400 || status >= 500) return false;
  const m = body.match(/in use:\s*(\d+),\s*quota:\s*(\d+)/i);
  if (!m) return false;
  return parseInt(m[1], 10) >= parseInt(m[2], 10);
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
