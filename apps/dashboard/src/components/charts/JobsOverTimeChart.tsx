'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface JobsOverTimePoint {
  date: string;
  count: number;
}

export function JobsOverTimeChart({ data }: { data: JobsOverTimePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 border border-gray-200 rounded">
        No job activity to chart
      </div>
    );
  }
  return (
    <div className="border border-gray-200 rounded p-3 bg-white">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={12}
            tickMargin={6}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            allowDecimals={false}
            tickMargin={6}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid #e5e7eb',
            }}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
