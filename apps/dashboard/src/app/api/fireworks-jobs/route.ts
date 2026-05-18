import { NextResponse } from 'next/server';

const FIREWORKS_BASE = 'https://api.fireworks.ai/v1/accounts/trilogy';

const ENDPOINT: Record<string, string> = {
  SFT: 'supervisedFineTuningJobs',
  DPO: 'dpoJobs',
  RFT: 'reinforcementFineTuningJobs',
};

const TERMINAL_STATES = new Set([
  'JOB_STATE_COMPLETED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
  'JOB_STATE_EARLY_STOPPED',
]);

export interface FireworksJobSummary {
  name: string;
  kind: 'SFT' | 'DPO' | 'RFT';
  state: string;
  created_at: string | null;
  gpu_count: number | null;
}

export async function GET() {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'FIREWORKS_API_KEY not configured' }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (['SFT', 'DPO', 'RFT'] as const).map(async (kind) => {
      const url = `${FIREWORKS_BASE}/${ENDPOINT[kind]}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error(`[fireworks-jobs] ${kind} list failed: ${res.status}`);
        return [] as FireworksJobSummary[];
      }
      const body = await res.json() as Record<string, unknown>;
      const arr = (body[ENDPOINT[kind]] ?? body.jobs ?? []) as Array<{
        name: string;
        state: string;
        createTime?: string;
        gpuCount?: number;
        gpu_count?: number;
      }>;
      return arr
        .filter((j) => !TERMINAL_STATES.has(j.state))
        .map((j): FireworksJobSummary => ({
          name: j.name,
          kind,
          state: j.state,
          created_at: j.createTime ?? null,
          gpu_count: j.gpuCount ?? j.gpu_count ?? null,
        }));
    })
  );

  const jobs: FireworksJobSummary[] = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : []
  );

  return NextResponse.json({ jobs });
}
