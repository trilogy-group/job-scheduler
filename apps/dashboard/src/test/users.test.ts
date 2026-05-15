import { describe, it, expect } from 'vitest';
import {
  computeGpuHours,
  computeFairnessViolations,
  computeSuccessRate,
  computeDailyJobCounts,
  type FinishedJob,
} from '@/lib/users';

function makeFinishedJob(overrides: Partial<FinishedJob> = {}): FinishedJob {
  return {
    id: 'aaa',
    state: 'SUCCESS',
    gpu_count: 4,
    created_at: '2026-05-01T10:00:00Z',
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe('computeGpuHours', () => {
  it('returns 0 for empty list', () => {
    expect(computeGpuHours([])).toBe(0);
  });

  it('computes hours for SUCCESS jobs', () => {
    const jobs = [
      makeFinishedJob({
        state: 'SUCCESS',
        gpu_count: 4,
        started_at: '2026-05-01T10:00:00Z',
        completed_at: '2026-05-01T12:00:00Z', // 2h * 4 GPUs = 8
      }),
    ];
    expect(computeGpuHours(jobs)).toBe(8);
  });

  it('computes hours for FAIL jobs too', () => {
    const jobs = [
      makeFinishedJob({
        state: 'FAIL',
        gpu_count: 2,
        started_at: '2026-05-01T10:00:00Z',
        completed_at: '2026-05-01T11:00:00Z', // 1h * 2 GPUs = 2
      }),
    ];
    expect(computeGpuHours(jobs)).toBe(2);
  });

  it('ignores jobs without started_at or completed_at', () => {
    const jobs = [
      makeFinishedJob({ state: 'QUEUED', gpu_count: 8, started_at: null, completed_at: null }),
      makeFinishedJob({ state: 'PROGRESS', gpu_count: 8, started_at: '2026-05-01T10:00:00Z', completed_at: null }),
    ];
    expect(computeGpuHours(jobs)).toBe(0);
  });

  it('rounds to 1 decimal place', () => {
    const jobs = [
      makeFinishedJob({
        state: 'SUCCESS',
        gpu_count: 1,
        started_at: '2026-05-01T10:00:00Z',
        completed_at: '2026-05-01T10:06:00Z', // 0.1h
      }),
    ];
    expect(computeGpuHours(jobs)).toBe(0.1);
  });
});

describe('computeFairnessViolations', () => {
  it('returns 0 for empty list', () => {
    expect(computeFairnessViolations([])).toBe(0);
  });

  it('returns 0 when FIFO is respected', () => {
    const jobs = [
      makeFinishedJob({
        id: 'a', created_at: '2026-05-01T09:00:00Z', started_at: '2026-05-01T10:00:00Z',
      }),
      makeFinishedJob({
        id: 'b', created_at: '2026-05-01T09:30:00Z', started_at: '2026-05-01T10:30:00Z',
      }),
    ];
    expect(computeFairnessViolations(jobs)).toBe(0);
  });

  it('detects out-of-order starts', () => {
    const jobs = [
      makeFinishedJob({
        id: 'a', created_at: '2026-05-01T09:00:00Z', started_at: '2026-05-01T10:30:00Z',
      }),
      makeFinishedJob({
        id: 'b', created_at: '2026-05-01T09:30:00Z', started_at: '2026-05-01T10:00:00Z',
      }),
    ];
    expect(computeFairnessViolations(jobs)).toBeGreaterThan(0);
  });

  it('ignores jobs with no started_at', () => {
    const jobs = [
      makeFinishedJob({ id: 'a', created_at: '2026-05-01T09:00:00Z', started_at: null }),
      makeFinishedJob({ id: 'b', created_at: '2026-05-01T09:30:00Z', started_at: null }),
    ];
    expect(computeFairnessViolations(jobs)).toBe(0);
  });
});

describe('computeSuccessRate', () => {
  it('returns 0 for empty list', () => {
    expect(computeSuccessRate([])).toBe(0);
  });

  it('returns 100 when all jobs succeed', () => {
    const jobs = [makeFinishedJob({ state: 'SUCCESS' }), makeFinishedJob({ state: 'SUCCESS' })];
    expect(computeSuccessRate(jobs)).toBe(100);
  });

  it('computes partial rate', () => {
    const jobs = [
      makeFinishedJob({ state: 'SUCCESS' }),
      makeFinishedJob({ state: 'FAIL' }),
      makeFinishedJob({ state: 'QUEUED' }),
    ];
    expect(computeSuccessRate(jobs)).toBe(33);
  });
});

describe('computeDailyJobCounts', () => {
  it('returns empty array for no jobs', () => {
    expect(computeDailyJobCounts([])).toEqual([]);
  });

  it('groups by day', () => {
    const jobs = [
      { created_at: '2026-05-01T09:00:00Z' },
      { created_at: '2026-05-01T15:00:00Z' },
      { created_at: '2026-05-02T10:00:00Z' },
    ];
    const result = computeDailyJobCounts(jobs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-05-01', count: 2 });
    expect(result[1]).toEqual({ date: '2026-05-02', count: 1 });
  });

  it('sorts output ascending by date', () => {
    const jobs = [
      { created_at: '2026-05-03T10:00:00Z' },
      { created_at: '2026-05-01T10:00:00Z' },
      { created_at: '2026-05-02T10:00:00Z' },
    ];
    const result = computeDailyJobCounts(jobs);
    expect(result.map((r) => r.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
  });
});
