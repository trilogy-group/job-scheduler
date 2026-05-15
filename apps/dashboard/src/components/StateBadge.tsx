'use client';

import type { JobState } from '@/lib/types';

interface StateStyle {
  bg: string;
  border: string;
  text: string;
  dotColor: string;
  pulse: boolean;
}

const STATE_STYLES: Record<JobState, StateStyle> = {
  QUEUED: {
    bg: 'rgba(134,144,155,0.06)',
    border: 'rgba(134,144,155,0.3)',
    text: '#86909b',
    dotColor: '#86909b',
    pulse: false,
  },
  PROGRESS: {
    bg: 'rgba(0,161,200,0.06)',
    border: 'rgba(0,161,200,0.3)',
    text: '#00a1c8',
    dotColor: '#00a1c8',
    pulse: true,
  },
  SUCCESS: {
    bg: 'rgba(103,187,107,0.06)',
    border: 'rgba(103,187,107,0.3)',
    text: '#67bb6b',
    dotColor: '#67bb6b',
    pulse: false,
  },
  FAIL: {
    bg: 'rgba(240,76,90,0.06)',
    border: 'rgba(240,76,90,0.3)',
    text: '#f04c5a',
    dotColor: '#f04c5a',
    pulse: false,
  },
  CANCELLED: {
    bg: 'rgba(109,114,119,0.06)',
    border: 'rgba(109,114,119,0.3)',
    text: '#6d7277',
    dotColor: '#6d7277',
    pulse: false,
  },
};

export function StateBadge({ state }: { state: JobState }) {
  const s = STATE_STYLES[state] ?? STATE_STYLES.QUEUED;
  return (
    <span
      data-state={state}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
      }}
    >
      <span
        className={`block size-1.5 rounded-full flex-shrink-0 ${s.pulse ? 'animate-synapse-pulse' : ''}`}
        style={{ background: s.dotColor }}
      />
      {state}
    </span>
  );
}
