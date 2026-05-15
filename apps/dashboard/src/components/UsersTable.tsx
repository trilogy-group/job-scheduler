'use client';
import { useState } from 'react';

interface UserWithStats {
  id: string;
  email: string;
  created_at: string;
  job_count: number;
  success_rate: number;
  gpu_hours: number;
  issues: number;
}

export function UsersTable({ users }: { users: UserWithStats[] }) {
  const [query, setQuery] = useState('');
  const filtered = users.filter(
    (u) => !query.trim() || u.email.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        <input
          type="search"
          placeholder="Search users…"
          aria-label="search users"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full bg-synapse-bg-elev border border-synapse-border text-synapse-fg placeholder:text-synapse-fg-subtle px-4 py-1.5 text-sm w-56 focus:border-synapse-accent focus:outline-none"
        />
        <span className="text-xs text-synapse-fg-muted">
          {filtered.length} users
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-synapse-fg-muted py-12">
          No users found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-synapse-border rounded-lg">
          <table className="min-w-full divide-y divide-synapse-border text-sm">
            <thead className="bg-synapse-bg-elev sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Jobs</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Success %</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">GPU-hrs</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Issues</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-synapse-fg-muted">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-synapse-border">
              {filtered.map((u, idx) => {
                const zebra = idx % 2 === 1 ? 'bg-synapse-bg-elev' : 'bg-synapse-bg';
                return (
                  <tr
                    key={u.id}
                    className={`${zebra} hover:bg-synapse-bg-hover transition-colors`}
                  >
                    <td className="px-3 py-2 text-synapse-fg">{u.email}</td>
                    <td className="px-3 py-2 text-synapse-fg-muted">{u.job_count}</td>
                    <td className="px-3 py-2 text-synapse-fg-muted">{u.success_rate}%</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-synapse-fg-muted">
                      {u.gpu_hours}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-synapse-fg-muted">
                      {u.issues}
                    </td>
                    <td className="px-3 py-2 text-synapse-fg-subtle">
                      {u.created_at.slice(0, 10)}
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
