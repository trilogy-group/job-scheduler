import { createServerClient } from '@/lib/supabase-server';
import { QueueTable } from '@/components/QueueTable';
import type { JobEnriched } from '@/lib/types';

export default async function QueuePage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('jobs_enriched')
    .select('*')
    .in('state', ['QUEUED', 'PROGRESS'])
    .order('created_at', { ascending: true });
  const jobs: JobEnriched[] = (data ?? []) as JobEnriched[];
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Active Queue</h1>
      <QueueTable jobs={jobs} />
    </main>
  );
}
