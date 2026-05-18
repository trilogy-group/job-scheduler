'use client';

import { useEffect, useRef } from 'react';
import type { JobEnriched } from '@/lib/types';
import { StateBadge } from './StateBadge';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

export function JobModal({
  job,
  onClose,
}: {
  job: JobEnriched | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job) return;
    panelRef.current?.focus();
  }, [job]);

  useEffect(() => {
    if (!job) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [job, onClose]);

  if (!job) return null;

  const title = job.display_name ?? job.fireworks_job_name ?? job.id;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-modal-title"
        data-testid="job-modal"
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full mx-4 rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] p-6 shadow-xl max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id="job-modal-title"
              className="text-lg font-semibold text-[var(--fg)] truncate"
              title={title}
            >
              {title}
            </h2>
            <StateBadge state={job.state} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors text-xl leading-none px-2 py-1 rounded-md hover:bg-[var(--bg-hover)]"
          >
            ×
          </button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">User</dt>
          <dd className="text-[var(--fg)] break-all">
            {job.user_email ?? job.user_id}
          </dd>

          <dt className="text-[var(--fg-muted)]">Kind</dt>
          <dd className="text-[var(--fg)] font-mono text-xs">{job.kind}</dd>

          <dt className="text-[var(--fg-muted)]">State</dt>
          <dd>
            <StateBadge state={job.state} />
          </dd>

          <dt className="text-[var(--fg-muted)]">GPUs</dt>
          <dd className="text-[var(--fg)] tabular-nums">{job.gpu_count}</dd>

          <dt className="text-[var(--fg-muted)]">Created</dt>
          <dd className="text-[var(--fg)] tabular-nums">
            {fmtDate(job.created_at)}
          </dd>

          <dt className="text-[var(--fg-muted)]">Started</dt>
          <dd className="text-[var(--fg)] tabular-nums">
            {fmtDate(job.started_at)}
          </dd>

          <dt className="text-[var(--fg-muted)]">Completed</dt>
          <dd className="text-[var(--fg)] tabular-nums">
            {fmtDate(job.completed_at)}
          </dd>

          <dt className="text-[var(--fg-muted)]">Fireworks Job</dt>
          <dd className="text-[var(--fg)] font-mono text-xs break-all">
            {job.fireworks_job_name ?? '—'}
          </dd>

          <dt className="text-[var(--fg-muted)]">Error</dt>
          <dd
            className="break-words"
            style={{ color: job.error ? 'var(--color-bad)' : 'var(--fg)' }}
          >
            {job.error ?? '—'}
          </dd>
        </dl>

        {job.fireworks_payload != null && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors select-none">
              Fireworks Payload ▸
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs font-mono bg-[var(--bg)] rounded-lg p-3 text-[var(--fg)]">
              {JSON.stringify(job.fireworks_payload, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
