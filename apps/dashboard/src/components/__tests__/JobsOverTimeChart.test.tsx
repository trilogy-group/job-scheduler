import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="line-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

import JobsOverTimeChart from '@/components/charts/JobsOverTimeChart';

describe('JobsOverTimeChart', () => {
  it('renders empty state when data is empty', () => {
    render(<JobsOverTimeChart data={[]} />);
    expect(screen.getByText('No job activity yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders the line chart wrapper when data is non-empty', () => {
    const data = [
      { date: '2026-05-13', count: 1 },
      { date: '2026-05-14', count: 4 },
      { date: '2026-05-15', count: 2 },
    ];
    render(<JobsOverTimeChart data={data} />);
    const chart = screen.getByTestId('line-chart');
    expect(chart).toBeInTheDocument();
    expect(chart.getAttribute('data-count')).toBe('3');
    expect(screen.queryByText('No job activity yet.')).not.toBeInTheDocument();
  });
});
