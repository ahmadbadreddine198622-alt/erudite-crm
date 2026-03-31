import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function RevenueVsTargetChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.byAgent} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="agent" />
        <YAxis label={{ value: 'AED', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value) => `AED ${value.toLocaleString()}`}
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
        <Bar dataKey="actual" fill="hsl(var(--chart-1))" name="Actual Revenue" radius={[8, 8, 0, 0]} />
        <Bar dataKey="target" fill="hsl(var(--chart-2))" name="Target Revenue" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}