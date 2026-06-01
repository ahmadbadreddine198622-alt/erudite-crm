import React from 'react';
import { cn } from '@/lib/utils';
import iOSCard from './iOSCard';

export default function iOSStat({ label, value, trend, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  return (
    <iOSCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        {Icon && (
          <div className={cn('p-2 rounded-xl', colors[color] + '/10')}>
            <Icon className={cn('w-5 h-5', colors[color])} />
          </div>
        )}
        {trend && (
          <span className={cn(
            'text-xs font-semibold px-2 py-1 rounded-full',
            trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </iOSCard>
  );
}