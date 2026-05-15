'use client';

import type { JobState } from '@/lib/types';

const STATE_STYLES: Record<JobState, string> = {
  QUEUED: 'bg-[#86909b]/15 text-[#86909b]',
  PROGRESS: 'bg-[#f3ae58]/15 text-[#f3ae58]',
  SUCCESS: 'bg-[#67bb6b]/15 text-[#67bb6b]',
  FAIL: 'bg-[#f04c5a]/15 text-[#f04c5a]',
  CANCELLED: 'bg-[#86909b]/15 text-[#86909b]',
};

const STATE_EDGE: Record<JobState, string> = {
  QUEUED: '#86909b',
  PROGRESS: '#f3ae58',
  SUCCESS: '#67bb6b',
  FAIL: '#f04c5a',
  CANCELLED: '#86909b',
};

const FALLBACK_STYLE = 'bg-[#86909b]/15 text-[#86909b]';

export function StateBadge({ state }: { state: JobState }) {
  const cls = STATE_STYLES[state] ?? FALLBACK_STYLE;
  const edge = STATE_EDGE[state] ?? '#86909b';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
      style={{ borderLeft: `3px solid ${edge}` }}
    >
      {state}
    </span>
  );
}
