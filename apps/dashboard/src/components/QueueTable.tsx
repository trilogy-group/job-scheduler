'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

const STATE_COLORS: Record<string, string> = {
  QUEUED: 'bg-[#86909b]/15 text-[#86909b] border-[#86909b]',
  PROGRESS: 'bg-[#f3ae58]/15 text-[#f3ae58] border-[#f3ae58]',
  SUCCESS: 'bg-[#67bb6b]/15 text-[#67bb6b] border-[#67bb6b]',
  FAIL: 'bg-[#f04c5a]/15 text-[#f04c5a] border-[#f04c5a]',
  CANCELLED: 'bg-[#86909b]/15 text-[#86909b] border-[#86909b]',
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
          className="bg-[#13161a] border border-[#373b40] text-[#f8f8f8] placeholder-[#6d7277] focus:outline-none focus:ring-1 focus:ring-[#00a1c8] rounded-md px-3 py-1.5 text-sm w-56"
        />
        {ALL_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleState(s)}
            aria-pressed={activeStates.has(s)}
            data-testid={`filter-${s}`}
            className={`px-2 py-1 rounded text-xs font-medium border transition-opacity ${STATE_COLORS[s]} ${
              activeStates.has(s) ? 'opacity-100' : 'opacity-30'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="text-xs text-[#6d7277] ml-auto">
          {filtered.length} jobs
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-[#6d7277] py-12">
          <div className="text-2xl mb-2" aria-hidden="true">⚙</div>
          No jobs found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#23272b] rounded">
          <table className="min-w-full divide-y divide-[#23272b] text-sm">
            <thead className="bg-[#13161a] text-[#9a9fa5] uppercase text-xs tracking-wide sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-left font-medium">Kind</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium">GPUs</th>
                <th className="px-3 py-2 text-left font-medium">State</th>
                <th className="px-3 py-2 text-left font-medium">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#23272b]">
              {filtered.map((job) => {
                const positionLabel =
                  job.state === 'PROGRESS' ? '▶' : String(queuedOrder.get(job.id) ?? '');
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                const progressEdge =
                  job.state === 'PROGRESS' ? 'border-l-2 border-[#f3ae58]' : '';
                return (
                  <tr
                    key={job.id}
                    className={`bg-[#0a0e11] hover:bg-[#1c2024] transition-colors ${progressEdge}`}
                  >
                    <td className="px-3 py-2 text-[#9a9fa5] font-mono tabular-nums text-xs">
                      {positionLabel}
                    </td>
                    <td className="px-3 py-2 text-[#f8f8f8]">{name}</td>
                    <td className="px-3 py-2 text-[#9a9fa5]">{user}</td>
                    <td className="px-3 py-2 text-[#9a9fa5]">{job.kind}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-[#9a9fa5]">
                      {job.gpu_count}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td className="px-3 py-2 text-[#9a9fa5]">
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
