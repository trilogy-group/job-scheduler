'use client';

import type { JobEnriched, JobState } from '@/lib/types';
import { formatDuration } from '@/lib/time';

type StepStatus = 'done' | 'pending' | 'success' | 'fail' | 'cancelled';

function StepMarker({ status }: { status: StepStatus }) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-sm font-bold">
          ✓
        </span>
      );
    case 'fail':
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-sm font-bold">
          ✗
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-sm font-bold">
          ◌
        </span>
      );
    case 'done':
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
          ●
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-sm">
          ◌
        </span>
      );
  }
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function terminalLabel(state: JobState): string {
  switch (state) {
    case 'SUCCESS':
      return 'Completed';
    case 'FAIL':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Completed';
  }
}

function terminalStatus(state: JobState): StepStatus {
  switch (state) {
    case 'SUCCESS':
      return 'success';
    case 'FAIL':
      return 'fail';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export function JobTimeline({ job }: { job: JobEnriched }) {
  const startedStatus: StepStatus = job.started_at
    ? job.state === 'PROGRESS'
      ? 'done'
      : 'done'
    : 'pending';
  const completedStatus: StepStatus = job.completed_at
    ? terminalStatus(job.state)
    : 'pending';

  const startedDuration =
    job.started_at && job.created_at
      ? formatDuration(job.created_at, job.started_at)
      : null;
  const completedDuration =
    job.completed_at && job.started_at
      ? formatDuration(job.started_at, job.completed_at)
      : null;

  return (
    <div className="space-y-2">
      <ol className="relative border-l border-gray-200 ml-3 space-y-6 py-2">
        <li className="ml-4">
          <div className="absolute -left-3 mt-0.5">
            <StepMarker status="done" />
          </div>
          <div className="text-sm font-medium text-gray-900">Queued</div>
          <div className="text-xs text-gray-500">{fmtTs(job.created_at)}</div>
        </li>

        <li className="ml-4">
          <div className="absolute -left-3 mt-0.5">
            <StepMarker status={startedStatus} />
          </div>
          <div className="text-sm font-medium text-gray-900">Started</div>
          <div className="text-xs text-gray-500">
            {fmtTs(job.started_at)}
            {startedDuration ? (
              <span className="ml-2 text-gray-400">(+{startedDuration} from queued)</span>
            ) : null}
          </div>
        </li>

        <li className="ml-4">
          <div className="absolute -left-3 mt-0.5">
            <StepMarker status={completedStatus} />
          </div>
          <div className="text-sm font-medium text-gray-900">
            {job.completed_at ? terminalLabel(job.state) : 'Completed'}
          </div>
          <div className="text-xs text-gray-500">
            {fmtTs(job.completed_at)}
            {completedDuration ? (
              <span className="ml-2 text-gray-400">(+{completedDuration} from started)</span>
            ) : null}
          </div>
        </li>
      </ol>

      {job.state === 'FAIL' && job.error ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Error</div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{job.error}</pre>
        </div>
      ) : null}
    </div>
  );
}
