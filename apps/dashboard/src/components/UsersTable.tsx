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
      <div className="flex gap-2 mb-4 items-center">
        <input
          type="search"
          placeholder="Search users…"
          aria-label="search users"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)', color: 'var(--fg)' }}
          className="rounded-full border px-4 py-1.5 text-sm w-56 placeholder:text-[--fg-subtle] focus:outline-none focus:border-[--color-accent-500] transition-colors"
        />
        <span className="text-xs ml-auto" style={{ color: 'var(--fg-muted)' }}>{filtered.length} users</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--fg-subtle)' }}>No users found.</div>
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
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Email</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Jobs</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Success %</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>GPU-hrs</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Issues</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider" style={{ color: 'var(--fg-muted)' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => {
                const rowBg = idx % 2 === 1 ? 'var(--bg-elev)' : 'var(--bg)';
                return (
                  <tr
                    key={u.id}
                    style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-[--bg-hover] transition-colors"
                  >
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--fg)' }}>{u.email}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{u.job_count}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{u.success_rate}%</td>
                    <td className="hidden sm:table-cell px-3 py-2 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{u.gpu_hours}</td>
                    <td className="hidden sm:table-cell px-3 py-2 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{u.issues}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--fg-subtle)' }}>{u.created_at.slice(0, 10)}</td>
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
