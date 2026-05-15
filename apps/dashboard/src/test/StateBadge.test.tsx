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

  it('applies a style class for QUEUED (idle color)', () => {
    const { container } = render(<StateBadge state="QUEUED" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/86909b/);
  });

  it('applies a style class for SUCCESS (ok color)', () => {
    const { container } = render(<StateBadge state="SUCCESS" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/67bb6b/);
  });

  it('applies a style class for FAIL (bad color)', () => {
    const { container } = render(<StateBadge state="FAIL" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/f04c5a/);
  });

  it('applies a style class for PROGRESS (accent color)', () => {
    const { container } = render(<StateBadge state="PROGRESS" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/00a1c8/);
  });

  it('applies a style class for CANCELLED', () => {
    const { container } = render(<StateBadge state="CANCELLED" />);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/6d7277/);
  });

  it('falls back gracefully for unknown state', () => {
    const { container } = render(
      <StateBadge state={'UNKNOWN' as unknown as JobState} />,
    );
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/86909b/);
  });
});
