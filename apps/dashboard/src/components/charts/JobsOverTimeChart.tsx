'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type JobsOverTimePoint = {
  date: string;
  count: number;
};

type Props = {
  data: JobsOverTimePoint[];
};

export default function JobsOverTimeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-[#6d7277]">No job activity yet.</div>
    );
  }

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#23272b" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6d7277' }} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: '#6d7277' }}
          />
          <Tooltip
            contentStyle={{
              background: '#13161a',
              border: '1px solid #373b40',
              color: '#f8f8f8',
              fontSize: 12,
            }}
            labelStyle={{ color: '#f8f8f8' }}
            itemStyle={{ color: '#f8f8f8' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#00a1c8"
            strokeWidth={2}
            dot={{ r: 3, fill: '#00a1c8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
