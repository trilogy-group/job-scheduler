import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration, humanizeAge } from '@/lib/time';

const NOW = new Date('2026-05-15T12:00:00.000Z').getTime();

describe('humanizeAge', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns seconds when <60s', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(humanizeAge(iso)).toBe('30s');
  });

  it('returns 0s for current timestamp', () => {
    const iso = new Date(NOW).toISOString();
    expect(humanizeAge(iso)).toBe('0s');
  });

  it('returns minutes when <3600s', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(humanizeAge(iso)).toBe('5m');
  });

  it('returns minutes for boundary 60s', () => {
    const iso = new Date(NOW - 60_000).toISOString();
    expect(humanizeAge(iso)).toBe('1m');
  });

  it('returns hours when <86400s', () => {
    const iso = new Date(NOW - 2 * 3600_000).toISOString();
    expect(humanizeAge(iso)).toBe('2h');
  });

  it('returns hours for boundary 3600s', () => {
    const iso = new Date(NOW - 3600_000).toISOString();
    expect(humanizeAge(iso)).toBe('1h');
  });

  it('returns days when >=86400s', () => {
    const iso = new Date(NOW - 3 * 86_400_000).toISOString();
    expect(humanizeAge(iso)).toBe('3d');
  });

  it('returns days for boundary 86400s', () => {
    const iso = new Date(NOW - 86_400_000).toISOString();
    expect(humanizeAge(iso)).toBe('1d');
  });
});

describe('formatDuration', () => {
  it('returns seconds when <60s', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T12:00:45.000Z'),
    ).toBe('45s');
  });

  it('returns 0s for equal timestamps', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T12:00:00.000Z'),
    ).toBe('0s');
  });

  it('returns m and s when <3600s', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T12:05:30.000Z'),
    ).toBe('5m 30s');
  });

  it('returns m 0s when exactly N minutes', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T12:10:00.000Z'),
    ).toBe('10m 0s');
  });

  it('returns h and m when >=3600s', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T14:30:00.000Z'),
    ).toBe('2h 30m');
  });

  it('returns h 0m for exact hour', () => {
    expect(
      formatDuration('2026-05-15T12:00:00.000Z', '2026-05-15T13:00:00.000Z'),
    ).toBe('1h 0m');
  });
});
