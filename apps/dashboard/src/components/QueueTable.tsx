'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';
import { humanizeAge } from '@/lib/time';

export function QueueTable({ jobs }: { jobs: JobEnriched[] }) {
  const [stateFilter, setStateFilter] = useState<string>("");

  if (jobs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        No jobs in queue or progress
      </div>
    );
  }

  const filtered = stateFilter ? jobs.filter(j => j.state === stateFilter) : jobs;

  // Compute 1-based positions among QUEUED jobs (ordered by created_at asc).
  const queuedOrder = new Map<string, number>();
  let pos = 0;
  for (const j of filtered) {
    if (j.state === 'QUEUED') {
      pos += 1;
      queuedOrder.set(j.id, pos);
    }
  }

  return (
    <>
    <div className="mb-3 flex items-center gap-2">
      <label htmlFor="state-filter" className="text-sm font-medium text-gray-700">State</label>
      <select id="state-filter" value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1">
        <option value="">All States</option>
        <option value="QUEUED">QUEUED</option>
        <option value="PROGRESS">PROGRESS</option>
      </select>
    </div>
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
            const name = job.display_name ?? job.id.slice(0, 8);
            const user = job.user_email ?? job.user_id.slice(0, 8);
            const zebra = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
            return (
              <tr key={job.id} className={zebra}>
                <td className="px-3 py-2 text-gray-700">{positionLabel}</td>
                <td className="px-3 py-2"><Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline">{name}</Link></td>
                <td className="px-3 py-2"><Link href={`/users/${job.user_id}`} className="text-blue-600 hover:underline">{user}</Link></td>
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
    </>
  );
}
