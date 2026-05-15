import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateBadge } from '@/components/StateBadge';
import type { JobState } from '@/lib/types';

const CASES: Array<{ state: JobState; cls: string }> = [
  { state: 'QUEUED', cls: 'color-warn' },
  { state: 'PROGRESS', cls: 'color-accent-500' },
  { state: 'SUCCESS', cls: 'color-ok' },
  { state: 'FAIL', cls: 'color-bad' },
  { state: 'CANCELLED', cls: 'color-idle' },
];

describe('StateBadge', () => {
  for (const { state, cls } of CASES) {
    it(`renders ${state} with ${cls}`, () => {
      render(<StateBadge state={state} />);
      const el = screen.getByText(state);
      expect(el).toBeInTheDocument();
      expect(el.className).toContain(cls);
    });
  }
});
