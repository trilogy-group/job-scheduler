import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { humanizeAge, formatDuration } from '@/lib/time';

describe('humanizeAge', () => {
  const NOW = new Date('2026-05-01T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders seconds when < 60s', () => {
    const t = new Date(NOW - 30 * 1000).toISOString();
    expect(humanizeAge(t)).toBe('30s');
  });

  it('renders minutes when < 1h', () => {
    const t = new Date(NOW - 5 * 60 * 1000).toISOString();
    expect(humanizeAge(t)).toBe('5m');
  });

  it('renders hours when < 1d', () => {
    const t = new Date(NOW - 3 * 3600 * 1000).toISOString();
    expect(humanizeAge(t)).toBe('3h');
  });

  it('renders days when >= 1d', () => {
    const t = new Date(NOW - 2 * 86400 * 1000).toISOString();
    expect(humanizeAge(t)).toBe('2d');
  });

  it('handles zero seconds', () => {
    expect(humanizeAge(new Date(NOW).toISOString())).toBe('0s');
  });
});

describe('formatDuration', () => {
  it('renders seconds-only when < 60s', () => {
    expect(
      formatDuration('2026-05-01T10:00:00Z', '2026-05-01T10:00:45Z'),
    ).toBe('45s');
  });

  it('renders minutes + seconds when < 1h', () => {
    expect(
      formatDuration('2026-05-01T10:00:00Z', '2026-05-01T10:05:30Z'),
    ).toBe('5m 30s');
  });

  it('renders hours + minutes when >= 1h', () => {
    expect(
      formatDuration('2026-05-01T10:00:00Z', '2026-05-01T12:15:00Z'),
    ).toBe('2h 15m');
  });

  it('handles exact hour boundary', () => {
    expect(
      formatDuration('2026-05-01T10:00:00Z', '2026-05-01T11:00:00Z'),
    ).toBe('1h 0m');
  });

  it('handles exact minute boundary', () => {
    expect(
      formatDuration('2026-05-01T10:00:00Z', '2026-05-01T10:01:00Z'),
    ).toBe('1m 0s');
  });
});
