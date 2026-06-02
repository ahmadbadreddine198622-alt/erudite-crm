import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeStat({ label, value, trend, trendValue, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </p>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
          {value}
        </p>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
            trend === 'up' ? 'bg-emerald-500/15 text-emerald-400' :
            trend === 'down' ? 'bg-rose-500/15 text-rose-400' :
            'bg-slate-500/15 text-slate-400'
          )}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}