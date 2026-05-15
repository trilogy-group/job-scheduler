import { supabase } from './supabase';
import type { JobEnriched } from './types';

export async function fetchQueueJobs(): Promise<JobEnriched[]> {
  const { data, error } = await supabase
    .from('jobs_enriched')
    .select('*')
    .in('state', ['QUEUED', 'PROGRESS'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
