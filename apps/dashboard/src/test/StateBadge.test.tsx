import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StateBadge } from '@/components/StateBadge';
import type { JobState } from '@/lib/types';

describe('StateBadge', () => {
  const states: JobState[] = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'];

  for (const state of states) {
    it(`renders ${state} state text`, () => {
      render(<StateBadge state={state} />);
      expect(screen.getByText(state)).toBeTruthy();
    });
  }

  it('applies text-synapse-warn class for QUEUED', () => {
    const { container } = render(<StateBadge state="QUEUED" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-warn/);
  });

  it('applies text-synapse-ok class for SUCCESS', () => {
    const { container } = render(<StateBadge state="SUCCESS" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-ok/);
  });

  it('applies text-synapse-bad class for FAIL', () => {
    const { container } = render(<StateBadge state="FAIL" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-bad/);
  });

  it('applies text-synapse-accent class for PROGRESS', () => {
    const { container } = render(<StateBadge state="PROGRESS" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-accent/);
  });

  it('applies text-synapse-idle class for CANCELLED', () => {
    const { container } = render(<StateBadge state="CANCELLED" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-idle/);
  });

  it('falls back to text-synapse-idle for unknown state', () => {
    const { container } = render(
      <StateBadge state={'UNKNOWN' as unknown as JobState} />,
    );
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-synapse-idle/);
  });
});
