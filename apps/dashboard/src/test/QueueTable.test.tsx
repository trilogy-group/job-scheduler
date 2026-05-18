import { render, screen, waitFor } from '@testing-library/react';
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
  it('renders empty-state message when no jobs (default QUEUED+PROGRESS filter shows "No active jobs.")', () => {
    render(<QueueTable jobs={[]} />);
    expect(screen.getByTestId('empty-state').textContent).toMatch(/No active jobs/i);
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
      expect(screen.queryByText('No active jobs.')).toBeNull();
    });
  });

  describe('orphan merge from /api/fireworks-jobs (T-ORPHAN-POLLER)', () => {
    beforeEach(() => {
      // Use real timers so `waitFor` can poll the DOM.
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('renders orphan rows merged from /api/fireworks-jobs', async () => {
      const fwName = 'accounts/trilogy/supervisedFineTuningJobs/orphan-xyz';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              jobs: [
                {
                  name: fwName,
                  kind: 'SFT',
                  state: 'JOB_STATE_RUNNING',
                  created_at: '2026-05-01T11:00:00Z',
                  gpu_count: 4,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      const jobs: JobEnriched[] = [
        makeJob({
          id: 'tracked-1',
          state: 'PROGRESS',
          display_name: 'tracked-job',
          fireworks_job_name: 'accounts/trilogy/supervisedFineTuningJobs/tracked-1',
        }) as unknown as JobEnriched,
      ];
      render(<QueueTable jobs={jobs} />);
      await waitFor(() => expect(screen.getByTestId('orphan-row')).toBeTruthy());
      expect(screen.getByText('External')).toBeTruthy();
      expect(screen.getByText('orphan-xyz')).toBeTruthy();
    });

    it('does not mark orphan for a Fireworks job already in jobs prop by fireworks_job_name', async () => {
      const fwName = 'accounts/trilogy/supervisedFineTuningJobs/tracked-1';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              jobs: [
                {
                  name: fwName,
                  kind: 'SFT',
                  state: 'JOB_STATE_RUNNING',
                  created_at: '2026-05-01T11:00:00Z',
                  gpu_count: 4,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
      const jobs: JobEnriched[] = [
        makeJob({
          id: 'tracked-1',
          state: 'PROGRESS',
          display_name: 'tracked-job',
          fireworks_job_name: fwName,
        }) as unknown as JobEnriched,
      ];
      render(<QueueTable jobs={jobs} />);
      // Wait a tick for the effect to resolve.
      await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
      // Give React a chance to flush state from the resolved promise.
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByTestId('orphan-row')).toBeNull();
    });
  });
});
