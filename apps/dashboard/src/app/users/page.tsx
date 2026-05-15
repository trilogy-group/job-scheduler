import { createServerClient } from "@/lib/supabase-server";
import { UsersTable } from "@/components/UsersTable";


interface UserWithStats {
  id: string;
  email: string;
  created_at: string;
  job_count: number;
  success_rate: number;
  gpu_hours: number;
  issues: number;
}

export default async function UsersPage() {
  const supabase = createServerClient();

  const [usersRes, jobsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("user_id, state, gpu_count, started_at, completed_at"),
  ]);

  const users = usersRes.data ?? [];
  const jobs = jobsRes.data ?? [];

  const stats = new Map<string, { total: number; success: number; gpu_hours: number; issues: number }>();
  for (const j of jobs as Array<Record<string, unknown>>) {
    const uid = j.user_id as string;
    if (!stats.has(uid)) stats.set(uid, { total: 0, success: 0, gpu_hours: 0, issues: 0 });
    const s = stats.get(uid)!;
    s.total += 1;
    if (j.state === 'SUCCESS') {
      s.success += 1;
      if (j.started_at && j.completed_at) {
        const hours =
          (new Date(j.completed_at as string).getTime() -
            new Date(j.started_at as string).getTime()) /
          3_600_000;
        s.gpu_hours += (j.gpu_count as number) * hours;
      }
    }
    if (j.state === 'FAIL' || j.state === 'CANCELLED') s.issues += 1;
  }

  const usersWithStats: UserWithStats[] = (users as Array<Record<string, unknown>>).map((u) => {
    const s = stats.get(u.id as string) ?? { total: 0, success: 0, gpu_hours: 0, issues: 0 };
    return {
      id: u.id as string,
      email: u.email as string,
      created_at: u.created_at as string,
      job_count: s.total,
      success_rate: s.total === 0 ? 0 : Math.round((s.success / s.total) * 1000) / 10,
      gpu_hours: Math.round(s.gpu_hours * 10) / 10,
      issues: s.issues,
    };
  });

  return (
    <main className="min-h-screen bg-synapse-bg p-6 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-synapse-fg">Users</h1>
      {usersRes.error && (
        <p className="text-synapse-bad mb-2">Error: {usersRes.error.message}</p>
      )}
      <UsersTable users={usersWithStats} />
    </main>
  );
}
