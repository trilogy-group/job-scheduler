import type { JobState, JobKind } from '@/lib/types';

export interface MinimalJob {
  id: string;
  kind: JobKind;
  state: JobState;
  gpu_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  display_name: string | null;
  user_id: string;
  fireworks_payload: Record<string, unknown> | null;
  fireworks_job_name: string | null;
  error: string | null;
  user_email: string | null;
  base_model: string | null;
  output_model: string | null;
  dataset: string | null;
  failure_class: string | null;
}

export function makeJob(overrides: Partial<MinimalJob> = {}): MinimalJob {
  return {
    id: 'aaaa0001-0000-0000-0000-000000000001',
    kind: 'SFT',
    state: 'QUEUED',
    gpu_count: 4,
    created_at: '2026-05-01T10:00:00Z',
    started_at: null,
    completed_at: null,
    display_name: 'Test Job',
    user_id: 'user-1',
    fireworks_payload: { model: 'llama-3-8b', dataset: 'ds-001' },
    fireworks_job_name: 'fw-job-001',
    error: null,
    user_email: 'alice@trilogy.com',
    base_model: 'llama-3-8b',
    output_model: 'alice-sft-v1',
    dataset: 'ds-001',
    failure_class: null,
    ...overrides,
  };
}
