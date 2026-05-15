'use client';

import type { JobState } from '@/lib/types';

/* Synapse-style status pills: translucent background + matching border */
const STATE_STYLES: Record<JobState, { wrapper: string; dot?: string }> = {
  QUEUED:    { wrapper: 'bg-[rgba(134,144,155,0.08)] border border-[rgba(134,144,155,0.3)] text-[#86909b]' },
  PROGRESS:  { wrapper: 'bg-[rgba(0,161,200,0.08)] border border-[rgba(0,161,200,0.3)] text-[#00a1c8]', dot: 'animate-pulse' },
  SUCCESS:   { wrapper: 'bg-[rgba(103,187,107,0.08)] border border-[rgba(103,187,107,0.3)] text-[#67bb6b]' },
  FAIL:      { wrapper: 'bg-[rgba(240,76,90,0.08)] border border-[rgba(240,76,90,0.3)] text-[#f04c5a]' },
  CANCELLED: { wrapper: 'bg-[rgba(109,114,119,0.08)] border border-[rgba(109,114,119,0.3)] text-[#6d7277]' },
};

const FALLBACK_STYLE = { wrapper: 'bg-[rgba(134,144,155,0.08)] border border-[rgba(134,144,155,0.3)] text-[#86909b]' };

export function StateBadge({ state }: { state: JobState }) {
  const { wrapper, dot } = STATE_STYLES[state] ?? FALLBACK_STYLE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${wrapper}`}
    >
      {dot && <span className={`block size-1.5 rounded-full bg-current ${dot}`} aria-hidden="true" />}
      {state}
    </span>
  );
}
