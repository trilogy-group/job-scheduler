import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
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
    expect(screen.getByText(/No jobs match/i)).toBeTruthy();
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
});
