'use client';

import type { JobState } from '@/lib/types';

const STATE_STYLES: Record<JobState, string> = {
  QUEUED: 'bg-gray-100 text-gray-700',
  PROGRESS: 'bg-blue-100 text-blue-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAIL: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-yellow-100 text-yellow-700',
};

export function StateBadge({ state }: { state: JobState }) {
  const cls = STATE_STYLES[state] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
    >
      {state}
    </span>
  );
}
