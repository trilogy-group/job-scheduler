'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

const STATE_COLORS: Record<string, string> = {
  QUEUED:
    'bg-[rgba(243,174,88,0.15)] text-synapse-warn border-[rgba(243,174,88,0.3)]',
  PROGRESS:
    'bg-[rgba(0,161,200,0.15)] text-synapse-accent border-[rgba(0,161,200,0.3)]',
  SUCCESS:
    'bg-[rgba(103,187,107,0.15)] text-synapse-ok border-[rgba(103,187,107,0.3)]',
  FAIL: 'bg-[rgba(240,76,90,0.15)] text-synapse-bad border-[rgba(240,76,90,0.3)]',
  CANCELLED:
    'bg-[rgba(134,144,155,0.15)] text-synapse-idle border-[rgba(134,144,155,0.3)]',
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
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="search"
          placeholder="Search jobs…"
          aria-label="search jobs"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full bg-synapse-bg-elev border border-synapse-border text-synapse-fg placeholder:text-synapse-fg-subtle px-4 py-1.5 text-sm w-56 focus:border-synapse-accent focus:outline-none"
        />
        {ALL_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleState(s)}
            aria-pressed={activeStates.has(s)}
            data-testid={`filter-${s}`}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity ${STATE_COLORS[s]} ${
              activeStates.has(s) ? 'opacity-100' : 'opacity-30'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="text-xs text-synapse-fg-muted ml-auto">
          {filtered.length} jobs
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-synapse-fg-muted py-12">
          No jobs found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-synapse-border rounded-lg">
          <table className="min-w-full divide-y divide-synapse-border text-sm">
            <thead className="bg-synapse-bg-elev sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">User</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Kind</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">GPUs</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">State</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-synapse-border">
              {filtered.map((job, idx) => {
                const positionLabel =
                  job.state === 'PROGRESS' ? '▶' : String(queuedOrder.get(job.id) ?? '');
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                const zebra = idx % 2 === 1 ? 'bg-synapse-bg-elev' : 'bg-synapse-bg';
                return (
                  <tr
                    key={job.id}
                    className={`${zebra} hover:bg-synapse-bg-hover transition-colors`}
                  >
                    <td className="px-3 py-2 font-mono tabular-nums text-xs text-synapse-fg-muted">
                      {positionLabel}
                    </td>
                    <td className="px-3 py-2 text-synapse-fg">{name}</td>
                    <td className="px-3 py-2 text-synapse-fg-muted">{user}</td>
                    <td className="px-3 py-2 text-synapse-fg-muted">{job.kind}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-synapse-fg-muted">
                      {job.gpu_count}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td className="px-3 py-2 text-synapse-fg-subtle">
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
