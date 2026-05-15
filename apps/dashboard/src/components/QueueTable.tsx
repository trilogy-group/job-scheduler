'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

// Synapse semantic chip colors (bg/text/border — inline style to access CSS vars at runtime)
const CHIP_STYLES: Record<string, { activeBg: string; activeText: string; activeBorder: string }> = {
  QUEUED:    { activeBg: 'rgba(243,174,88,0.15)',  activeText: 'var(--color-warn)',        activeBorder: 'rgba(243,174,88,0.4)' },
  PROGRESS:  { activeBg: 'rgba(0,161,200,0.15)',   activeText: 'var(--color-accent-500)',   activeBorder: 'rgba(0,161,200,0.4)' },
  SUCCESS:   { activeBg: 'rgba(103,187,107,0.15)', activeText: 'var(--color-ok)',           activeBorder: 'rgba(103,187,107,0.4)' },
  FAIL:      { activeBg: 'rgba(240,76,90,0.15)',   activeText: 'var(--color-bad)',          activeBorder: 'rgba(240,76,90,0.4)' },
  CANCELLED: { activeBg: 'rgba(134,144,155,0.15)', activeText: 'var(--color-idle)',         activeBorder: 'rgba(134,144,155,0.4)' },
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
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="search"
          placeholder="Search jobs…"
          aria-label="search jobs"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)', color: 'var(--fg)' }}
          className="rounded-full border px-4 py-1.5 text-sm w-56 placeholder:text-[--fg-subtle] focus:outline-none focus:border-[--color-accent-500] transition-colors"
        />
        {ALL_STATES.map((s) => {
          const cs = CHIP_STYLES[s];
          const on = activeStates.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleState(s)}
              aria-pressed={on}
              data-testid={`filter-${s}`}
              style={on
                ? { backgroundColor: cs.activeBg, color: cs.activeText, borderColor: cs.activeBorder }
                : { backgroundColor: 'transparent', color: 'var(--fg-subtle)', borderColor: 'var(--border)' }
              }
              className="px-2.5 py-0.5 rounded-full border text-xs font-semibold tracking-wider transition-all"
            >
              {s}
            </button>
          );
        })}
        <span className="text-xs ml-auto" style={{ color: 'var(--fg-muted)' }}>{filtered.length} jobs</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--fg-subtle)' }}>
          No jobs found.
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border"
          style={{ borderColor: 'var(--border)' }}
        >
          <table className="min-w-full text-sm">
            <thead
              className="sticky top-0"
              style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
            >
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>User</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Kind</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>GPUs</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>State</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, idx) => {
                const positionLabel =
                  job.state === 'PROGRESS' ? '▶' : String(queuedOrder.get(job.id) ?? '');
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                const rowBg = idx % 2 === 1 ? 'var(--bg-elev)' : 'var(--bg)';
                return (
                  <tr
                    key={job.id}
                    style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-[--bg-hover] transition-colors"
                  >
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{positionLabel}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--fg)' }}>{name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--fg-muted)' }}>{user}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{job.kind}</td>
                    <td className="hidden sm:table-cell px-3 py-2 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{job.gpu_count}</td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--fg-subtle)' }}>{humanizeAge(job.created_at)}</td>
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
