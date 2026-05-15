import type { JobState } from './types';

export interface FinishedJob {
  id: string;
  state: JobState;
  gpu_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function computeGpuHours(jobs: FinishedJob[]): number {
  let total = 0;
  for (const j of jobs) {
    if (
      (j.state === 'SUCCESS' || j.state === 'FAIL') &&
      j.started_at !== null &&
      j.completed_at !== null
    ) {
      const seconds =
        (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000;
      total += (j.gpu_count * seconds) / 3600;
    }
  }
  return Math.round(total * 10) / 10;
}

export function computeFairnessViolations(jobs: FinishedJob[]): number {
  const started = jobs
    .filter((j) => j.started_at !== null)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  let violations = 0;
  for (let i = 0; i < started.length - 1; i++) {
    if (
      new Date(started[i + 1].started_at!).getTime() <
      new Date(started[i].started_at!).getTime()
    ) {
      violations++;
    }
  }
  return violations;
}

export function computeSuccessRate(jobs: FinishedJob[]): number {
  if (jobs.length === 0) return 0;
  const successes = jobs.filter((j) => j.state === 'SUCCESS').length;
  return Math.round((successes / jobs.length) * 100);
}

export interface DailyJobCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export function computeDailyJobCounts(
  jobs: Array<{ created_at: string }>,
): DailyJobCount[] {
  const counts: Record<string, number> = {};
  for (const j of jobs) {
    const date = j.created_at.slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
