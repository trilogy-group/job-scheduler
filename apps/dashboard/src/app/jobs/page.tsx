import { createServerClient } from "@/lib/supabase-server";
import { JobsTable } from "@/components/JobsTable";
import type { JobEnriched } from "@/lib/types";


export default async function JobsPage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, users(email)")
    .order("created_at", { ascending: false })
    .limit(500);

  const jobs: JobEnriched[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const usersField = row.users as { email?: string } | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      kind: row.kind as "SFT" | "DPO" | "RFT",
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
    };
  });

  return (
    <main className="min-h-screen bg-synapse-bg p-6 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-synapse-fg">All Jobs</h1>
      {error && <p className="text-synapse-bad mb-2">Error loading jobs: {error.message}</p>}
      <JobsTable jobs={jobs} />
    </main>
  );
}
