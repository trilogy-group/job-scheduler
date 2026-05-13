// Prime Intellect provider adapter implementing ProviderClient.
//
// Supports RFT (reinforcement fine-tuning / RL) via Prime Intellect's
// Hosted Training REST API. SFT and DPO are not supported — the adapter
// rejects them at submit time.
//
// Reference: prime_cli/api/rl.py in the Prime Intellect CLI (v0.6.4).

import {
  type Kind,
  type ProviderClient,
  type ProviderJob,
  type ProviderComputeCapacity,
} from "./providers.ts";

const PRIME_API_BASE = "https://api.primeintellect.ai/api/v1";

export class PrimeIntellectError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(
    message: string,
    status: number,
    body: string,
  ) {
    super(message);
    this.name = "PrimeIntellectError";
    this.status = status;
    this.body = body;
  }
}

export function isPrimeIntellectError(e: unknown): e is PrimeIntellectError {
  return e instanceof PrimeIntellectError;
}

export class PrimeIntellectProvider implements ProviderClient {
  readonly name = "primeintellect";
  readonly apiKey: string;
  readonly teamId: string | undefined;
  readonly fetchImpl: typeof fetch;
  readonly base: string;

  constructor(
    apiKey: string,
    teamId?: string,
    fetchImpl: typeof fetch = fetch,
    base: string = PRIME_API_BASE,
  ) {
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.fetchImpl = fetchImpl;
    this.base = base;
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    const url = `${this.base}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    const res = await this.fetchImpl(url, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    const bodyText = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!res.ok) {
      throw new PrimeIntellectError(
        `Prime Intellect API error ${res.status}: ${bodyText}`,
        res.status,
        bodyText,
      );
    }
    return body;
  }

  /** Only RFT is supported on Prime Intellect Hosted Training. */
  async submitJob(kind: Kind, payload: unknown): Promise<ProviderJob> {
    if (kind !== "RFT") {
      throw new Error(
        `Prime Intellect provider only supports RFT jobs, got ${kind}`,
      );
    }
    const p = (payload as Record<string, unknown> | null) ?? {};
    const baseModel = p.base_model;
    if (typeof baseModel !== "string" || !baseModel.trim()) {
      throw new Error(
        "base_model is required for Prime Intellect RFT jobs",
      );
    }
    const dataset = p.dataset;
    if (typeof dataset !== "string" || !dataset.trim()) {
      throw new Error(
        "dataset is required for Prime Intellect RFT jobs (must be a PI environment ID)",
      );
    }

    const hyperparameters =
      (p.hyperparameters as Record<string, unknown> | undefined) ?? {};
    const overrides =
      (p.provider_overrides as Record<string, unknown> | undefined) ?? {};

    const body: Record<string, unknown> = {
      model: { name: baseModel },
      environments: [{ id: dataset }],
      rollouts_per_example:
        overrides.rollouts_per_example ??
        hyperparameters.rollouts_per_example ??
        8,
      max_steps:
        overrides.max_steps ??
        hyperparameters.max_steps ??
        hyperparameters.num_epochs ??
        100,
      batch_size:
        overrides.batch_size ?? hyperparameters.batch_size ?? 128,
    };

    if (hyperparameters.learning_rate !== undefined) {
      body.learning_rate = hyperparameters.learning_rate;
    }
    if (hyperparameters.lora_alpha !== undefined) {
      body.lora_alpha = hyperparameters.lora_alpha;
    }
    if (overrides.max_tokens !== undefined) {
      body.max_tokens = overrides.max_tokens;
    }
    if (overrides.temperature !== undefined) {
      body.temperature = overrides.temperature;
    }
    if (overrides.repetition_penalty !== undefined) {
      body.repetition_penalty = overrides.repetition_penalty;
    }
    if (overrides.seed !== undefined) {
      body.seed = overrides.seed;
    }
    if (overrides.min_tokens !== undefined) {
      body.min_tokens = overrides.min_tokens;
    }
    if (overrides.checkpoint_id !== undefined) {
      body.checkpoint_id = overrides.checkpoint_id;
    }
    if (overrides.cluster_name !== undefined) {
      body.cluster_name = overrides.cluster_name;
    }
    if (overrides.compute_size !== undefined) {
      body.compute_size = overrides.compute_size;
    }
    if (overrides.enable_thinking !== undefined) {
      body.enable_thinking = overrides.enable_thinking;
    }
    if (overrides.reasoning_effort !== undefined) {
      body.reasoning_effort = overrides.reasoning_effort;
    }
    if (overrides.run_config !== undefined) {
      body.run_config = overrides.run_config;
    }

    if (this.teamId) {
      body.team_id = this.teamId;
    }

    const res = await this.request("/rft/runs", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const run = res.run as Record<string, unknown> | undefined;
    if (!run || typeof run.id !== "string") {
      throw new Error("Prime Intellect create run response missing run.id");
    }
    return {
      provider_job_id: run.id,
      state: (run.status as string) ?? "PENDING",
      gpuCount: 1,
    };
  }

  async getJobStatus(
    _kind: Kind,
    provider_job_id: string,
  ): Promise<ProviderJob> {
    const res = await this.request(`/rft/runs/${provider_job_id}`);
    const run = res.run as Record<string, unknown> | undefined;
    if (!run || typeof run.id !== "string") {
      throw new Error("Prime Intellect get run response missing run");
    }
    const rawStatus = (run.status as string) ?? "UNKNOWN";
    const mappedState = mapPrimeStatus(rawStatus);
    return {
      provider_job_id: run.id,
      state: mappedState,
      gpuCount: 1,
      error: (run.errorMessage as string) || undefined,
    };
  }

  async listActiveJobs(_kind?: Kind): Promise<ProviderJob[]> {
    const params: Record<string, string> = {};
    if (this.teamId) {
      params.team_id = this.teamId;
    }
    const query = new URLSearchParams(params).toString();
    const path = query ? `/rft/runs?${query}` : "/rft/runs";
    const res = await this.request(path);
    const runs = (res.runs ?? []) as Array<Record<string, unknown>>;
    const terminal = new Set(["COMPLETED", "FAILED", "STOPPED", "CANCELLED", "ERROR"]);
    return runs
      .filter((r) => {
        const status = (r.status as string) ?? "";
        return !terminal.has(status);
      })
      .map((r) => ({
        provider_job_id: String(r.id),
        state: mapPrimeStatus(String(r.status ?? "UNKNOWN")),
        gpuCount: 1,
      }));
  }

  async cancelJob(_kind: Kind, provider_job_id: string): Promise<void> {
    try {
      await this.request(`/rft/runs/${provider_job_id}/stop`, {
        method: "PUT",
      });
    } catch (e) {
      if (isPrimeIntellectError(e) && e.status === 400) {
        return;
      }
      throw e;
    }
  }

  async getComputeCapacity(
    _kind?: Kind,
  ): Promise<ProviderComputeCapacity> {
    try {
      const params: Record<string, string> = {};
      if (this.teamId) {
        params.team_id = this.teamId;
      }
      const query = new URLSearchParams(params).toString();
      const path = query ? `/rft/models?${query}` : "/rft/models";
      const res = await this.request(path);
      const models = (res.models ?? []) as Array<Record<string, unknown>>;
      const anyAvailable = models.some((m) => m.atCapacity === false);
      if (!anyAvailable) {
        return { totalGpus: 0, usedGpus: 0 };
      }
      const active = await this.listActiveJobs();
      return { totalGpus: 10, usedGpus: active.length };
    } catch (e) {
      console.warn("Prime Intellect getComputeCapacity failed:", e);
      return { totalGpus: 0, usedGpus: 0 };
    }
  }
}

function mapPrimeStatus(status: string): string {
  switch (status) {
    case "QUEUED":
    case "PENDING":
    case "RUNNING":
      return "PROGRESS";
    case "COMPLETED":
      return "SUCCESS";
    case "FAILED":
    case "ERROR":
      return "FAIL";
    case "STOPPED":
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PROGRESS";
  }
}

export function mapPrimeIntellectTerminal(
  status: string,
): { state: "SUCCESS" | "FAIL" | "CANCELLED"; errorText: (job: ProviderJob) => string | null } | null {
  const mapped = mapPrimeStatus(status);
  if (mapped === "SUCCESS") {
    return { state: "SUCCESS", errorText: () => null };
  }
  if (mapped === "FAIL") {
    return {
      state: "FAIL",
      errorText: (job) =>
        (typeof job.error === "string" && job.error) ||
        (typeof job.message === "string" && job.message) ||
        null,
    };
  }
  if (mapped === "CANCELLED") {
    return { state: "CANCELLED", errorText: () => null };
  }
  return null;
}
