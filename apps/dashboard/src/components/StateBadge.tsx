'use client';

import type { JobState } from '@/lib/types';

const STATE_STYLES: Record<JobState, string> = {
  QUEUED:
    'border border-[var(--color-warn)] text-[var(--color-warn)] bg-[var(--bg-elev)]',
  PROGRESS:
    'border border-[var(--color-accent-500)] text-[var(--color-accent-500)] bg-[var(--bg-elev)]',
  SUCCESS:
    'border border-[var(--color-ok)] text-[var(--color-ok)] bg-[var(--bg-elev)]',
  FAIL:
    'border border-[var(--color-bad)] text-[var(--color-bad)] bg-[var(--bg-elev)]',
  CANCELLED:
    'border border-[var(--color-idle)] text-[var(--color-idle)] bg-[var(--bg-elev)]',
};

export function StateBadge({ state }: { state: JobState }) {
  const cls =
    STATE_STYLES[state] ??
    'border border-[var(--color-idle)] text-[var(--color-idle)] bg-[var(--bg-elev)]';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}
    >
      {state}
    </span>
  );
}
