import React from 'react';
import { cn } from '@/lib/utils';

export default function QuickFilters({ filters, activeFilter, onFilterChange, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2 mb-4', className)}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
            activeFilter === filter.value
              ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/25'
              : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
          )}
        >
          {filter.label}
          {filter.count !== undefined && (
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
              activeFilter === filter.value
                ? 'bg-accent-foreground/20'
                : 'bg-white/10'
            )}>
              {filter.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}