import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateBadge } from '@/components/StateBadge';
import type { JobState } from '@/lib/types';

const CASES: Array<{ state: JobState; cls: string }> = [
  { state: 'QUEUED', cls: 'bg-gray-100' },
  { state: 'PROGRESS', cls: 'bg-blue-100' },
  { state: 'SUCCESS', cls: 'bg-green-100' },
  { state: 'FAIL', cls: 'bg-red-100' },
  { state: 'CANCELLED', cls: 'bg-yellow-100' },
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
