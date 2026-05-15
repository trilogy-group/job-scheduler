'use client';

import type { JobState } from '@/lib/types';

const STATE_STYLES: Record<JobState, string> = {
  QUEUED:
    'bg-[rgba(243,174,88,0.15)] text-synapse-warn border-[rgba(243,174,88,0.3)]',
  PROGRESS:
    'bg-[rgba(0,161,200,0.15)] text-synapse-accent border-[rgba(0,161,200,0.3)]',
  SUCCESS:
    'bg-[rgba(103,187,107,0.15)] text-synapse-ok border-[rgba(103,187,107,0.3)]',
  FAIL:
    'bg-[rgba(240,76,90,0.15)] text-synapse-bad border-[rgba(240,76,90,0.3)]',
  CANCELLED:
    'bg-[rgba(134,144,155,0.15)] text-synapse-idle border-[rgba(134,144,155,0.3)]',
};

const FALLBACK_STYLE =
  'bg-[rgba(134,144,155,0.15)] text-synapse-idle border-[rgba(134,144,155,0.3)]';

export function StateBadge({ state }: { state: JobState }) {
  const cls = STATE_STYLES[state] ?? FALLBACK_STYLE;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}
    >
      {state}
    </span>
  );
}
