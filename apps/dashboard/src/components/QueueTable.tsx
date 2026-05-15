'use client';

import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

const STATE_COLORS: Record<string, string> = {
  QUEUED: 'bg-gray-100 text-gray-800',
  PROGRESS: 'bg-blue-100 text-blue-800',
  SUCCESS: 'bg-green-100 text-green-800',
  FAIL: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-yellow-100 text-yellow-800',
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
          className="border rounded px-3 py-1.5 text-sm w-56"
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
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} jobs</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No jobs found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Kind</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-gray-700">GPUs</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">State</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((job, idx) => {
                const positionLabel =
                  job.state === 'PROGRESS' ? '▶' : String(queuedOrder.get(job.id) ?? '');
                const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                const user = job.user_email ?? job.user_id.slice(0, 8);
                const zebra = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
                return (
                  <tr key={job.id} className={zebra}>
                    <td className="px-3 py-2 text-gray-700">{positionLabel}</td>
                    <td className="px-3 py-2 text-gray-900">{name}</td>
                    <td className="px-3 py-2 text-gray-700">{user}</td>
                    <td className="px-3 py-2 text-gray-700">{job.kind}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-gray-700">{job.gpu_count}</td>
                    <td className="px-3 py-2">
                      <StateBadge state={job.state} />
                    </td>
                    <td className="px-3 py-2 text-gray-700">{humanizeAge(job.created_at)}</td>
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
