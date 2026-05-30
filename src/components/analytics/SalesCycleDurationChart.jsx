import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SalesCycleDurationChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="agent" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value} days`, '']}
          labelStyle={{ color: 'rgba(255,255,255,0.95)' }}
          contentStyle={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.95)',
          }}
        />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
        <Bar dataKey="avgDays" fill="hsl(38 92% 50%)" name="Avg Days to Close" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}