import Breadcrumb from '@/components/layout/Breadcrumb';
import { StateBadge } from '@/components/StateBadge';
import { JobTimeline } from '@/components/JobTimeline';
import { FireworksPayloadPanel } from '@/components/FireworksPayloadPanel';
import { createServerClient } from '@/lib/supabase-server';
import type { JobEnriched } from '@/lib/types';

type Params = { id: string };

export default async function JobDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('jobs_enriched')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const job = (data ?? null) as JobEnriched | null;

  if (job === null) {
    return (
      <main className="p-6 space-y-4">
        <Breadcrumb
          items={[
            { href: '/queue', label: 'Queue' },
            { label: id },
          ]}
        />
        <h1 className="text-2xl font-semibold">Job not found</h1>
        <p className="text-sm text-gray-600">
          No job exists with id <code>{id}</code>.
        </p>
      </main>
    );
  }

  const heading = job.display_name ?? job.id.slice(0, 8);

  return (
    <main className="p-6 space-y-6">
      <Breadcrumb
        items={[
          { href: '/queue', label: 'Queue' },
          { label: heading },
        ]}
      />

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <StateBadge state={job.state} />
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Timeline</h2>
        <JobTimeline job={job} />
      </section>

      <section>
        <FireworksPayloadPanel job={job} />
      </section>
    </main>
  );
}
