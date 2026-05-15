import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateBadge } from '@/components/StateBadge';
import type { JobState } from '@/lib/types';

const CASES: Array<{ state: JobState; cls: string }> = [
  { state: 'QUEUED', cls: 'text-synapse-warn' },
  { state: 'PROGRESS', cls: 'text-synapse-accent' },
  { state: 'SUCCESS', cls: 'text-synapse-ok' },
  { state: 'FAIL', cls: 'text-synapse-bad' },
  { state: 'CANCELLED', cls: 'text-synapse-idle' },
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
