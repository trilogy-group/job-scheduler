'use client';
import { useState } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';

const PAGE_SIZE = 50;
const ALL_STATES = ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED'] as const;

const STATE_COLORS: Record<string, string> = {
  QUEUED: 'bg-gray-100 text-gray-800',
  PROGRESS: 'bg-blue-100 text-blue-800',
  SUCCESS: 'bg-green-100 text-green-800',
  FAIL: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-yellow-100 text-yellow-800',
};

function fmtDate(iso: string) {
  return iso.slice(0, 16).replace('T', ' ');
}

export function JobsTable({ jobs }: { jobs: JobEnriched[] }) {
  const [query, setQuery] = useState('');
  const [activeStates, setActiveStates] = useState<Set<string>>(new Set(ALL_STATES));
  const [page, setPage] = useState(0);

  const filtered = jobs
    .filter((j) => activeStates.has(j.state))
    .filter((j) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const name = (j.display_name ?? j.fireworks_job_name ?? j.id).toLowerCase();
      const user = (j.user_email ?? '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

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
    setPage(0);
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
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
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
        <div className="text-center text-gray-500 py-12">No jobs found.</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Kind</th>
                  <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-gray-700">GPUs</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">State</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((job, idx) => {
                  const name = job.display_name ?? job.fireworks_job_name ?? job.id.slice(0, 8);
                  const user = job.user_email ?? job.user_id.slice(0, 8);
                  const zebra = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
                  return (
                    <tr key={job.id} className={zebra}>
                      <td className="px-3 py-2 text-gray-900 max-w-xs truncate" title={name}>
                        {name}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{user}</td>
                      <td className="px-3 py-2 text-gray-700">{job.kind}</td>
                      <td className="hidden sm:table-cell px-3 py-2 text-gray-700">{job.gpu_count}</td>
                      <td className="px-3 py-2">
                        <StateBadge state={job.state} />
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(job.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-3 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
