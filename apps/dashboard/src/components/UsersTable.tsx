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
          className="border rounded px-3 py-1.5 text-sm w-56"
        />
        <span className="text-xs text-gray-500">{filtered.length} users</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No users found.</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Jobs</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Success %</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-gray-700">GPU-hrs</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-gray-700">Issues</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u, idx) => (
                <tr key={u.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-gray-900">{u.email}</td>
                  <td className="px-3 py-2 text-gray-700">{u.job_count}</td>
                  <td className="px-3 py-2 text-gray-700">{u.success_rate}%</td>
                  <td className="hidden sm:table-cell px-3 py-2 text-gray-700">{u.gpu_hours}</td>
                  <td className="hidden sm:table-cell px-3 py-2 text-gray-700">{u.issues}</td>
                  <td className="px-3 py-2 text-gray-700">{u.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
