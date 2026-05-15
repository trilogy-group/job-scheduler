import { createServerClient } from "@/lib/supabase-server";
import { QueueTable } from "@/components/QueueTable";
import type { JobEnriched } from "@/lib/types";

// Static rendering (default; no export const). The Amplify WEB_COMPUTE
// build server has SUPABASE_SERVICE_ROLE_KEY; the SSR Lambda runtime does
// not. Data is embedded at build time and refreshed on each Amplify deploy.
// TODO: expose service key to Lambda runtime and switch to force-dynamic.

export default async function QueuePage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, users(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const jobs: JobEnriched[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
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
    };
  });

  if (error) {
    console.error("[QueuePage] fetch error:", error.message);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Job Queue</h1>
      <QueueTable jobs={jobs} />
    </main>
  );
}
