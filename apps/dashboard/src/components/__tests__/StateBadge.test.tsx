import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateBadge } from '@/components/StateBadge';
import type { JobState } from '@/lib/types';

/* Synapse semantic color hex values used in StateBadge */
const CASES: Array<{ state: JobState; hex: string }> = [
  { state: 'QUEUED',    hex: '86909b' },
  { state: 'PROGRESS',  hex: '00a1c8' },
  { state: 'SUCCESS',   hex: '67bb6b' },
  { state: 'FAIL',      hex: 'f04c5a' },
  { state: 'CANCELLED', hex: '6d7277' },
];

describe('StateBadge', () => {
  for (const { state, hex } of CASES) {
    it(`renders ${state} with Synapse ${hex} token`, () => {
      render(<StateBadge state={state} />);
      const el = screen.getByText(state);
      expect(el).toBeInTheDocument();
      expect(el.className).toContain(hex);
    });
  }
});
