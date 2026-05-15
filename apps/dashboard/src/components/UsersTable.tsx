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

function successColor(rate: number): string {
  if (rate >= 80) return '#67bb6b';
  if (rate >= 50) return '#f3ae58';
  return '#f04c5a';
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
          className="bg-[#13161a] border border-[#373b40] text-[#f8f8f8] placeholder-[#6d7277] focus:outline-none focus:ring-1 focus:ring-[#00a1c8] rounded-md px-3 py-1.5 text-sm w-56"
        />
        <span className="text-xs text-[#6d7277]">
          {filtered.length} users
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-[#6d7277] py-12">
          <div className="text-2xl mb-2" aria-hidden="true">⚙</div>
          No users found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#23272b] rounded">
          <table className="min-w-full divide-y divide-[#23272b] text-sm">
            <thead className="bg-[#13161a] text-[#9a9fa5] uppercase text-xs tracking-wide sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Jobs</th>
                <th className="px-3 py-2 text-left font-medium">Success %</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium">GPU-hrs</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium">Issues</th>
                <th className="px-3 py-2 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#23272b]">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="bg-[#0a0e11] hover:bg-[#1c2024] transition-colors"
                >
                  <td className="px-3 py-2 text-[#f8f8f8]">{u.email}</td>
                  <td className="px-3 py-2 text-[#f8f8f8] font-medium">{u.job_count}</td>
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: successColor(u.success_rate) }}
                  >
                    {u.success_rate}%
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2 text-[#f8f8f8] font-medium">
                    {u.gpu_hours}
                  </td>
                  <td
                    className="hidden sm:table-cell px-3 py-2 font-medium"
                    style={u.issues > 0 ? { color: '#f04c5a' } : { color: '#f8f8f8' }}
                  >
                    {u.issues}
                  </td>
                  <td className="px-3 py-2 text-[#9a9fa5]">
                    {u.created_at.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
