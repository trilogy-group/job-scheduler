'use client';

import type { JobEnriched } from '@/lib/types';

function getString(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === 'string' ? v : null;
}

export function FireworksPayloadPanel({ job }: { job: JobEnriched }) {
  const payload = job.fireworks_payload;
  const model =
    job.base_model ?? getString(payload, 'model') ?? getString(payload, 'base_model');
  const dataset = job.dataset ?? getString(payload, 'dataset');
  const outputModel = job.output_model ?? getString(payload, 'output_model');

  const rows: Array<{ label: string; value: string | null }> = [
    { label: 'Kind', value: job.kind },
    { label: 'GPU count', value: String(job.gpu_count) },
    { label: 'Fireworks job name', value: job.fireworks_job_name },
    { label: 'Model', value: model },
    { label: 'Dataset', value: dataset },
    { label: 'Output model', value: outputModel },
  ];

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Fireworks payload</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <dt className="text-xs text-gray-500">{r.label}</dt>
            <dd className="font-mono text-gray-800 break-all">
              {r.value ?? <span className="text-gray-400">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
