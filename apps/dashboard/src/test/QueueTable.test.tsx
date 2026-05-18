import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/queue',
  useSearchParams: () => new URLSearchParams(),
}));

import { QueueTable } from '@/components/QueueTable';
import { makeJob } from './fixtures';
import type { JobEnriched } from '@/lib/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QueueTable', () => {
  it('renders empty-state message when no jobs', () => {
    render(<QueueTable jobs={[]} />);
    expect(screen.getByText(/No jobs found/i)).toBeTruthy();
  });

  it('shows position "1" for the first QUEUED job', () => {
    const jobs: JobEnriched[] = [
      makeJob({
        id: 'q-1',
        state: 'QUEUED',
        display_name: 'queued-one',
      }) as unknown as JobEnriched,
    ];
    render(<QueueTable jobs={jobs} />);
    expect(screen.getByText('queued-one')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows "▶" marker for PROGRESS jobs', () => {
    const jobs: JobEnriched[] = [
      makeJob({
        id: 'p-1',
        state: 'PROGRESS',
        display_name: 'in-flight',
      }) as unknown as JobEnriched,
    ];
    render(<QueueTable jobs={jobs} />);
    expect(screen.getByText('▶')).toBeTruthy();
    expect(screen.getByText('in-flight')).toBeTruthy();
  });

  it('renders rows with display_name and user_email', () => {
    const jobs: JobEnriched[] = [
      makeJob({
        id: 'job-aaaa',
        state: 'PROGRESS',
        display_name: 'job-a',
        user_email: 'alice@trilogy.com',
      }) as unknown as JobEnriched,
      makeJob({
        id: 'job-bbbb',
        state: 'QUEUED',
        display_name: 'job-b',
        user_email: 'bob@trilogy.com',
      }) as unknown as JobEnriched,
      makeJob({
        id: 'job-cccc',
        state: 'QUEUED',
        display_name: 'job-c',
        user_email: 'carol@trilogy.com',
      }) as unknown as JobEnriched,
    ];
    render(<QueueTable jobs={jobs} />);
    expect(screen.getByText('job-a')).toBeTruthy();
    expect(screen.getByText('job-b')).toBeTruthy();
    expect(screen.getByText('job-c')).toBeTruthy();
    expect(screen.getByText('alice@trilogy.com')).toBeTruthy();
    expect(screen.getByText('bob@trilogy.com')).toBeTruthy();
    expect(screen.getByText('carol@trilogy.com')).toBeTruthy();
    // QUEUED positions are 1 and 2 (the PROGRESS job uses ▶)
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('▶')).toBeTruthy();
  });

  it('falls back to id slice and user_id slice when display_name/email null', () => {
    const jobs: JobEnriched[] = [
      makeJob({
        id: 'abcdef12-0000-0000-0000-000000000000',
        state: 'QUEUED',
        display_name: null,
        fireworks_job_name: null,
        user_id: 'userxyzlonglong',
        user_email: null,
      }) as unknown as JobEnriched,
    ];
    render(<QueueTable jobs={jobs} />);
    expect(screen.getByText('abcdef12')).toBeTruthy();
    // user_id is sliced to first 8 chars
    expect(screen.getByText('userxyzl')).toBeTruthy();
  });

  describe('PROGRESS rendering regression (T-REGR-PROGRESS)', () => {
    it('renders all 3 known PROGRESS job names that were missing from static build', () => {
      const progressJobs: JobEnriched[] = [
        makeJob({
          id: 'fw-p1',
          state: 'PROGRESS',
          display_name: 'math-g6-iter4-qwen3thinking-foundation',
          user_email: 'anirudh.shrikanth@trilogy.com',
          gpu_count: 4,
        }) as unknown as JobEnriched,
        makeJob({
          id: 'fw-p2',
          state: 'PROGRESS',
          display_name: 'math-g6-iter4-qwen25math-foundation',
          user_email: 'anirudh.shrikanth@trilogy.com',
          gpu_count: 4,
        }) as unknown as JobEnriched,
        makeJob({
          id: 'fw-p3',
          state: 'PROGRESS',
          display_name: 'edullm-math-forge-g4-imgdense-cap25000-v2',
          user_email: 'anirudh.shrikanth@trilogy.com',
          gpu_count: 4,
        }) as unknown as JobEnriched,
      ];
      render(<QueueTable jobs={progressJobs} />);
      expect(screen.getByText('math-g6-iter4-qwen3thinking-foundation')).toBeTruthy();
      expect(screen.getByText('math-g6-iter4-qwen25math-foundation')).toBeTruthy();
      expect(screen.getByText('edullm-math-forge-g4-imgdense-cap25000-v2')).toBeTruthy();
      const progressIndicators = screen.getAllByText('▶');
      expect(progressIndicators.length).toBe(3);
      const emailEls = screen.getAllByText('anirudh.shrikanth@trilogy.com');
      expect(emailEls.length).toBe(3);
    });

    it('PROGRESS jobs are visible with default filter state (no user interaction required)', () => {
      const job = makeJob({
        id: 'fw-p4',
        state: 'PROGRESS',
        display_name: 'check-progress-default-visible',
      }) as unknown as JobEnriched;
      render(<QueueTable jobs={[job]} />);
      expect(screen.getByText('check-progress-default-visible')).toBeTruthy();
      expect(screen.queryByText('No jobs found')).toBeNull();
    });
  });
});
