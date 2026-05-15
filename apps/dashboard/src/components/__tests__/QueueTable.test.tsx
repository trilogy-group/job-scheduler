import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueueTable } from '@/components/QueueTable';
import type { JobEnriched } from '@/lib/types';

const NOW = new Date('2026-05-15T12:00:00.000Z').getTime();

const makeJob = (overrides: Partial<JobEnriched> = {}): JobEnriched => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000000',
  user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
  kind: 'SFT',
  state: 'QUEUED',
  display_name: 'test-job',
  gpu_count: 4,
  fireworks_payload: null,
  fireworks_job_name: null,
  error: null,
  created_at: new Date(NOW - 90_000).toISOString(),
  started_at: null,
  completed_at: null,
  user_email: 'alice@example.com',
  base_model: null,
  output_model: null,
  dataset: null,
  failure_class: null,
  ...overrides,
});

describe('QueueTable', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when no jobs', () => {
    render(<QueueTable jobs={[]} />);
    expect(screen.getByText(/No jobs match/i)).toBeInTheDocument();
  });

  it('renders a search input with the expected aria-label', () => {
    render(<QueueTable jobs={[makeJob()]} />);
    expect(screen.getByLabelText('search jobs')).toBeInTheDocument();
  });

  it('renders a single QUEUED job with display_name, email, kind, gpus', () => {
    render(<QueueTable jobs={[makeJob()]} />);
    expect(screen.getByText('test-job')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('SFT')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    // QUEUED appears in both the filter chip and the row badge.
    expect(screen.getAllByText('QUEUED').length).toBeGreaterThanOrEqual(1);
    // age: 90s → 1m
    expect(screen.getByText('1m')).toBeInTheDocument();
  });

  it('renders ▶ in position column for PROGRESS jobs', () => {
    render(
      <QueueTable
        jobs={[
          makeJob({
            id: 'cccccccc-0000-0000-0000-000000000000',
            state: 'PROGRESS',
            display_name: 'running-job',
          }),
        ]}
      />,
    );
    expect(screen.getByText('▶')).toBeInTheDocument();
    expect(screen.getByText('running-job')).toBeInTheDocument();
  });

  it('assigns 1-based positions to multiple QUEUED jobs', () => {
    const jobs = [
      makeJob({ id: 'id-1', display_name: 'j1' }),
      makeJob({ id: 'id-2', display_name: 'j2' }),
      makeJob({ id: 'id-3', display_name: 'j3' }),
    ];
    render(<QueueTable jobs={jobs} />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('3')).toBeInTheDocument();
  });

  it('falls back to id slice and user_id slice when name/email missing', () => {
    render(
      <QueueTable
        jobs={[
          makeJob({
            id: '12345678-aaaa-bbbb-cccc-000000000000',
            user_id: '87654321-aaaa-bbbb-cccc-000000000000',
            display_name: null,
            user_email: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('87654321')).toBeInTheDocument();
  });
});
