'use client';

import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from "@/lib/supabase-browser";
import { QueueTable } from "@/components/QueueTable";
import type { JobEnriched } from "@/lib/types";

export default function QueuePage() {
  const [jobs, setJobs] = useState<JobEnriched[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelledCfg = false;
    (async () => {
      try {
        const res = await fetch("/api/fireworks-jobs", { cache: "no-store" });
        const body = (await res.json()) as { configured?: boolean };
        if (!cancelledCfg) setConfigured(body.configured === false ? false : true);
      } catch (err) {
        console.error("[QueuePage] fireworks-jobs config check failed:", err);
      }
    })();
    return () => {
      cancelledCfg = true;
    };
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, users(email)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[QueuePage] fetch error:", error.message);
      }

      const mapped: JobEnriched[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const usersField = row.users as { email?: string } | null;
        return {
          id: row.id as string,
          user_id: row.user_id as string,
          kind: row.kind as JobEnriched["kind"],
          state: row.state as JobEnriched["state"],
          display_name: (row.display_name as string | null) ?? null,
          gpu_count: row.gpu_count as number,
          fireworks_payload: (row.fireworks_payload as Record<string, unknown> | null) ?? null,
          fireworks_job_name: (row.fireworks_job_name as string | null) ?? null,
          error: (row.error as string | null) ?? null,
          created_at: row.created_at as string,
          started_at: (row.started_at as string | null) ?? null,
          completed_at: (row.completed_at as string | null) ?? null,
          user_email: usersField?.email ?? null,
          base_model: null,
          output_model: null,
          dataset: null,
          failure_class: null,
          is_orphan: (row.is_orphan as boolean | null) ?? false,
        };
      });

      if (!cancelled) setJobs(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight mb-4" style={{ color: 'var(--fg)' }}>
        Active Queue
      </h1>
      {configured === false && (jobs === null || jobs.length === 0) && (
        <div
          data-testid="configured-false-banner"
          role="alert"
          className="rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--warning-border, #f59e0b)',
            background: 'var(--warning-bg, #fef3c7)',
            color: 'var(--warning-fg, #92400e)',
          }}
        >
          Queue data unavailable — Fireworks API not configured on this deployment.
        </div>
      )}
      {jobs === null ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--fg-subtle)' }}>Loading queue…</div>
      ) : (
        <Suspense fallback={<div className="py-12 text-center text-sm" style={{ color: 'var(--fg-subtle)' }}>Loading queue…</div>}>
          <QueueTable jobs={jobs} />
        </Suspense>
      )}
    </div>
  );
}
