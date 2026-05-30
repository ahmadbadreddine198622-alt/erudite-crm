import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function RevenueVsTargetChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.byAgent} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="agent" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <YAxis label={{ value: 'AED', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`AED ${value.toLocaleString()}`, '']}
          labelStyle={{ color: 'rgba(255,255,255,0.95)' }}
          contentStyle={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.95)',
          }}
        />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
        <Bar dataKey="actual" fill="hsl(38 92% 50%)" name="Actual Revenue" radius={[8, 8, 0, 0]} />
        <Bar dataKey="target" fill="hsl(173 58% 39%)" name="Target Revenue" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}