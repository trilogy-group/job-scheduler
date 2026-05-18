import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('GET /api/fireworks-jobs (T-ORPHAN-POLLER)', () => {
  const ORIG_KEY = process.env.FIREWORKS_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIG_KEY === undefined) delete process.env.FIREWORKS_API_KEY;
    else process.env.FIREWORKS_API_KEY = ORIG_KEY;
  });

  it('returns 500 when FIREWORKS_API_KEY is not set', async () => {
    delete process.env.FIREWORKS_API_KEY;
    const mod = await import('@/app/api/fireworks-jobs/route');
    const res = await mod.GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/FIREWORKS_API_KEY/);
  });

  it('fetches all 3 endpoints and merges non-terminal jobs', async () => {
    process.env.FIREWORKS_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('supervisedFineTuningJobs')) {
        return new Response(
          JSON.stringify({
            supervisedFineTuningJobs: [
              {
                name: 'accounts/trilogy/supervisedFineTuningJobs/s1',
                state: 'JOB_STATE_RUNNING',
                createTime: '2026-05-01T10:00:00Z',
                gpuCount: 4,
              },
              {
                name: 'accounts/trilogy/supervisedFineTuningJobs/s2-done',
                state: 'JOB_STATE_COMPLETED',
                createTime: '2026-04-01T10:00:00Z',
                gpuCount: 4,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('dpoJobs')) {
        return new Response(
          JSON.stringify({
            dpoJobs: [
              {
                name: 'accounts/trilogy/dpoJobs/d1',
                state: 'JOB_STATE_PENDING',
                createTime: '2026-05-01T11:00:00Z',
                gpuCount: 8,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('reinforcementFineTuningJobs')) {
        return new Response(
          JSON.stringify({
            reinforcementFineTuningJobs: [
              {
                name: 'accounts/trilogy/reinforcementFineTuningJobs/r1',
                state: 'JOB_STATE_RUNNING',
                createTime: '2026-05-01T12:00:00Z',
                gpuCount: 2,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('@/app/api/fireworks-jobs/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jobs: Array<{ name: string; kind: string; state: string }>;
    };
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Terminal job filtered out.
    expect(body.jobs.find((j) => j.name.endsWith('s2-done'))).toBeUndefined();
    expect(body.jobs.find((j) => j.name.endsWith('/s1'))?.kind).toBe('SFT');
    expect(body.jobs.find((j) => j.name.endsWith('/d1'))?.kind).toBe('DPO');
    expect(body.jobs.find((j) => j.name.endsWith('/r1'))?.kind).toBe('RFT');
    expect(body.jobs.length).toBe(3);
  });

  it('skips a kind gracefully when its fetch fails', async () => {
    process.env.FIREWORKS_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('dpoJobs')) {
        // Simulate network error -> Promise.allSettled rejection.
        throw new Error('network down');
      }
      if (url.includes('supervisedFineTuningJobs')) {
        return new Response(
          JSON.stringify({
            supervisedFineTuningJobs: [
              {
                name: 'accounts/trilogy/supervisedFineTuningJobs/s-ok',
                state: 'JOB_STATE_RUNNING',
                createTime: '2026-05-01T10:00:00Z',
                gpuCount: 4,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('reinforcementFineTuningJobs')) {
        // 500 response -> empty list, but resolved.
        return new Response('boom', { status: 500 });
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('@/app/api/fireworks-jobs/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jobs: Array<{ name: string; kind: string }>;
    };
    // SFT job survives; DPO threw; RFT returned 500.
    expect(body.jobs.length).toBe(1);
    expect(body.jobs[0]!.kind).toBe('SFT');
    expect(body.jobs[0]!.name.endsWith('/s-ok')).toBe(true);
  });

  it('filters out all terminal-state jobs', async () => {
    process.env.FIREWORKS_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('supervisedFineTuningJobs')) {
        return new Response(
          JSON.stringify({
            supervisedFineTuningJobs: [
              { name: 'a/s/completed', state: 'JOB_STATE_COMPLETED' },
              { name: 'a/s/failed', state: 'JOB_STATE_FAILED' },
              { name: 'a/s/cancelled', state: 'JOB_STATE_CANCELLED' },
              { name: 'a/s/expired', state: 'JOB_STATE_EXPIRED' },
              { name: 'a/s/early', state: 'JOB_STATE_EARLY_STOPPED' },
              { name: 'a/s/running', state: 'JOB_STATE_RUNNING' },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('@/app/api/fireworks-jobs/route');
    const res = await mod.GET();
    const body = (await res.json()) as { jobs: Array<{ name: string }> };
    expect(body.jobs.length).toBe(1);
    expect(body.jobs[0]!.name).toBe('a/s/running');
  });
});
