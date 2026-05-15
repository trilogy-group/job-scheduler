'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

// Synapse status chip colors for filter buttons
const STATE_CHIP: Record<string, { bg: string; border: string; text: string }> = {
  QUEUED: { bg: 'rgba(134,144,155,0.08)', border: 'rgba(134,144,155,0.3)', text: '#86909b' },
  PROGRESS: { bg: 'rgba(0,161,200,0.08)', border: 'rgba(0,161,200,0.3)', text: '#00a1c8' },
  SUCCESS: { bg: 'rgba(103,187,107,0.08)', border: 'rgba(103,187,107,0.3)', text: '#67bb6b' },
  FAIL: { bg: 'rgba(240,76,90,0.08)', border: 'rgba(240,76,90,0.3)', text: '#f04c5a' },
  CANCELLED: { bg: 'rgba(109,114,119,0.08)', border: 'rgba(109,114,119,0.3)', text: '#6d7277' },
};

export function QueueTable({ jobs }: { jobs: JobEnriched[] }) {
  const [query, setQuery] = useState('');
  const [activeStates, setActiveStates] = useState<Set<string>>(
    new Set(ALL_STATES),
  );

  function toggleState(s: string) {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  }

  const filtered = jobs
    .filter((j) => activeStates.has(j.state))
    .filter((j) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const name = (j.display_name ?? j.fireworks_job_name ?? j.id).toLowerCase();
      const user = (j.user_email ?? '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });

  // Compute 1-based positions among QUEUED jobs (ordered as filtered).
  const queuedOrder = new Map<string, number>();
  let pos = 0;
  for (const j of filtered) {
    if (j.state === 'QUEUED') {
      pos += 1;
      queuedOrder.set(j.id, pos);
    }
  }

  return (
    <div>
      {/* Search + Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="search"
          placeholder="Search jobs…"
          aria-label="search jobs"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-3 py-1.5 text-sm w-56 rounded-lg transition-colors"
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
          }}
        />
        {ALL_STATES.map((s) => {
          const chip = STATE_CHIP[s];
          const active = activeStates.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleState(s)}
              aria-pressed={active}
              data-testid={`filter-${s}`}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
              style={{
                background: active ? chip.bg : 'transparent',
                border: `1px solid ${active ? chip.border : 'var(--border)'}`,
                color: active ? chip.text : 'var(--fg-subtle)',
                opacity: active ? 1 : 0.5,
              }}
            >
              {s}
            </button>
          );
        })}
        <span
          className="text-xs ml-auto font-mono tabular-nums"
          style={{ color: 'var(--fg-subtle)' }}
        >
          {filtered.length} jobs
        </span>
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            color: 'var(--fg-subtle)',
          }}
        >
          <p className="text-sm">No jobs match the current filters.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
            Try clearing a filter chip above.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl"
          style={{ border: '1px solid var(--border)' }}
        >
          <table
            className="min-w-full text-sm"
            style={{ background: 'var(--bg-elev)' }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Name', 'User', 'Kind', 'GPUs', 'State', 'Age'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider${i === 4 ? ' hidden sm:table-cell' : ''}`}
                    style={{ color: 'var(--fg-subtle)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const positionLabel =
                  job.state === 'PROGRESS' ? '▶' : String(queuedOrder.get(job.id) ?? '');
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                return (
                  <tr
                    key={job.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '';
                    }}
                  >
                    <td
                      className="px-3 py-2 font-mono text-xs tabular-nums"
                      style={{ color: 'var(--fg-subtle)' }}
                    >
                      {positionLabel}
                    </td>
                    <td
                      className="px-3 py-2 font-medium max-w-xs truncate"
                      style={{ color: 'var(--fg)' }}
                    >
                      {name}
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {user}
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {job.kind}
                    </td>
                    <td
                      className="hidden sm:table-cell px-3 py-2 font-mono text-xs tabular-nums"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {job.gpu_count}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs tabular-nums"
                      style={{ color: 'var(--fg-subtle)' }}
                    >
                      {humanizeAge(job.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
