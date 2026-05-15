import { supabase } from './supabase';
import type { JobEnriched } from './types';

export async function fetchJobById(id: string): Promise<JobEnriched | null> {
  const { data, error } = await supabase
    .from('jobs_enriched')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function fetchRecentJobs(limit = 50): Promise<JobEnriched[]> {
  const { data, error } = await supabase
    .from('jobs_enriched')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
