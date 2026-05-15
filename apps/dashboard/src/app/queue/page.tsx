import { fetchQueueJobs } from '@/lib/queue';
import { QueueTable } from '@/components/QueueTable';
import type { JobEnriched } from '@/lib/types';

export const revalidate = 15;

export default async function QueuePage() {
  let jobs: JobEnriched[];
  try {
    jobs = await fetchQueueJobs();
  } catch {
    jobs = [];
  }
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Queue ({jobs.length})
      </h2>
      <QueueTable jobs={jobs} />
    </div>
  );
}
