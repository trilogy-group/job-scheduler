import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobTimeline } from '@/components/JobTimeline';
import { makeJob } from './fixtures';
import type { JobEnriched } from '@/lib/types';

describe('JobTimeline', () => {
  it('renders Queued step for QUEUED job (no started/completed timestamps)', () => {
    const job = makeJob({
      state: 'QUEUED',
      started_at: null,
      completed_at: null,
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByText('Started')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    // No "(+ from queued)" or "(+ from started)" durations should appear yet
    expect(container.textContent).not.toMatch(/from queued/);
    expect(container.textContent).not.toMatch(/from started/);
  });

  it('renders Queued and In Progress (started, not completed) for PROGRESS', () => {
    const job = makeJob({
      state: 'PROGRESS',
      created_at: '2026-05-01T10:00:00Z',
      started_at: '2026-05-01T10:05:00Z',
      completed_at: null,
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByText('Started')).toBeTruthy();
    // Started duration shown (+5m from queued)
    expect(container.textContent).toMatch(/from queued/);
    // Completed step is still pending — no duration
    expect(container.textContent).not.toMatch(/from started/);
  });

  it('renders all three steps with success marker for SUCCESS', () => {
    const job = makeJob({
      state: 'SUCCESS',
      created_at: '2026-05-01T10:00:00Z',
      started_at: '2026-05-01T10:05:00Z',
      completed_at: '2026-05-01T11:05:00Z',
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(screen.getByText('Queued')).toBeTruthy();
    expect(screen.getByText('Started')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(container.textContent).toMatch(/from queued/);
    expect(container.textContent).toMatch(/from started/);
    // success checkmark ✓
    expect(container.textContent).toContain('✓');
  });

  it('renders Failed label and error block for FAIL', () => {
    const job = makeJob({
      state: 'FAIL',
      created_at: '2026-05-01T10:00:00Z',
      started_at: '2026-05-01T10:05:00Z',
      completed_at: '2026-05-01T10:15:00Z',
      error: 'OOM on GPU',
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(screen.getByText('Failed')).toBeTruthy();
    // fail marker ✗
    expect(container.textContent).toContain('✗');
    expect(container.textContent).toContain('OOM on GPU');
  });

  it('renders Cancelled label for CANCELLED', () => {
    const job = makeJob({
      state: 'CANCELLED',
      created_at: '2026-05-01T10:00:00Z',
      started_at: '2026-05-01T10:05:00Z',
      completed_at: '2026-05-01T10:10:00Z',
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(container.textContent).toContain('◌');
  });

  it('omits error block when FAIL has no error message', () => {
    const job = makeJob({
      state: 'FAIL',
      created_at: '2026-05-01T10:00:00Z',
      started_at: '2026-05-01T10:05:00Z',
      completed_at: '2026-05-01T10:15:00Z',
      error: null,
    }) as unknown as JobEnriched;
    const { container } = render(<JobTimeline job={job} />);
    expect(container.textContent).not.toMatch(/Error/);
  });
});
