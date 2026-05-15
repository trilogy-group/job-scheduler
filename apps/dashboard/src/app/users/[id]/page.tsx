import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase-server';
import { StateBadge } from '@/components/StateBadge';
import { humanizeAge } from '@/lib/time';
import {
  JobsOverTimeChart,
  type JobsOverTimePoint,
} from '@/components/charts/JobsOverTimeChart';
import type { JobKind, JobState } from '@/lib/types';

type SortOrder = 'asc' | 'desc';

interface UserRow {
  id: string;
  email: string | null;
}

interface JobRow {
  id: string;
  kind: JobKind;
  state: JobState;
  display_name: string | null;
  gpu_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface UserMetrics {
  total_jobs: number;
  success_rate: number; // 0..1
  gpu_hours: number;
  fairness_violations: number;
}

function computeGpuHours(jobs: JobRow[]): number {
  let total = 0;
  for (const j of jobs) {
    if (
      (j.state === 'SUCCESS' || j.state === 'FAIL') &&
      j.started_at !== null &&
      j.completed_at !== null
    ) {
      const seconds =
        (new Date(j.completed_at).getTime() -
          new Date(j.started_at).getTime()) /
        1000;
      total += (j.gpu_count * seconds) / 3600;
    }
  }
  return Math.round(total * 10) / 10;
}

function computeFairnessViolations(jobs: JobRow[]): number {
  const filtered = jobs
    .filter((j) => j.started_at !== null)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  let violations = 0;
  for (let i = 0; i < filtered.length; i++) {
    const startedI = new Date(filtered[i].started_at as string).getTime();
    for (let k = 0; k < i; k++) {
      const startedK = new Date(filtered[k].started_at as string).getTime();
      if (startedI < startedK) {
        violations += 1;
      }
    }
  }
  return violations;
}

function computeJobsOverTime(jobs: JobRow[]): JobsOverTimePoint[] {
  const buckets = new Map<string, number>();
  for (const j of jobs) {
    const date = j.created_at.slice(0, 10);
    buckets.set(date, (buckets.get(date) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}

function computeMetrics(jobs: JobRow[]): UserMetrics {
  const total = jobs.length;
  const successes = jobs.filter((j) => j.state === 'SUCCESS').length;
  return {
    total_jobs: total,
    success_rate: total === 0 ? 0 : successes / total,
    gpu_hours: computeGpuHours(jobs),
    fairness_violations: computeFairnessViolations(jobs),
  };
}

function formatIsoDate(iso: string | null): string {
  if (iso === null) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border border-gray-200 rounded p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const { sort: sortParam } = await searchParams;
  const sort: SortOrder = sortParam === 'asc' ? 'asc' : 'desc';

  const supabase = getServerSupabase();

  const { data: userData } = await supabase
    .from('users')
    .select('id,email')
    .eq('id', id)
    .maybeSingle<UserRow>();

  if (!userData) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          User not found
        </h2>
        <p className="text-gray-500">No user with id {id}.</p>
      </div>
    );
  }

  const { data: jobsData } = await supabase
    .from('jobs')
    .select(
      'id,kind,state,display_name,gpu_count,created_at,started_at,completed_at',
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .returns<JobRow[]>();

  const jobs: JobRow[] = jobsData ?? [];

  const metrics = computeMetrics(jobs);
  const overTime = computeJobsOverTime(jobs);

  const sortedJobs = jobs.slice().sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sort === 'asc' ? ta - tb : tb - ta;
  });

  const heading = userData.email ?? userData.id;
  const successPct = (metrics.success_rate * 100).toFixed(1) + '%';

  const sortLinkBase =
    'px-3 py-1 rounded text-sm border transition-colors';
  const activeCls = 'bg-blue-600 text-white border-blue-600';
  const inactiveCls =
    'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        {userData.email !== null && (
          <p className="text-xs text-gray-500 mt-0.5">id: {userData.id}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Jobs" value={metrics.total_jobs} />
        <MetricCard label="Success Rate" value={successPct} />
        <MetricCard label="GPU-Hours" value={metrics.gpu_hours.toFixed(1)} />
        <MetricCard
          label="Fairness Violations"
          value={metrics.fairness_violations}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Job history</h3>
          <div className="flex gap-2">
            <Link
              href={`/users/${id}?sort=asc`}
              className={`${sortLinkBase} ${
                sort === 'asc' ? activeCls : inactiveCls
              }`}
            >
              Oldest first
            </Link>
            <Link
              href={`/users/${id}?sort=desc`}
              className={`${sortLinkBase} ${
                sort === 'desc' ? activeCls : inactiveCls
              }`}
            >
              Newest first
            </Link>
          </div>
        </div>

        {sortedJobs.length === 0 ? (
          <div className="text-center text-gray-500 py-12 border border-gray-200 rounded">
            No jobs for this user
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Display Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Kind
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    State
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    GPU
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Started
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedJobs.map((job, idx) => {
                  const name = job.display_name ?? job.id.slice(0, 8);
                  const zebra = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
                  return (
                    <tr key={job.id} className={zebra}>
                      <td className="px-3 py-2 text-gray-900">{name}</td>
                      <td className="px-3 py-2 text-gray-700">{job.kind}</td>
                      <td className="px-3 py-2">
                        <StateBadge state={job.state} />
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {job.gpu_count}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {humanizeAge(job.created_at)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {formatIsoDate(job.started_at)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {formatIsoDate(job.completed_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Jobs over time
        </h3>
        <JobsOverTimeChart data={overTime} />
      </div>
    </div>
  );
}

// Force this page to render on every request so SUPABASE_SERVICE_ROLE_KEY
// can be picked up at runtime and metrics stay fresh.
export const dynamic = 'force-dynamic';

