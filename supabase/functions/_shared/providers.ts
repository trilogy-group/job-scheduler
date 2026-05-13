// Provider adapter interface for multi-provider fine-tuning job routing.
//
// Each provider implements ProviderClient. The scheduler binds a job to a
// provider at admission time and uses the adapter to submit, poll, and
// cancel jobs.

export type Kind = "SFT" | "DPO" | "RFT";
export const VALID_KINDS = new Set<Kind>(["SFT", "DPO", "RFT"]);

export const TERMINAL_STATES = new Set([
  "SUCCESS",
  "FAIL",
  "CANCELLED",
]);

export interface ProviderJob {
  provider_job_id: string;
  state: string;
  gpuCount?: number;
  [k: string]: unknown;
}

export interface ProviderComputeCapacity {
  totalGpus: number;
  usedGpus: number;
}

export interface ProviderClient {
  readonly name: string;

  /** Submit a job to the provider. Returns the provider-assigned job ID. */
  submitJob(kind: Kind, payload: unknown): Promise<ProviderJob>;

  /** Poll the provider for current job status. */
  getJobStatus(kind: Kind, provider_job_id: string): Promise<ProviderJob>;

  /** List all active (non-terminal) jobs on this provider. */
  listActiveJobs(kind?: Kind): Promise<ProviderJob[]>;

  /** Cancel a running job. */
  cancelJob(kind: Kind, provider_job_id: string): Promise<void>;

  /** Get available GPU capacity. */
  getComputeCapacity(kind?: Kind): Promise<ProviderComputeCapacity>;
}

/** Map a provider's terminal state string to scheduler terminal states. */
export interface TerminalMapping {
  state: "SUCCESS" | "FAIL" | "CANCELLED";
  errorText: (job: ProviderJob) => string | null;
}

/** Check if a state string is terminal (provider-agnostic). */
export function isTerminalState(state: string | undefined): boolean {
  return !!state && TERMINAL_STATES.has(state);
}

/** Extract GPU count from a provider job with fallback. */
export function extractGpuCount(
  job: ProviderJob,
  fallback = 4,
): number {
  if (typeof job.gpuCount === "number" && job.gpuCount > 0) {
    return job.gpuCount;
  }
  // Try common field names
  const candidates = [
    (job as Record<string, unknown>).gpu_count,
    (job as Record<string, unknown>).gpuCount,
    (job as Record<string, unknown>)["trainingConfig"] &&
      ((job as Record<string, Record<string, unknown>>).trainingConfig)
        ?.gpuCount,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0) return c;
  }
  return fallback;
}
