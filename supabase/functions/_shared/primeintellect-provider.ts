// Prime Intellect provider adapter implementing ProviderClient.
//
// Phase 2: This is a scaffold. Full implementation requires:
//   - prime CLI or REST API integration for pod management
//   - Axolotl config generation from unified schema
//   - HuggingFace Hub push + Fireworks model registration
//
// For Phase 1, this file exists so the provider enum and interface are
// complete, but jobs will not be routed here until the adapter is fully
// implemented.

import {
  type Kind,
  type ProviderClient,
  type ProviderJob,
  type ProviderComputeCapacity,
} from "./providers.ts";

const PRIME_API_BASE = "https://api.primeintellect.ai/api/v1";

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
  ): Promise<Response> {
    const url = `${this.base}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.teamId) {
      headers["X-Team-Id"] = this.teamId;
    }
    return await this.fetchImpl(url, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
  }

  /** Phase 2: Create pod with axolotl image, generate config, start training. */
  async submitJob(_kind: Kind, _payload: unknown): Promise<ProviderJob> {
    throw new Error("PrimeIntellectProvider.submitJob not yet implemented");
  }

  /** Phase 2: Poll pod status / training logs. */
  async getJobStatus(_kind: Kind, _provider_job_id: string): Promise<ProviderJob> {
    throw new Error("PrimeIntellectProvider.getJobStatus not yet implemented");
  }

  /** Phase 2: List active training pods. */
  async listActiveJobs(_kind?: Kind): Promise<ProviderJob[]> {
    // For Phase 1, return empty so the scheduler doesn't try to route here.
    return [];
  }

  /** Phase 2: Kill training, destroy pod. */
  async cancelJob(_kind: Kind, _provider_job_id: string): Promise<void> {
    throw new Error("PrimeIntellectProvider.cancelJob not yet implemented");
  }

  /**
   * Query GPU availability from Prime Intellect.
   * Returns {totalGpus: available, usedGpus: 0} since PI is on-demand.
   */
  async getComputeCapacity(_kind?: Kind): Promise<ProviderComputeCapacity> {
    try {
      const res = await this.request("/availability");
      if (!res.ok) {
        console.warn("Prime Intellect availability API failed:", res.status);
        return { totalGpus: 0, usedGpus: 0 };
      }
      const body = await res.json() as {
        availability?: Array<
          { gpu_type?: string; available?: number; price_per_hour?: number }
        >;
      };
      const list = body.availability ?? [];
      // Sum available GPUs across all types
      const totalGpus = list.reduce(
        (sum, g) => sum + (typeof g.available === "number" ? g.available : 0),
        0,
      );
      return { totalGpus, usedGpus: 0 };
    } catch (e) {
      console.warn("Prime Intellect getComputeCapacity failed:", e);
      return { totalGpus: 0, usedGpus: 0 };
    }
  }
}
