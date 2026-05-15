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
          className="px-3 py-1.5 text-sm w-56 rounded-lg transition-colors"
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
          }}
        />
        <span
          className="text-xs ml-auto font-mono tabular-nums"
          style={{ color: 'var(--fg-subtle)' }}
        >
          {filtered.length} users
        </span>
      </div>
      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            color: 'var(--fg-subtle)',
          }}
        >
          <p className="text-sm">No users found.</p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-xl"
          style={{ border: '1px solid var(--border)' }}
        >
          <table
            className="min-w-full text-sm"
            style={{ background: 'var(--bg-elev)' }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Email', hideOnSm: false },
                  { label: 'Jobs', hideOnSm: false },
                  { label: 'Success %', hideOnSm: false },
                  { label: 'GPU-hrs', hideOnSm: true },
                  { label: 'Issues', hideOnSm: true },
                  { label: 'Joined', hideOnSm: false },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider${h.hideOnSm ? ' hidden sm:table-cell' : ''}`}
                    style={{ color: 'var(--fg-subtle)' }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  <td
                    className="px-3 py-2 font-medium"
                    style={{ color: 'var(--fg)' }}
                  >
                    {u.email}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs tabular-nums"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {u.job_count}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs tabular-nums"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {u.success_rate}%
                  </td>
                  <td
                    className="hidden sm:table-cell px-3 py-2 font-mono text-xs tabular-nums"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {u.gpu_hours}
                  </td>
                  <td
                    className="hidden sm:table-cell px-3 py-2 font-mono text-xs tabular-nums"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {u.issues}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs tabular-nums"
                    style={{ color: 'var(--fg-subtle)' }}
                  >
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
