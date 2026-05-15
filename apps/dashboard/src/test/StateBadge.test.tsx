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

  it('applies state-specific styling for QUEUED', () => {
    const { container } = render(<StateBadge state="QUEUED" />);
    expect(container.querySelector('[data-state="QUEUED"]')).toBeTruthy();
  });

  it('applies state-specific styling for SUCCESS', () => {
    const { container } = render(<StateBadge state="SUCCESS" />);
    expect(container.querySelector('[data-state="SUCCESS"]')).toBeTruthy();
  });

  it('applies state-specific styling for FAIL', () => {
    const { container } = render(<StateBadge state="FAIL" />);
    expect(container.querySelector('[data-state="FAIL"]')).toBeTruthy();
  });

  it('applies state-specific styling for PROGRESS', () => {
    const { container } = render(<StateBadge state="PROGRESS" />);
    expect(container.querySelector('[data-state="PROGRESS"]')).toBeTruthy();
  });

  it('applies state-specific styling for CANCELLED', () => {
    const { container } = render(<StateBadge state="CANCELLED" />);
    expect(container.querySelector('[data-state="CANCELLED"]')).toBeTruthy();
  });

  it('falls back for unknown state', () => {
    const { container } = render(
      <StateBadge state={'UNKNOWN' as unknown as JobState} />,
    );
    // Should render without crashing
    expect(container.querySelector('span')).toBeTruthy();
  });
});
