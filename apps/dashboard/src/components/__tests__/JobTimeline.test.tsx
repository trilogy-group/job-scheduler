import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobTimeline } from '@/components/JobTimeline';
import type { JobEnriched } from '@/lib/types';

const baseJob: JobEnriched = {
  id: 'aaaaaaaa-0000-0000-0000-000000000000',
  user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
  kind: 'SFT',
  state: 'QUEUED',
  display_name: 'test-job',
  gpu_count: 4,
  fireworks_payload: null,
  fireworks_job_name: null,
  error: null,
  created_at: '2026-05-15T12:00:00.000Z',
  started_at: null,
  completed_at: null,
  user_email: 'alice@example.com',
  base_model: null,
  output_model: null,
  dataset: null,
  failure_class: null,
};

describe('JobTimeline', () => {
  it('renders Queued step with created_at timestamp', () => {
    render(<JobTimeline job={baseJob} />);
    expect(screen.getByText('Queued')).toBeInTheDocument();
    // Some rendered date string for created_at.
    const tsText = new Date(baseJob.created_at).toLocaleString();
    expect(screen.getByText(tsText)).toBeInTheDocument();
  });

  it('renders Started row with em-dash when started_at is null', () => {
    render(<JobTimeline job={baseJob} />);
    expect(screen.getByText('Started')).toBeInTheDocument();
    // Em dash should appear at least once
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Started step with duration from queued', () => {
    const job: JobEnriched = {
      ...baseJob,
      state: 'PROGRESS',
      started_at: '2026-05-15T12:00:30.000Z',
    };
    render(<JobTimeline job={job} />);
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('(+30s from queued)')).toBeInTheDocument();
  });

  it('renders Completed step on SUCCESS with duration and no error panel', () => {
    const job: JobEnriched = {
      ...baseJob,
      state: 'SUCCESS',
      started_at: '2026-05-15T12:00:30.000Z',
      completed_at: '2026-05-15T12:05:30.000Z',
    };
    render(<JobTimeline job={job} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('(+5m 0s from started)')).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('renders Failed label and error panel on FAIL with error', () => {
    const job: JobEnriched = {
      ...baseJob,
      state: 'FAIL',
      started_at: '2026-05-15T12:00:30.000Z',
      completed_at: '2026-05-15T12:01:00.000Z',
      error: 'boom: something went wrong',
    };
    render(<JobTimeline job={job} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('boom: something went wrong')).toBeInTheDocument();
  });

  it('renders Cancelled label on CANCELLED state', () => {
    const job: JobEnriched = {
      ...baseJob,
      state: 'CANCELLED',
      started_at: '2026-05-15T12:00:30.000Z',
      completed_at: '2026-05-15T12:01:00.000Z',
    };
    render(<JobTimeline job={job} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('shows Completed label (default) when completed_at is null', () => {
    render(<JobTimeline job={baseJob} />);
    // Header label is "Completed" placeholder when not yet completed.
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
