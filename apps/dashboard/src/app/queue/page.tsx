'use client';

import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from "@/lib/supabase-browser";
import { QueueTable } from "@/components/QueueTable";
import type { JobEnriched } from "@/lib/types";

export default function QueuePage() {
  const [jobs, setJobs] = useState<JobEnriched[] | null>(null);

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
