'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

const FILTER_ACTIVE_STYLES: Record<string, string> = {
  QUEUED:
    'border-[var(--color-idle)] text-[var(--color-idle)] bg-[var(--bg-elev)] opacity-100',
  PROGRESS:
    'border-[var(--color-warn)] text-[var(--color-warn)] bg-[var(--bg-elev)] opacity-100',
  SUCCESS:
    'border-[var(--color-ok)] text-[var(--color-ok)] bg-[var(--bg-elev)] opacity-100',
  FAIL:
    'border-[var(--color-bad)] text-[var(--color-bad)] bg-[var(--bg-elev)] opacity-100',
  CANCELLED:
    'border-[var(--color-idle)] text-[var(--color-idle)] bg-[var(--bg-elev)] opacity-100',
};

const FILTER_BASE =
  'px-2 py-1 rounded-md text-xs font-medium border transition-all';
const FILTER_INACTIVE =
  'border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)] opacity-50';

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
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="search"
          placeholder="Search jobs…"
          aria-label="search jobs"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border border-[var(--border)] rounded-full px-3 py-1.5 text-sm w-56 bg-[var(--bg-elev)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--color-accent-500)] focus:outline-none transition-colors"
        />
        {ALL_STATES.map((s) => {
          const active = activeStates.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleState(s)}
              aria-pressed={active}
              data-testid={`filter-${s}`}
              className={`${FILTER_BASE} ${active ? FILTER_ACTIVE_STYLES[s] : FILTER_INACTIVE}`}
            >
              {s}
            </button>
          );
        })}
        <span className="text-xs text-[var(--fg-subtle)] ml-auto">
          {filtered.length} jobs
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-[var(--fg-subtle)] py-12">
          No jobs found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
          <table className="min-w-full divide-y divide-[var(--border)] text-sm">
            <thead className="bg-[var(--bg-elev)] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">User</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Kind</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">GPUs</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">State</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--fg-muted)] tracking-wider uppercase">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, idx) => {
                const isQueued = job.state === 'QUEUED';
                const queuedPos = queuedOrder.get(job.id);
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                const zebra = idx % 2 === 1 ? 'bg-[var(--bg-elev)]' : 'bg-[var(--bg)]';
                return (
                  <tr
                    key={job.id}
                    className={`${zebra} hover:bg-[var(--bg-hover)] transition-colors`}
                  >
                    <td className="px-3 py-2 text-[var(--fg-muted)]">
                      {job.state === 'PROGRESS' ? (
                        <span className="text-[var(--color-warn)]">▶</span>
                      ) : isQueued && queuedPos !== undefined ? (
                        <span className="inline-flex items-center justify-center size-5 rounded-full bg-[var(--color-accent-500)]/10 text-[var(--color-accent-500)] text-xs font-semibold tabular-nums">
                          {queuedPos}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--fg)] font-medium">{name}</td>
                    <td className="px-3 py-2 text-[var(--fg-muted)]">{user}</td>
                    <td className="px-3 py-2 text-[var(--fg-muted)]">{job.kind}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-[var(--fg-muted)]">{job.gpu_count}</td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td className="px-3 py-2 text-[var(--fg-muted)]">{humanizeAge(job.created_at)}</td>
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
