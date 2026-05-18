'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StateBadge } from '@/components/StateBadge';
import Breadcrumb from '@/components/layout/Breadcrumb';
import JobsOverTimeChart, {
  type JobsOverTimePoint,
} from '@/components/charts/JobsOverTimeChart';
import { createBrowserClient } from '@/lib/supabase-browser';

type JobState = 'QUEUED' | 'PROGRESS' | 'SUCCESS' | 'FAIL' | 'CANCELLED';
type JobKind = 'SFT' | 'DPO' | 'RFT';

type JobRow = {
  id: string;
  kind: JobKind;
  state: JobState;
  display_name: string | null;
  gpu_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  is_orphan?: boolean;
};

type UserRow = {
  id: string;
  email: string;
};

type SortOrder = 'asc' | 'desc';

type Metrics = {
  totalJobs: number;
  successRate: number;
  gpuHours: number;
  fairnessViolations: number;
};

function parseSort(raw: string | undefined | null): SortOrder {
  return raw === 'asc' ? 'asc' : 'desc';
}

function computeMetrics(jobs: JobRow[]): Metrics {
  const total = jobs.length;
  const successes = jobs.filter((j) => j.state === 'SUCCESS').length;
  const successRate = total === 0 ? 0 : successes / total;

  let gpuHours = 0;
  for (const j of jobs) {
    if (
      (j.state === 'SUCCESS' || j.state === 'FAIL') &&
      j.started_at !== null &&
      j.completed_at !== null
    ) {
      const start = new Date(j.started_at).getTime();
      const end = new Date(j.completed_at).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        gpuHours += (j.gpu_count * (end - start)) / 1000 / 3600;
      }
    }
  }

  // Fairness violation: for each pair (a, b) where a.created_at < b.created_at
  // but a.started_at > b.started_at, count `a` as violated (each job at most once).
  const started = jobs.filter(
    (j): j is JobRow & { started_at: string } => j.started_at !== null,
  );
  const violators = new Set<string>();
  for (let i = 0; i < started.length; i++) {
    const a = started[i];
    const aCreated = new Date(a.created_at).getTime();
    const aStarted = new Date(a.started_at).getTime();
    for (let k = 0; k < started.length; k++) {
      if (i === k) continue;
      const b = started[k];
      const bCreated = new Date(b.created_at).getTime();
      const bStarted = new Date(b.started_at).getTime();
      if (bCreated > aCreated && bStarted < aStarted) {
        violators.add(a.id);
        break;
      }
    }
  }

  return {
    totalJobs: total,
    successRate,
    gpuHours,
    fairnessViolations: violators.size,
  };
}

function bucketJobsByDay(jobs: JobRow[]): JobsOverTimePoint[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const day = j.created_at.slice(0, 10); // YYYY-MM-DD
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function fmtDate(value: string | null): string {
  if (value === null) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtHours(value: number): string {
  return value.toFixed(2);
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = (params?.id ?? '') as string;
  const sort = parseSort(searchParams?.get('sort') ?? undefined);

  const [loading, setLoading] = useState<boolean>(true);
  const [userRow, setUserRow] = useState<UserRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    if (!id) return;
    const supabase = createBrowserClient();
    let cancelled = false;

    (async () => {
      const { data: userRowRaw } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', id)
        .maybeSingle();
      const u = userRowRaw as UserRow | null;

      if (cancelled) return;
      setUserRow(u);

      if (u === null) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const { data: jobsRaw, error: jobsErr } = await supabase
        .from('jobs')
        .select(
          'id, kind, state, display_name, gpu_count, created_at, started_at, completed_at',
        )
        .eq('user_id', id);
      if (jobsErr) console.error('[users/[id]] jobs fetch error:', jobsErr.message);

      if (cancelled) return;
      setJobs((jobsRaw ?? []) as JobRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-500">Loading…</div>
      </main>
    );
  }

  if (userRow === null) {
    return (
      <main className="p-6">
        <Breadcrumb
          items={[
            { href: '/users', label: 'Users' },
            { label: id },
          ]}
        />
        <h1 className="mt-4 text-2xl font-semibold">User not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          No user exists with id <code>{id}</code>.
        </p>
      </main>
    );
  }

  const metrics = computeMetrics(jobs);
  const overTime = bucketJobsByDay(jobs);

  const sortedJobs = [...jobs].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sort === 'asc' ? ta - tb : tb - ta;
  });

  const toggleSort: SortOrder = sort === 'asc' ? 'desc' : 'asc';

  return (
    <main className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { href: '/users', label: 'Users' },
          { label: userRow.email },
        ]}
      />

      <header>
        <h1 className="text-2xl font-semibold">{userRow.email}</h1>
        <p className="text-xs text-gray-500">User id: {userRow.id}</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Jobs" value={String(metrics.totalJobs)} />
        <MetricCard label="Success Rate" value={fmtPercent(metrics.successRate)} />
        <MetricCard label="GPU-Hours" value={fmtHours(metrics.gpuHours)} />
        <MetricCard
          label="Fairness Violations"
          value={String(metrics.fairnessViolations)}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Job history</h2>
          <Link
            href={`/users/${userRow.id}?sort=${toggleSort}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Sort by created_at: {sort} (toggle)
          </Link>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Display Name</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">GPU</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-gray-500"
                  >
                    No jobs for this user.
                  </td>
                </tr>
              ) : (
                sortedJobs.map((j) => (
                  <tr
                    key={j.id}
                    data-testid={j.is_orphan ? 'orphan-row' : undefined}
                    title={j.is_orphan ? 'Started outside the queue' : undefined}
                    className={`border-t border-gray-100${j.is_orphan ? ' border-l-2 border-amber-400' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {j.display_name ?? j.id.slice(0, 8)}
                      </Link>
                      {j.is_orphan && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-400/40">External</span>}
                    </td>
                    <td className="px-3 py-2">{j.kind}</td>
                    <td className="px-3 py-2"><StateBadge state={j.state} /></td>
                    <td className="px-3 py-2">{j.gpu_count}</td>
                    <td className="px-3 py-2">{fmtDate(j.created_at)}</td>
                    <td className="px-3 py-2">{fmtDate(j.started_at)}</td>
                    <td className="px-3 py-2">{fmtDate(j.completed_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Jobs over time</h2>
        <JobsOverTimeChart data={overTime} />
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
