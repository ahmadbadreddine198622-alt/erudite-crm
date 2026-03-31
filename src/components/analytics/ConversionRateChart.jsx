import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ConversionRateChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="source" angle={-45} textAnchor="end" height={80} />
        <YAxis label={{ value: 'Conversion %', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value) => `${value}%`}
          labelFormatter={(label) => `${label}`}
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
        <Bar dataKey="rate" fill="hsl(var(--chart-3))" name="Conversion Rate %" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}