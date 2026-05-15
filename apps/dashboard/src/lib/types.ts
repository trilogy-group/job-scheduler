export type JobKind = 'SFT' | 'DPO' | 'RFT';
export type JobState =
  | 'QUEUED'
  | 'PROGRESS'
  | 'SUCCESS'
  | 'FAIL'
  | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  kind: JobKind;
  state: JobState;
  display_name: string | null;
  gpu_count: number;
  fireworks_payload: Record<string, unknown> | null;
  fireworks_job_name: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobEnriched extends Job {
  user_email: string | null;
  base_model: string | null;
  output_model: string | null;
  dataset: string | null;
  failure_class: string | null;
}

export interface SchedulerTick {
  id: string;
  ticked_at: string;
  active_gpu_count: number;
  queued_count: number;
  in_progress_count: number;
}
