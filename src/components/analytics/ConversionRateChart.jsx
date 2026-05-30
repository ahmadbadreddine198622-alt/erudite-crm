import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ConversionRateChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="source" angle={-45} textAnchor="end" height={80} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
        <YAxis label={{ value: 'Conversion %', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, '']}
          labelFormatter={(label) => label}
          labelStyle={{ color: 'rgba(255,255,255,0.95)' }}
          contentStyle={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.95)',
          }}
        />
        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
        <Bar dataKey="rate" fill="hsl(152 69% 40%)" name="Conversion Rate %" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}